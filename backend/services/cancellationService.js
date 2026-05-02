import { supabase } from '../config/supabase.js';
import { getOrCreateViolationRecord } from './violationService.js';
import { processStrike } from './strikeEngine.js';
import { cascadeToNextWinner } from './cascadeService.js';

/**
 * EARLY CANCELLATION SYSTEM
 * Buyers can cancel orders up to 3 times per week
 * 4th+ cancellation triggers a strike
 */

// Check if user can cancel (within 3 per week limit)
export const checkCancellationEligibility = async (userId) => {
  try {
    const violationRecord = await getOrCreateViolationRecord(userId);

    // Check if week needs reset
    const now = new Date();
    const weekResetDate = violationRecord.week_reset_date
      ? new Date(violationRecord.week_reset_date)
      : new Date(0); // treat null as epoch → always reset
    const daysSinceReset = (now - weekResetDate) / (1000 * 60 * 60 * 24);

    if (daysSinceReset >= 7) {
      // Reset weekly count
      await supabase
        .from('Violation_Records')
        .update({
          cancellations_this_week: 0,
          week_reset_date: now
        })
        .eq('user_id', userId);

      return {
        canCancel: true,
        cancellationsThisWeek: 0,
        remainingCancellations: 3,
        weekResetDate: now
      };
    }

    // Count distinct auctions cancelled this week — one item = one cancellation regardless of retries
    const weekStart = violationRecord.week_reset_date
      ? new Date(violationRecord.week_reset_date)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: weekCancels } = await supabase
      .from('Order_Cancellations')
      .select('auction_id, order_id, cancelled_at')
      .eq('user_id', userId)
      .gte('cancelled_at', weekStart.toISOString());

    // Deduplicate: one unique auction_id (or order_id if no auction) = one cancellation
    const uniqueKeys = new Set(
      (weekCancels || []).map(c => c.auction_id || c.order_id).filter(Boolean)
    );
    const cancellationsThisWeek = uniqueKeys.size;

    // ── Self-heal: if account is flagged but has no real Violation_Events, reset to clean ──
    // This corrects records inflated by test runs or cascading bugs.
    if (violationRecord.account_status !== 'clean' || violationRecord.strike_count > 0) {
      const { data: realViolations } = await supabase
        .from('Violation_Events')
        .select('violation_event_id')
        .eq('user_id', userId)
        .neq('resolution_status', 'cleared');

      if (!realViolations?.length) {
        await supabase
          .from('Violation_Records')
          .update({ strike_count: 0, account_status: 'clean', cancellations_this_week: cancellationsThisWeek })
          .eq('user_id', userId);

        return {
          canCancel: true,
          cancellationsThisWeek,
          remainingCancellations: Math.max(0, 3 - cancellationsThisWeek),
          weekResetDate: violationRecord.week_reset_date,
          message: `You can cancel ${3 - cancellationsThisWeek} more order(s) this week`
        };
      }
    }

    // Sync stored count if it drifted
    if (cancellationsThisWeek !== (violationRecord.cancellations_this_week || 0)) {
      await supabase
        .from('Violation_Records')
        .update({ cancellations_this_week: cancellationsThisWeek })
        .eq('user_id', userId);
    }

    const canCancel = cancellationsThisWeek < 3;

    return {
      canCancel,
      cancellationsThisWeek,
      remainingCancellations: Math.max(0, 3 - cancellationsThisWeek),
      weekResetDate: violationRecord.week_reset_date,
      message: canCancel
        ? `You can cancel ${3 - cancellationsThisWeek} more order(s) this week`
        : 'You have reached your cancellation limit (3 per week). Further cancellations will result in strikes.'
    };
  } catch (err) {
    console.error('Error checking cancellation eligibility:', err);
    throw err;
  }
};

