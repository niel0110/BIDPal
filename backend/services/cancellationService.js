import { supabase } from '../config/supabase.js';
import { getOrCreateViolationRecord } from './violationService.js';
import { processStrike } from './strikeEngine.js';

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
    const weekResetDate = new Date(violationRecord.week_reset_date);
    const now = new Date();
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

    const cancellationsThisWeek = violationRecord.cancellations_this_week || 0;
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

    // Create cancellation record
    const { data: cancellation, error: cancellationError } = await supabase
      .from('Order_Cancellations')
      .insert([{
        user_id,
        auction_id,
        order_id,
        payment_window_id,
        reason,
        within_window: withinWindow,
        weekly_cancellation_number: weeklyCancellationNumber,
        triggered_violation: weeklyCancellationNumber > 3
      }])
      .select()
      .single();

    if (cancellationError) throw cancellationError;

    // Update order status to cancelled
    if (order_id) {
      await supabase
        .from('Orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date()
        })
        .eq('order_id', order_id);
    }

    // Mark payment window as cancelled (won't trigger violation)
    if (payment_window_id) {
      await supabase
        .from('Payment_Windows')
        .update({
          payment_completed: true, // Technically not completed, but prevents violation
          payment_completed_at: new Date(),
          violation_triggered: false // Explicitly prevent violation
        })
        .eq('payment_window_id', payment_window_id);
    }

    // Increment weekly cancellation count
    await supabase
      .from('Violation_Records')
      .update({
        cancellations_this_week: weeklyCancellationNumber
      })
      .eq('user_id', user_id);

    // If 4th+ cancellation, trigger violation
    if (weeklyCancellationNumber > 3) {
      console.log(`⚠️  User ${user_id} exceeded weekly cancellation limit (${weeklyCancellationNumber}/3)`);
      await triggerExcessiveCancellationViolation(cancellation, violationRecord);
    }

    // Send notification
    await sendCancellationNotification(user_id, weeklyCancellationNumber, withinWindow);

    return {
      success: true,
      cancellation,
      weekly_cancellation_number: weeklyCancellationNumber,
      triggered_violation: weeklyCancellationNumber > 3,
      remaining_cancellations: Math.max(0, 3 - weeklyCancellationNumber)
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
          cancellation_id: cancellation.cancellation_id,
          cancelled_at: cancellation.cancelled_at,
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
const sendCancellationNotification = async (userId, weeklyCancellationNumber, withinWindow) => {
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
        title,
        message,
        data: {
          weekly_cancellation_number: weeklyCancellationNumber,
          remaining_cancellations: Math.max(0, 3 - weeklyCancellationNumber),
          within_window: withinWindow
        }
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
