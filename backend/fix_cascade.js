/**
 * fix_cascade.js
 * Corrects the current wrong cascade state:
 *   - Finds the auction where the wrong winner (#3) was assigned
 *   - Registers the wrong winner as cancelled in Order_Cancellations
 *   - Re-triggers cascade → should pick #2 (Yuan Lim) this time
 *   - Notifies seller properly
 *
 * Run: node --experimental-vm-modules fix_cascade.js
 *   OR: node fix_cascade.js  (if package.json has "type":"module")
 */

import { supabase } from './config/supabase.js';
import { cascadeToNextWinner } from './services/cascadeService.js';

async function fixCascade() {
  // ── Step 1: find the auction that has a winner but should cascade ───────────
  // Look for the LV bag auction by checking Payment_Windows with multiple entries
  // (multiple entries = cascade already happened at least once)
  const { data: auctions } = await supabase
    .from('Auctions')
    .select('auction_id, winner_user_id, final_price, seller_id, Products(name)')
    .not('winner_user_id', 'is', null)
    .eq('status', 'ended');

  if (!auctions?.length) {
    console.log('No ended auctions with a current winner found.');
    return;
  }

  console.log('Ended auctions with winners:');
  auctions.forEach(a => console.log(`  [${a.auction_id}] ${a.Products?.name} → winner: ${a.winner_user_id} @ ₱${a.final_price}`));

  // ── Step 2: for each auction, check if the winner has an Order_Cancellation ─
  // If they do, they should NOT be the winner — re-cascade
  for (const auction of auctions) {
    const { data: cancellation } = await supabase
      .from('Order_Cancellations')
      .select('cancellation_id, user_id')
      .eq('auction_id', auction.auction_id)
      .eq('user_id', auction.winner_user_id)
      .maybeSingle();

    if (cancellation) {
      console.log(`\n⚠️  Auction ${auction.auction_id} (${auction.Products?.name}): current winner ${auction.winner_user_id} has a cancellation record — wrong winner!`);
      console.log('→ No corrective action needed; winner was already cancelled and cascade was re-run.');
      continue;
    }

    // Check if there are multiple Payment_Windows (cascade happened before)
    const { data: windows } = await supabase
      .from('Payment_Windows')
      .select('winner_user_id, payment_completed, violation_triggered')
      .eq('auction_id', auction.auction_id)
      .order('payment_window_id', { ascending: true });

    console.log(`\nAuction ${auction.auction_id} Payment_Windows:`, windows);

    if (!windows || windows.length < 2) {
      console.log('  → Only one payment window, cascade not involved. Skipping.');
      continue;
    }

    // This auction had multiple cascade attempts — current winner may be wrong
    console.log(`\n🔧 Fixing auction ${auction.auction_id} (${auction.Products?.name})`);
    console.log(`   Current winner: ${auction.winner_user_id}`);

    // Register current winner as "cancelled" so they're excluded from re-cascade
    const currentWinner = auction.winner_user_id;

    const { data: existingCancellation } = await supabase
      .from('Order_Cancellations')
      .select('cancellation_id')
      .eq('auction_id', auction.auction_id)
      .eq('user_id', currentWinner)
      .maybeSingle();

    if (!existingCancellation) {
      await supabase.from('Order_Cancellations').insert([{
        user_id: currentWinner,
        auction_id: auction.auction_id,
        order_id: null,
        reason: 'System correction — incorrect cascade winner',
        within_window: true,
        weekly_cancellation_number: 1,
        triggered_violation: false
      }]);
      console.log(`   ✅ Added ${currentWinner} to Order_Cancellations`);
    } else {
      console.log(`   ℹ️  ${currentWinner} already in Order_Cancellations`);
    }

    // Close any active payment window for the wrong winner
    await supabase
      .from('Payment_Windows')
      .update({ payment_completed: true, payment_completed_at: new Date().toISOString() })
      .eq('auction_id', auction.auction_id)
      .eq('winner_user_id', currentWinner)
      .eq('payment_completed', false);

    // Clear wrong winner from auction
    await supabase
      .from('Auctions')
      .update({ winner_user_id: null, winning_bid_id: null, final_price: null })
      .eq('auction_id', auction.auction_id);

    console.log('   ✅ Auction winner cleared');

    // Re-trigger cascade — now finds the correct #2 bidder
    console.log('   🔄 Re-triggering cascade...');
    const result = await cascadeToNextWinner(auction.auction_id, currentWinner);
    console.log('   Cascade result:', JSON.stringify(result, null, 2));
  }

  console.log('\nDone.');
  process.exit(0);
}

fixCascade().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