// Process order cancellation
export const processCancellation = async (cancellationData) => {
  try {
    const {
      user_id,
      auction_id,
      order_id,
      payment_window_id,
      reason
    } = cancellationData;

    console.log(`🚫 Processing cancellation for user ${user_id}`);

    // Resolve the real order_id — the frontend may pass auction_id as order_id
    // for fallback orders (getOrdersByUser uses auction_id as id when no Order row exists yet)
    let resolvedOrderId = order_id;
    if (order_id) {
      const { data: existingOrder } = await supabase
        .from('Orders')
        .select('order_id')
        .eq('order_id', order_id)
        .maybeSingle();
      if (!existingOrder) resolvedOrderId = null; // id was actually an auction_id
    }

    // If still no order_id, look it up from auction_id
    if (!resolvedOrderId && auction_id) {
      const { data: orderByAuction } = await supabase
        .from('Orders')
        .select('order_id')
        .eq('auction_id', auction_id)
        .eq('user_id', user_id)
        .maybeSingle();
      if (orderByAuction) resolvedOrderId = orderByAuction.order_id;
    }

    // ── Guard: if user already has a cancellation for this auction, don't double-count ──
    // 3 cancellations/week = 3 different items, not 3 attempts on the same item.
    if (auction_id) {
      const { data: alreadyCancelled } = await supabase
        .from('Order_Cancellations')
        .select('cancellation_id')
        .eq('auction_id', auction_id)
        .eq('user_id', user_id)
        .maybeSingle();

      if (alreadyCancelled) {
        console.log(`ℹ️ User ${user_id} already has a cancellation for auction ${auction_id} — skipping duplicate count`);
        // Still cascade in case the previous attempt failed
        cascadeToNextWinner(auction_id, user_id).catch(err =>
          console.warn('Cascade (dedup path) failed:', err.message)
        );
        return { success: true, already_cancelled: true, weekly_cancellation_number: 0, triggered_violation: false, remaining_cancellations: 3 };
      }
    }

    // Check eligibility
    const eligibility = await checkCancellationEligibility(user_id);
    const weeklyCancellationNumber = eligibility.cancellationsThisWeek + 1;

    // Get violation record
    const violationRecord = await getOrCreateViolationRecord(user_id);

    // Check if payment window is still active
    let withinWindow = true;
    if (payment_window_id) {
      const { data: paymentWindow } = await supabase
        .from('Payment_Windows')
        .select('payment_deadline')
        .eq('payment_window_id', payment_window_id)
        .single();

      if (paymentWindow) {
        withinWindow = new Date() < new Date(paymentWindow.payment_deadline);
      }
    }

    let resolvedOrder = null;
    if (resolvedOrderId) {
      const { data: orderRow, error: orderFetchError } = await supabase
        .from('Orders')
        .select('order_id, user_id, auction_id, status, order_type, payment_method, tracking_number, seller_id')
        .eq('order_id', resolvedOrderId)
        .maybeSingle();

      if (orderFetchError) {
        throw new Error('Failed to validate order cancellation: ' + orderFetchError.message);
      }
      if (!orderRow) {
        throw new Error('Order not found');
      }
      if (orderRow.user_id !== user_id) {
        throw new Error('You can only cancel your own orders');
      }

      const paymentMethod = String(orderRow.payment_method || '').toLowerCase();
      const isCod = ['cash_on_delivery', 'cod', 'cash'].includes(paymentMethod);
      const isFixedPrice = orderRow.order_type === 'regular' || !orderRow.auction_id;
      const canCancelPending = orderRow.status === 'pending_payment';
      const canCancelCodFixed =
        isFixedPrice &&
        isCod &&
        orderRow.status === 'processing' &&
        !orderRow.tracking_number;

      if (orderRow.status === 'cancelled') {
        return {
          success: true,
          already_cancelled: true,
          weekly_cancellation_number: 0,
          triggered_violation: false,
          remaining_cancellations: 3
        };
      }

      if (!canCancelPending && !canCancelCodFixed) {
        throw new Error('This order can no longer be cancelled');
      }

      resolvedOrder = orderRow;
    }

    // Cancel the order using the resolved real order_id
    if (resolvedOrderId) {
      const { error: orderUpdateError } = await supabase
        .from('Orders')
        .update({ status: 'cancelled' })
        .eq('order_id', resolvedOrderId);

      if (orderUpdateError) {
        console.error('Failed to update order status:', orderUpdateError.message);
        throw new Error('Failed to cancel order: ' + orderUpdateError.message);
      }
    } else if (auction_id) {
      // Last-resort fallback: cancel by auction_id
      await supabase
        .from('Orders')
        .update({ status: 'cancelled' })
        .eq('auction_id', auction_id)
        .eq('user_id', user_id);
    }

    // Try to create cancellation record (non-fatal if table doesn't exist)
    let cancellation = { user_id, auction_id, order_id: resolvedOrderId, reason, weekly_cancellation_number: weeklyCancellationNumber };
    try {
      const { data: cancellationData, error: cancellationError } = await supabase
        .from('Order_Cancellations')
        .insert([{
          user_id,
          auction_id,
          order_id: resolvedOrderId || null,
          payment_window_id: payment_window_id || null,
          reason,
          within_window: withinWindow,
          weekly_cancellation_number: weeklyCancellationNumber,
          triggered_violation: weeklyCancellationNumber > 3
        }])
        .select()
        .single();

      if (!cancellationError && cancellationData) {
        cancellation = cancellationData;
      }
    } catch (cancellationTableError) {
      console.warn('Order_Cancellations table may not exist, skipping record:', cancellationTableError.message);
    }

    // ── Save step 1: close ALL payment windows for this auction ─────────────
    // Must happen before cascade so the next winner gets a fresh window.
    if (auction_id) {
      const { error: pwErr } = await supabase
        .from('Payment_Windows')
        .update({
          payment_completed: true,
          payment_completed_at: new Date().toISOString(),
          violation_triggered: false
        })
        .eq('auction_id', auction_id)
        .eq('payment_completed', false);

      if (pwErr) console.warn('Payment_Windows close error:', pwErr.message);
      else console.log(`✅ Payment window closed for auction ${auction_id}`);
    }

    // ── Save step 2: re-derive unique cancellation count (distinct auctions this week) ──
    // Always recalculate from source rather than blindly incrementing, to prevent
    // double-counting when the same auction appears in multiple cancellation records.
    const freshEligibility = await checkCancellationEligibility(user_id);
    const actualCount = freshEligibility.cancellationsThisWeek;
    console.log(`✅ Cancellation count (unique auctions this week): ${actualCount}`);

    // ── Save step 3: clear buyer as winner → stops "To Pay" fallback ─────────
    if (auction_id) {
      const { error: auctErr } = await supabase
        .from('Auctions')
        .update({ winner_user_id: null, winning_bid_id: null, final_price: null })
        .eq('auction_id', auction_id)
        .eq('winner_user_id', user_id);

      if (auctErr) console.warn('Auction winner clear error:', auctErr.message);
      else console.log(`✅ Auction ${auction_id} winner cleared`);
    }

    // ── Save step 4: notify seller of cancellation synchronously (direct lookup — reliable) ──
    if (auction_id) {
      try {
        const { data: auctionRow } = await supabase
          .from('Auctions')
          .select('seller_id, Products(name)')
          .eq('auction_id', auction_id)
          .maybeSingle();

        if (auctionRow?.seller_id) {
          const { data: sellerRow } = await supabase
            .from('Seller')
            .select('user_id')
            .eq('seller_id', auctionRow.seller_id)
            .maybeSingle();

          if (sellerRow?.user_id) {
            const productName = auctionRow.Products?.name || 'the item';
            await supabase.from('Notifications').insert([{
              user_id: sellerRow.user_id,
              type: 'order_cancelled',
              payload: {
                title: '❌ Order Cancelled by Buyer',
                message: `A buyer cancelled their order for "${productName}". We are assigning the next eligible bidder.`
              },
              reference_id: auction_id,
              reference_type: 'auction',
              read_at: '2099-12-31T23:59:59.000Z'
            }]);
            console.log(`🔔 Seller (user ${sellerRow.user_id}) notified of cancellation for auction ${auction_id}`);
          }
        }
      } catch (sellerNotifErr) {
        console.warn('Seller cancellation notification failed:', sellerNotifErr.message);
      }
    }

    // Notify seller for fixed-price/cart cancellations.
    if (!auction_id && resolvedOrder?.seller_id) {
      try {
        const { data: sellerRow } = await supabase
          .from('Seller')
          .select('user_id')
          .eq('seller_id', resolvedOrder.seller_id)
          .maybeSingle();

        const { data: itemRow } = await supabase
          .from('Order_items')
          .select('Products(name)')
          .eq('order_id', resolvedOrderId)
          .limit(1)
          .maybeSingle();

        if (sellerRow?.user_id) {
          const productName = itemRow?.Products?.name || 'an item';
          await supabase.from('Notifications').insert([{
            user_id: sellerRow.user_id,
            type: 'order_cancelled',
            payload: {
              title: 'Order Cancelled by Buyer',
              message: `A buyer cancelled their COD fixed-price order for "${productName}".`
            },
            reference_id: resolvedOrderId,
            reference_type: 'order',
            read_at: '2099-12-31T23:59:59.000Z'
          }]);
        }
      } catch (sellerNotifErr) {
        console.warn('Fixed-price seller cancellation notification failed:', sellerNotifErr.message);
      }
    }

    // ── Save step 5: cascade to next bidder (async — opens new payment window,
    //    updates Auctions.winner_user_id, notifies seller of new winner) ───────
    if (auction_id) {
      cascadeToNextWinner(auction_id, user_id).catch(err =>
        console.warn('Cascade after cancellation failed:', err.message)
      );
    }

    // If 4th+ unique cancellation this week, trigger violation
    if (actualCount > 3) {
      console.log(`⚠️  User ${user_id} exceeded weekly cancellation limit (${actualCount}/3)`);
      await triggerExcessiveCancellationViolation(cancellation, violationRecord);
    } else {
      try {
        await sendCancellationNotification(user_id, actualCount);
      } catch (notifError) {
        console.warn('Cancellation notification failed:', notifError.message);
      }
    }

    return {
      success: true,
      cancellation,
      weekly_cancellation_number: actualCount,
      triggered_violation: actualCount > 3,
      remaining_cancellations: Math.max(0, 3 - actualCount)
    };
  } catch (err) {
    console.error('Error processing cancellation:', err);
    throw err;
  }
};

