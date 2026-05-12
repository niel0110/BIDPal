import { supabase } from '../config/supabase.js';
import { createPaymentWindow } from './violationService.js';

// Find the next highest bidder who hasn't already been offered this auction.
// excludeUserId: always excluded regardless of DB rows (the user who just cancelled).
export const findNextWinner = async (auctionId, excludeUserId = null) => {
  // Users who explicitly cancelled for this auction (ground truth — always excludes them)
  const { data: cancellations } = await supabase
    .from('Order_Cancellations')
    .select('user_id')
    .eq('auction_id', auctionId);

  // Users with an ACTIVE payment window (payment not yet completed)
  const { data: activeWindows } = await supabase
    .from('Payment_Windows')
    .select('winner_user_id')
    .eq('auction_id', auctionId)
    .eq('payment_completed', false);

  // Users who forfeited by letting their window expire without paying
  const { data: forfeitedWindows } = await supabase
    .from('Payment_Windows')
    .select('winner_user_id')
    .eq('auction_id', auctionId)
    .eq('violation_triggered', true);

  // Users with a non-cancelled Order (they paid or are processing)
  const { data: activeOrders } = await supabase
    .from('Orders')
    .select('user_id')
    .eq('auction_id', auctionId)
    .neq('status', 'cancelled');

  const usedUserIds = new Set([
    ...(cancellations || []).map(c => c.user_id),
    ...(activeWindows || []).map(w => w.winner_user_id),
    ...(forfeitedWindows || []).map(w => w.winner_user_id),
    ...(activeOrders || []).map(o => o.user_id)
  ]);
  if (excludeUserId) usedUserIds.add(excludeUserId);

  const { data: bids, error } = await supabase
    .from('Bids')
    .select('bid_id, bid_amount, user_id, placed_at, bidder:User(user_id, Fname, Lname, email)')
    .eq('auction_id', auctionId)
    .order('bid_amount', { ascending: false });

  if (error || !bids) return null;

  return bids.find(b => !usedUserIds.has(b.user_id)) || null;
};

// Cascade order to next highest bidder after cancellation or payment expiry
export const cascadeToNextWinner = async (auctionId, cancelledByUserId) => {
  try {
    console.log(`🔄 Cascading auction ${auctionId} after cancellation by user ${cancelledByUserId}`);

    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id, products_id, seller_id, Seller(seller_id, user_id, store_name)')
      .eq('auction_id', auctionId)
      .single();

    if (auctionError || !auction) {
      console.warn(`Could not find auction ${auctionId} for cascade`);
      return { cascaded: false, reason: 'auction_not_found' };
    }

    const { data: product } = await supabase
      .from('Products')
      .select('products_id, name')
      .eq('products_id', auction.products_id)
      .maybeSingle();

    const productName = product?.name || 'the item';

    // Resolve seller's user_id — join may return null if FK alias differs, so fall back to direct lookup
    let sellerUserId = auction.Seller?.user_id;
    if (!sellerUserId && auction.seller_id) {
      const { data: sellerRow } = await supabase
        .from('Seller')
        .select('user_id')
        .eq('seller_id', auction.seller_id)
        .maybeSingle();
      sellerUserId = sellerRow?.user_id || null;
      if (sellerUserId) console.log(`🔍 Seller user_id resolved via fallback lookup: ${sellerUserId}`);
      else console.warn(`⚠️ Could not resolve seller user_id for seller_id=${auction.seller_id}`);
    }

    const nextBid = await findNextWinner(auctionId, cancelledByUserId);

    if (!nextBid) {
      console.log(`ℹ️ No more eligible bidders for auction ${auctionId}`);

      // Reset the auction fields so it can be rescheduled
      await supabase
        .from('Auctions')
        .update({ 
            winner_user_id: null, 
            winning_bid_id: null, 
            final_price: null,
            status: 'ended' // Move to ended status (unsuccessful)
        })
        .eq('auction_id', auctionId);

      // Restore product availability
      await supabase
        .from('Products')
        .update({ 
            status: 'active', // Make it available for a new auction
            availability: 1 
        })
        .eq('products_id', auction.products_id);

      await _notifySeller(sellerUserId, {
        type: 'order_cancelled',
        title: '⚠️ No More Bidders Available',
        message: `All eligible bidders for "${productName}" have been exhausted. The item is now inactive — you may re-list it.`,
        auctionId
      });

      return { cascaded: false, reason: 'no_more_bidders' };
    }

    console.log(`👤 Next winner: user ${nextBid.user_id} with bid ₱${nextBid.bid_amount}`);

    // Update auction to reflect the new winner
    // (Order is created at checkout when buyer provides shipping address)
    await supabase
      .from('Auctions')
      .update({
        winner_user_id: nextBid.user_id,
        winning_bid_id: nextBid.bid_id,
        final_price: nextBid.bid_amount
      })
      .eq('auction_id', auctionId);

    // Open a fresh 24-hour payment window for the next winner
    try {
      await createPaymentWindow(auctionId, nextBid.user_id, new Date().toISOString());
    } catch (pwErr) {
      console.warn('Cascaded payment window insert skipped:', pwErr.message);
    }

    // Notify next winner
    await supabase
      .from('Notifications')
      .insert([{
        user_id: nextBid.user_id,
        type: 'auction_won',
        payload: {
          title: '🎉 You are now the winner!',
          message: `The previous winner cancelled their order for "${productName}". You are now the winning bidder at ₱${nextBid.bid_amount.toLocaleString('en-PH')}. Please proceed to payment or cancel within 24 hours.`,
          cascaded: true
        },
        reference_id: auctionId,
        reference_type: 'auction',
        read_at: '2099-12-31T23:59:59.000Z'
      }]);

    // Notify seller about the new winner
    await _notifySeller(sellerUserId, {
      type: 'order_update',
      title: '🔄 New Winner Assigned',
      message: `The next highest bidder has been assigned to "${productName}" at ₱${nextBid.bid_amount.toLocaleString('en-PH')}. They have 24 hours to complete payment.`,
      auctionId
    });

    console.log(`✅ Cascaded auction ${auctionId} → user ${nextBid.user_id} at ₱${nextBid.bid_amount}`);

    return {
      cascaded: true,
      nextWinner: { user_id: nextBid.user_id, bid_amount: nextBid.bid_amount }
    };
  } catch (err) {
    console.error('Error in cascadeToNextWinner:', err);
    return { cascaded: false, reason: 'error', error: err.message };
  }
};

const _notifySeller = async (sellerUserId, { type, title, message, auctionId }) => {
  if (!sellerUserId) {
    console.warn(`⚠️ _notifySeller skipped — sellerUserId is null (auction ${auctionId})`);
    return;
  }
  const { error } = await supabase
    .from('Notifications')
    .insert([{
      user_id: sellerUserId,
      type,
      payload: { title, message },
      reference_id: auctionId,
      reference_type: 'auction',
      read_at: '2099-12-31T23:59:59.000Z'
    }]);
  if (error) console.error(`❌ Seller notification insert failed (user ${sellerUserId}):`, error.message);
  else console.log(`🔔 Seller notified (user ${sellerUserId}): ${title}`);
};

export default { findNextWinner, cascadeToNextWinner };
