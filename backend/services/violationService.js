import { supabase } from '../config/supabase.js';
import crypto from 'crypto';

/**
 * COMPONENT 1: VIOLATION EVENT DETECTOR
 * Listens to auction and payment events and identifies violations
 */

// Hash identity data for privacy compliance (PH Data Privacy Act)
export const hashIdentity = (identityData) => {
  const dataString = JSON.stringify(identityData);
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

// Initialize violation record for new users
export const initializeViolationRecord = async (userId, identityData = null) => {
  try {
    const identityHash = identityData ? hashIdentity(identityData) : null;

    const { data, error } = await supabase
      .from('Violation_Records')
      .insert([{
        user_id: userId,
        strike_count: 0,
        account_status: 'clean',
        verified_identity_hash: identityHash,
        successful_transaction_count: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error initializing violation record:', err);
    throw err;
  }
};

// Get or create violation record
export const getOrCreateViolationRecord = async (userId) => {
  try {
    // Try to get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('Violation_Records')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) return existing;

    // Create if doesn't exist
    if (fetchError?.code === 'PGRST116') {
      return await initializeViolationRecord(userId);
    }

    throw fetchError;
  } catch (err) {
    console.error('Error getting/creating violation record:', err);
    throw err;
  }
};

// Create payment window when auction closes
export const createPaymentWindow = async (auctionId, winnerUserId, auctionEndedAt) => {
  try {
    const paymentDeadline = new Date(auctionEndedAt);
    paymentDeadline.setHours(paymentDeadline.getHours() + 24); // 24 hour payment window

    const { data, error } = await supabase
      .from('Payment_Windows')
      .insert([{
        auction_id: auctionId,
        winner_user_id: winnerUserId,
        auction_ended_at: auctionEndedAt,
        payment_deadline: paymentDeadline,
        payment_completed: false,
        violation_triggered: false
      }])
      .select()
      .single();

    if (error) throw error;
    console.log(`⏰ Payment window created for auction ${auctionId}, deadline: ${paymentDeadline}`);
    return data;
  } catch (err) {
    console.error('Error creating payment window:', err);
    throw err;
  }
};

// Mark payment window as completed
export const completePaymentWindow = async (auctionId) => {
  try {
    const { data, error } = await supabase
      .from('Payment_Windows')
      .update({
        payment_completed: true,
        payment_completed_at: new Date()
      })
      .eq('auction_id', auctionId)
      .select()
      .single();

    if (error) throw error;
    console.log(`✅ Payment window completed for auction ${auctionId}`);
    return data;
  } catch (err) {
    console.error('Error completing payment window:', err);
    throw err;
  }
};

// Check for expired payment windows (called by cron job)
export const checkExpiredPaymentWindows = async () => {
  try {
    const now = new Date();

    // Find all expired payment windows that haven't triggered violations
    const { data: expiredWindows, error } = await supabase
      .from('Payment_Windows')
      .select('*')
      .eq('payment_completed', false)
      .eq('violation_triggered', false)
      .lte('payment_deadline', now.toISOString());

    if (error) throw error;

    console.log(`🔍 Found ${expiredWindows?.length || 0} expired payment windows`);

    // Trigger violation for each expired window
    const violations = [];
    for (const window of expiredWindows || []) {
      try {
        const violation = await triggerPaymentViolation(window);
        violations.push(violation);
      } catch (err) {
        console.error(`Error processing violation for window ${window.payment_window_id}:`, err);
      }
    }

    return violations;
  } catch (err) {
    console.error('Error checking expired payment windows:', err);
    throw err;
  }
};

// Trigger payment violation (automated detection)
export const triggerPaymentViolation = async (paymentWindow) => {
  try {
    console.log(`⚠️  Triggering payment violation for user ${paymentWindow.winner_user_id}`);

    // Get violation record
    const violationRecord = await getOrCreateViolationRecord(paymentWindow.winner_user_id);

    // Create violation event
    const { data: violationEvent, error: eventError } = await supabase
      .from('Violation_Events')
      .insert([{
        violation_record_id: violationRecord.violation_record_id,
        user_id: paymentWindow.winner_user_id,
        auction_id: paymentWindow.auction_id,
        order_id: paymentWindow.order_id,
        violation_type: 'payment_window_expired',
        detection_method: 'automated',
        strike_number: violationRecord.strike_count + 1,
        resolution_status: 'pending',
        description: `Payment window expired. Deadline was ${paymentWindow.payment_deadline}`,
        evidence_data: {
          auction_ended_at: paymentWindow.auction_ended_at,
          payment_deadline: paymentWindow.payment_deadline,
          checked_at: new Date()
        }
      }])
      .select()
      .single();

    if (eventError) throw eventError;

    // Mark payment window as violation triggered
    await supabase
      .from('Payment_Windows')
      .update({
        violation_triggered: true,
        violation_event_id: violationEvent.violation_event_id
      })
      .eq('payment_window_id', paymentWindow.payment_window_id);

    // ── NEW: AUTOMATICALLY CANCEL THE ORDER ──
    try {
        console.log(`🚫 Auto-cancelling order for auction ${paymentWindow.auction_id} due to payment expiry`);
        
        // 1. Find the order
        const { data: order } = await supabase
            .from('Orders')
            .select('order_id, seller_id')
            .eq('auction_id', paymentWindow.auction_id)
            .eq('user_id', paymentWindow.winner_user_id)
            .eq('status', 'pending_payment')
            .maybeSingle();

        if (order) {
            // 2. Mark as cancelled
            await supabase
                .from('Orders')
                .update({ status: 'cancelled' })
                .eq('order_id', order.order_id);

            // 3. Record in Order_Cancellations so it counts toward their limit
            const { data: vRec } = await supabase
                .from('Violation_Records')
                .select('cancellations_this_week')
                .eq('user_id', paymentWindow.winner_user_id)
                .single();

            const newWeeklyCount = (vRec?.cancellations_this_week || 0) + 1;

            await supabase
                .from('Order_Cancellations')
                .insert([{
                    user_id: paymentWindow.winner_user_id,
                    auction_id: paymentWindow.auction_id,
                    order_id: order.order_id,
                    reason: 'Payment Window Expired (Automated)',
                    within_window: false,
                    weekly_cancellation_number: newWeeklyCount,
                    triggered_violation: true,
                    violation_event_id: violationEvent.violation_event_id
                }]);

            // 4. Update weekly count in record
            await supabase
                .from('Violation_Records')
                .update({ cancellations_this_week: newWeeklyCount })
                .eq('user_id', paymentWindow.winner_user_id);
                
            console.log(`✅ Order ${order.order_id} cancelled and recorded for user ${paymentWindow.winner_user_id}`);
        }
    } catch (cancelErr) {
        console.error('Failed to auto-cancel order on payment expiry:', cancelErr);
    }

    // Process strike via Strike Engine
    const { processStrike } = await import('./strikeEngine.js');
    await processStrike(violationEvent);

    return violationEvent;
  } catch (err) {
    console.error('Error triggering payment violation:', err);
    throw err;
  }
};

// Create seller report
export const createSellerReport = async (reportData) => {
  try {
    const {
      seller_id,
      reported_user_id,
      auction_id,
      order_id,
      report_type,
      description,
      evidence
    } = reportData;

    const { data, error } = await supabase
      .from('Seller_Reports')
      .insert([{
        seller_id,
        reported_user_id,
        auction_id,
        order_id,
        report_type,
        description,
        evidence,
        report_status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`📝 Seller report created: ${data.report_id}`);

    // Create moderation case for review
    await createModerationCase({
      user_id: reported_user_id,
      case_type: 'seller_report',
      related_id: data.report_id,
      priority: report_type === 'fraudulent_activity' ? 'high' : 'normal'
    });

    return data;
  } catch (err) {
    console.error('Error creating seller report:', err);
    throw err;
  }
};

// Create moderation case
export const createModerationCase = async (caseData) => {
  try {
    const { data, error } = await supabase
      .from('Moderation_Cases')
      .insert([{
        user_id: caseData.user_id,
        violation_event_id: caseData.violation_event_id || null,
        case_type: caseData.case_type,
        case_status: 'pending',
        priority: caseData.priority || 'normal'
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`⚖️  Moderation case created: ${data.moderation_case_id}`);
    return data;
  } catch (err) {
    console.error('Error creating moderation case:', err);
    throw err;
  }
};

// Increment successful transaction count (called after successful order completion)
export const incrementSuccessfulTransactions = async (userId) => {
  try {
    const violationRecord = await getOrCreateViolationRecord(userId);

    const { data, error } = await supabase
      .from('Violation_Records')
      .update({
        successful_transaction_count: violationRecord.successful_transaction_count + 1
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error incrementing successful transactions:', err);
    throw err;
  }
};

export default {
  hashIdentity,
  initializeViolationRecord,
  getOrCreateViolationRecord,
  createPaymentWindow,
  completePaymentWindow,
  checkExpiredPaymentWindows,
  triggerPaymentViolation,
  createSellerReport,
  createModerationCase,
  incrementSuccessfulTransactions
};