// Trigger violation for excessive cancellations (4th+ in a week)
const triggerExcessiveCancellationViolation = async (cancellation, violationRecord) => {
  try {
    console.log(`🚨 Triggering excessive cancellation violation for user ${cancellation.user_id}`);

    // Already at max strikes — skip creating another violation event
    if (violationRecord.strike_count >= 3) {
      console.log(`ℹ️ User already at max strikes (${violationRecord.strike_count}), skipping violation event`);
      return null;
    }

    // Create violation event
    const { data: violationEvent, error: eventError } = await supabase
      .from('Violation_Events')
      .insert([{
        violation_record_id: violationRecord.violation_record_id,
        user_id: cancellation.user_id,
        auction_id: cancellation.auction_id,
        order_id: cancellation.order_id,
        violation_type: 'excessive_cancellations',
        detection_method: 'automated',
        strike_number: violationRecord.strike_count + 1,
        resolution_status: 'pending',
        description: `Excessive order cancellations: ${cancellation.weekly_cancellation_number} cancellations this week (limit: 3)`,
        evidence_data: {
          weekly_cancellation_number: cancellation.weekly_cancellation_number,
          cancellation_id: cancellation.cancellation_id || null,
          cancelled_at: cancellation.cancelled_at || null,
          reason: cancellation.reason
        }
      }])
      .select()
      .single();

    if (eventError) throw eventError;

    // Link violation to cancellation
    await supabase
      .from('Order_Cancellations')
      .update({
        triggered_violation: true,
        violation_event_id: violationEvent.violation_event_id
      })
      .eq('cancellation_id', cancellation.cancellation_id);

    // Process strike
    await processStrike(violationEvent);

    return violationEvent;
  } catch (err) {
    console.error('Error triggering excessive cancellation violation:', err);
    throw err;
  }
};

