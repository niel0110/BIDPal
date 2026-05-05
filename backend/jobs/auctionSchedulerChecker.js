import cron from 'node-cron';
import { supabase } from '../config/supabase.js';

const UNREAD_SENTINEL = '2099-12-31T23:59:59.000Z';

// Insert a notification only if one with the same type+reference_id doesn't already exist for this user.
const insertNotificationOnce = async (userId, type, payload, referenceId) => {
  try {
    if (referenceId) {
      const { data: existing } = await supabase
        .from('Notifications')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('reference_id', referenceId)
        .maybeSingle();
      if (existing) return;
    }
    await supabase.from('Notifications').insert([{
      user_id: userId,
      type,
      payload,
      reference_id: referenceId || null,
      reference_type: referenceId ? 'auction' : null,
      created_at: new Date().toISOString(),
      read_at: UNREAD_SENTINEL
    }]);
  } catch (err) {
    console.error(`[AuctionSchedulerChecker] Notification insert failed (${type}):`, err.message);
  }
};

export const startAuctionSchedulerChecker = (io) => {
  console.log('🕐 Auction Scheduler Checker cron job started (every 5 min)');

  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // ── Step 1: 30-minute "go live soon" reminder ────────────────────────
      // Window: start_time is 25–35 minutes from now
      const min25 = new Date(now.getTime() + 25 * 60 * 1000);
      const min35 = new Date(now.getTime() + 35 * 60 * 1000);

      const { data: soonAuctions } = await supabase
        .from('Auctions')
        .select('auction_id, products_id, start_time, seller_id, Seller(user_id)')
        .eq('status', 'scheduled')
        .gte('start_time', min25.toISOString())
        .lte('start_time', min35.toISOString());

      for (const auction of soonAuctions || []) {
        const sellerUserId = auction.Seller?.user_id;
        if (!sellerUserId) continue;

        const { data: prod } = await supabase
          .from('Products').select('name').eq('products_id', auction.products_id).maybeSingle();
        const productName = prod?.name || 'your item';
        const startTime = new Date(auction.start_time).toLocaleString('en-PH', {
          hour: '2-digit', minute: '2-digit', hour12: true
        });

        await insertNotificationOnce(sellerUserId, 'auction_go_live_reminder_30min', {
          auction_id: auction.auction_id,
          title: '⏰ Go Live in 30 Minutes!',
          message: `Your auction for "${productName}" starts at ${startTime}. Get ready to go live!`,
        }, auction.auction_id);

        if (io) {
          io.to(`user:${sellerUserId}`).emit('auction-go-live-reminder', {
            type: '30min',
            auction_id: auction.auction_id,
            product_name: productName,
            start_time: auction.start_time,
          });
        }
      }

      // ── Step 2: "It's time to go live" reminder at start_time ───────────
      // Window: start_time is within the last 5 minutes (matches cron cadence)
      const min5ago = new Date(now.getTime() - 5 * 60 * 1000);

      const { data: startingNow } = await supabase
        .from('Auctions')
        .select('auction_id, products_id, start_time, seller_id, Seller(user_id)')
        .eq('status', 'scheduled')
        .gte('start_time', min5ago.toISOString())
        .lte('start_time', now.toISOString());

      for (const auction of startingNow || []) {
        const sellerUserId = auction.Seller?.user_id;
        if (!sellerUserId) continue;

        const { data: prod } = await supabase
          .from('Products').select('name').eq('products_id', auction.products_id).maybeSingle();
        const productName = prod?.name || 'your item';

        await insertNotificationOnce(sellerUserId, 'auction_go_live_now', {
          auction_id: auction.auction_id,
          title: '🔴 Time to Go Live!',
          message: `Your auction for "${productName}" is starting NOW. Go live to your waiting audience!`,
        }, auction.auction_id);

        if (io) {
          io.to(`user:${sellerUserId}`).emit('auction-go-live-reminder', {
            type: 'now',
            auction_id: auction.auction_id,
            product_name: productName,
            start_time: auction.start_time,
          });
        }
      }

      // ── Step 3: Auto-end overdue scheduled auctions ──────────────────────
      const { data: overdueAuctions } = await supabase
        .from('Auctions')
        .select('auction_id, products_id, seller_id, Seller(user_id)')
        .eq('status', 'scheduled')
        .lte('start_time', now.toISOString());

      if (overdueAuctions?.length > 0) {
        const overdueIds = overdueAuctions.map(a => a.auction_id);
        const overdueProductIds = overdueAuctions.map(a => a.products_id).filter(Boolean);

        await supabase.from('Auctions').update({ status: 'ended' }).in('auction_id', overdueIds);
        if (overdueProductIds.length > 0) {
          await supabase.from('Products').update({ status: 'inactive' }).in('products_id', overdueProductIds);
        }

        for (const auction of overdueAuctions) {
          const sellerUserId = auction.Seller?.user_id;
          if (!sellerUserId) continue;

          const { data: prod } = await supabase
            .from('Products').select('name').eq('products_id', auction.products_id).maybeSingle();
          const productName = prod?.name || 'your item';

          await insertNotificationOnce(sellerUserId, 'auction_overdue', {
            auction_id: auction.auction_id,
            title: '⚠️ Auction Ended — Not Streamed',
            message: `"${productName}" was not streamed live and has been marked as Ended. You can reschedule it from My Auctions.`,
          }, auction.auction_id);
        }

        console.log(`[AuctionSchedulerChecker] Auto-ended ${overdueAuctions.length} overdue auction(s)`);
      }
    } catch (err) {
      console.error('[AuctionSchedulerChecker] Cron error:', err.message);
    }
  });
};

export default startAuctionSchedulerChecker;