// Send cancellation notification
const sendCancellationNotification = async (userId, weeklyCancellationNumber) => {
  try {
    let title, message, type;

    if (weeklyCancellationNumber > 3) {
      title = '⚠️ Strike Issued: Excessive Cancellations';
      message = `You have cancelled ${weeklyCancellationNumber} orders this week, exceeding the 3 cancellation limit. A strike has been issued to your account.`;
      type = 'account_violation';
    } else if (weeklyCancellationNumber === 3) {
      title = '⚠️ Final Cancellation Warning';
      message = `You have used all 3 of your weekly cancellations. Any additional cancellations this week will result in a strike.`;
      type = 'warning';
    } else {
      title = '✅ Order Cancelled';
      message = `Your order has been cancelled. You have ${3 - weeklyCancellationNumber} cancellation(s) remaining this week.`;
      type = 'order_update';
    }

    await supabase
      .from('Notifications')
      .insert([{
        user_id: userId,
        type,
        payload: { title, message },
        reference_type: 'cancellation',
        read_at: '2099-12-31T23:59:59.000Z'
      }]);

    console.log(`📧 Cancellation notification sent to user ${userId}`);
  } catch (err) {
    console.error('Error sending cancellation notification:', err);
  }
};

// Get user's cancellation history
export const getUserCancellationHistory = async (userId, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('Order_Cancellations')
      .select(`
        *,
        Auctions (
          auction_id,
          Products (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('cancelled_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting cancellation history:', err);
    throw err;
  }
};

// Reset weekly cancellation counts (called by cron job)
export const resetWeeklyCancellationCounts = async () => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('Violation_Records')
      .update({
        cancellations_this_week: 0,
        week_reset_date: new Date()
      })
      .lt('week_reset_date', oneWeekAgo.toISOString())
      .select('user_id');

    if (error) throw error;

    console.log(`🔄 Reset weekly cancellation counts for ${data?.length || 0} users`);
    return data;
  } catch (err) {
    console.error('Error resetting weekly cancellation counts:', err);
    throw err;
  }
};

export default {
  checkCancellationEligibility,
  processCancellation,
  getUserCancellationHistory,
  resetWeeklyCancellationCounts
};
