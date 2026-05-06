import { supabase } from '../config/supabase.js';
import {
  getOrCreateViolationRecord,
  createSellerReport,
  hashIdentity,
  incrementSuccessfulTransactions,
  triggerPaymentViolation
} from '../services/violationService.js';
import {
  processStrike,
  checkUserRestrictions,
  reduceStrike,
  clearStrike
} from '../services/strikeEngine.js';
import {
  checkCancellationEligibility,
  processCancellation,
  getUserCancellationHistory
} from '../services/cancellationService.js';
import { cascadeToNextWinner } from '../services/cascadeService.js';

/**
 * API Controllers for Violation System
 */

// Get user's violation record and strike history
export const getUserViolationRecord = async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data: record, error: recordError } = await supabase
      .from('Violation_Records')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (recordError && recordError.code === 'PGRST116') {
      // No record yet - user is clean
      return res.json({
        user_id,
        strike_count: 0,
        account_status: 'clean',
        violations: [],
        restrictions: []
      });
    }

    if (recordError) throw recordError;

    // Get violation events
    const { data: violations, error: violationsError } = await supabase
      .from('Violation_Events')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (violationsError) throw violationsError;

    // Get active restrictions
    const { data: restrictions, error: restrictionsError } = await supabase
      .from('Account_Restrictions')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (restrictionsError) throw restrictionsError;

    res.json({
      ...record,
      violations: violations || [],
      restrictions: restrictions || []
    });
  } catch (err) {
    console.error('Error getting violation record:', err);
    res.status(500).json({ error: err.message });
  }
};

// Check if user can bid (Strike 2+ restrictions)
export const checkBiddingEligibility = async (req, res) => {
  try {
    const { user_id } = req.params;

    const restrictions = await checkUserRestrictions(user_id);

    if (restrictions.biddingDisabled) {
      return res.json({
        canBid: false,
        reason: 'Account suspended or banned',
        restrictions: restrictions.restrictions
      });
    }

    if (restrictions.requiresPreAuth) {
      return res.json({
        canBid: true,
        requiresPreAuthorization: true,
        message: 'Payment pre-authorization required before bidding',
        restrictions: restrictions.restrictions
      });
    }

    res.json({
      canBid: true,
      requiresPreAuthorization: false,
      restrictions: []
    });
  } catch (err) {
    console.error('Error checking bidding eligibility:', err);
    res.status(500).json({ error: err.message });
  }
};

// Seller submits report for bogus buyer
export const submitSellerReport = async (req, res) => {
  try {
    const {
      seller_id,
      reported_user_id,
      auction_id,
      order_id,
      report_type,
      description,
      evidence
    } = req.body;

    if (!seller_id || !reported_user_id || !report_type || !description) {
      return res.status(400).json({
        error: 'Missing required fields: seller_id, reported_user_id, report_type, description'
      });
    }

    const report = await createSellerReport({
      seller_id,
      reported_user_id,
      auction_id,
      order_id,
      report_type,
      description,
      evidence
    });

    res.status(201).json({
      message: 'Report submitted successfully',
      report_id: report.report_id,
      status: 'pending',
      estimated_review_time: '24-48 hours'
    });
  } catch (err) {
    console.error('Error submitting seller report:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get seller reports (for seller dashboard)
export const getSellerReports = async (req, res) => {
  try {
    const { seller_id } = req.params;

    const { data, error } = await supabase
      .from('Seller_Reports')
      .select(`
        *,
        Moderation_Cases (
          case_status,
          decision,
          resolved_at
        )
      `)
      .eq('seller_id', seller_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error getting seller reports:', err);
    res.status(500).json({ error: err.message });
  }
};

// Submit appeal (buyer appeals a strike)
export const submitAppeal = async (req, res) => {
  try {
    const {
      user_id,
      violation_event_id,
      appeal_reason,
      supporting_evidence,
      evidence_attachments
    } = req.body;

    if (!user_id || !violation_event_id || !appeal_reason) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, violation_event_id, appeal_reason'
      });
    }

    // Check if violation exists and is appealable
    const { data: violation, error: violationError } = await supabase
      .from('Violation_Events')
      .select('*')
      .eq('violation_event_id', violation_event_id)
      .eq('user_id', user_id)
      .single();

    if (violationError || !violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    // Check if already appealed
    const { data: existingAppeal } = await supabase
      .from('Appeals')
      .select('appeal_id')
      .eq('violation_event_id', violation_event_id)
      .neq('appeal_status', 'withdrawn')
      .single();

    if (existingAppeal) {
      return res.status(400).json({ error: 'This violation has already been appealed' });
    }

    // Calculate submission deadline (7 days from violation)
    const submissionDeadline = new Date(violation.created_at);
    submissionDeadline.setDate(submissionDeadline.getDate() + 7);

    if (new Date() > submissionDeadline) {
      return res.status(400).json({
        error: 'Appeal window has closed',
        deadline: submissionDeadline
      });
    }

    // Create appeal
    const { data: appeal, error: appealError } = await supabase
      .from('Appeals')
      .insert([{
        violation_event_id,
        user_id,
        appeal_reason,
        supporting_evidence,
        evidence_attachments,
        appeal_status: 'submitted',
        submission_deadline: submissionDeadline
      }])
      .select()
      .single();

    if (appealError) throw appealError;

    // Update violation event status
    await supabase
      .from('Violation_Events')
      .update({ resolution_status: 'appealed' })
      .eq('violation_event_id', violation_event_id);

    // Create moderation case
    const { data: moderationCase, error: caseError } = await supabase
      .from('Moderation_Cases')
      .insert([{
        violation_event_id,
        user_id,
        case_type: 'appeal',
        case_status: 'pending',
        priority: violation.strike_number === 3 ? 'high' : 'normal'
      }])
      .select()
      .single();

    if (caseError) throw caseError;

    // Link appeal to moderation case
    await supabase
      .from('Appeals')
      .update({ moderation_case_id: moderationCase.moderation_case_id })
      .eq('appeal_id', appeal.appeal_id);

    res.status(201).json({
      message: 'Appeal submitted successfully',
      appeal_id: appeal.appeal_id,
      moderation_case_id: moderationCase.moderation_case_id,
      status: 'submitted',
      estimated_review_time: '48-72 hours'
    });
  } catch (err) {
    console.error('Error submitting appeal:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get user's appeals
export const getUserAppeals = async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from('Appeals')
      .select(`
        *,
        Violation_Events (
          violation_type,
          strike_number,
          created_at
        ),
        Moderation_Cases (
          case_status,
          decision,
          decision_reason,
          resolved_at
        )
      `)
      .eq('user_id', user_id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error getting user appeals:', err);
    res.status(500).json({ error: err.message });
  }
};

// Check if identity is banned (Re-Registration Prevention Gate)
export const checkBannedIdentity = async (req, res) => {
  try {
    const { identity_data } = req.body;

    if (!identity_data) {
      return res.status(400).json({ error: 'identity_data is required' });
    }

    const identityHash = hashIdentity(identity_data);

    // Check banned accounts registry
    const { data: bannedRecord, error } = await supabase
      .from('Banned_Accounts_Registry')
      .select('*')
      .eq('verified_identity_hash', identityHash)
      .eq('is_permanent', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (bannedRecord) {
      return res.json({
        is_banned: true,
        reason: 'This identity has been permanently banned from the platform',
        banned_at: bannedRecord.banned_at,
        ban_reason: bannedRecord.ban_reason
      });
    }

    res.json({
      is_banned: false,
      registration_allowed: true
    });
  } catch (err) {
    console.error('Error checking banned identity:', err);
    res.status(500).json({ error: err.message });
  }
};

// Notify successful transaction (clears payment window, increments success count)
export const notifySuccessfulTransaction = async (req, res) => {
  try {
    const { user_id, auction_id, order_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Increment successful transaction count
    await incrementSuccessfulTransactions(user_id);

    // Mark payment window as completed if exists
    if (auction_id) {
      await supabase
        .from('Payment_Windows')
        .update({
          payment_completed: true,
          payment_completed_at: new Date(),
          order_id
        })
        .eq('auction_id', auction_id);
    }

    res.json({
      message: 'Successful transaction recorded',
      user_id
    });
  } catch (err) {
    console.error('Error notifying successful transaction:', err);
    res.status(500).json({ error: err.message });
  }
};

// Check if user can cancel order (within 3 per week limit)
export const checkCancellationLimit = async (req, res) => {
  try {
    const { user_id } = req.params;

    const eligibility = await checkCancellationEligibility(user_id);

    res.json(eligibility);
  } catch (err) {
    console.error('Error checking cancellation limit:', err);
    res.status(500).json({ error: err.message });
  }
};

// Cancel order (with weekly limit tracking)
export const cancelOrder = async (req, res) => {
  try {
    const {
      user_id,
      auction_id,
      order_id,
      payment_window_id,
      reason
    } = req.body;

    if (!user_id || (!auction_id && !order_id)) {
      return res.status(400).json({
        error: 'Missing required fields: user_id and (auction_id or order_id)'
      });
    }

    const result = await processCancellation({
      user_id,
      auction_id,
      order_id,
      payment_window_id,
      reason: reason || 'No reason provided'
    });

    res.json({
      message: 'Order cancelled successfully',
      ...result
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ error: err.message });
  }
};

// Expire payment window — order auto-cancelled, strike issued (bogus bidder)
export const expirePaymentWindow = async (req, res) => {
  try {
    const { user_id, auction_id, order_id } = req.body;

    if (!user_id || (!auction_id && !order_id)) {
      return res.status(400).json({ error: 'user_id and auction_id or order_id required' });
    }

    // Resolve order_id from auction_id if not provided
    let actualOrderId = order_id;
    if (!actualOrderId && auction_id) {
      const { data: ord } = await supabase
        .from('Orders')
        .select('order_id, status')
        .eq('auction_id', auction_id)
        .eq('user_id', user_id)
        .maybeSingle();
      if (ord) actualOrderId = ord.order_id;
    }

    // Idempotency guard — if order already moved out of pending_payment, skip
    if (actualOrderId) {
      const { data: order } = await supabase
        .from('Orders')
        .select('status')
        .eq('order_id', actualOrderId)
        .maybeSingle();

      if (!order || order.status !== 'pending_payment') {
        return res.json({ success: true, already_processed: true });
      }
    }

    // Fetch the payment window
    let paymentWindow = null;
    if (auction_id) {
      const { data: pw } = await supabase
        .from('Payment_Windows')
        .select('*')
        .eq('auction_id', auction_id)
        .eq('payment_completed', false)
        .maybeSingle();
      paymentWindow = pw;
    }

    if (paymentWindow && new Date() < new Date(paymentWindow.payment_deadline)) {
      return res.status(400).json({ error: 'Payment window has not expired yet' });
    }

    // Cancel the order in Orders table
    if (actualOrderId) {
      await supabase
        .from('Orders')
        .update({ status: 'cancelled' })
        .eq('order_id', actualOrderId);
    }

    // Trigger violation + strike via the existing service (handles Payment_Windows update,
    // Violation_Events insert, Violation_Records update, and processStrike consequences)
    if (paymentWindow) {
      await triggerPaymentViolation(paymentWindow);
    }

    console.log(`⚠️  Payment window expired for user ${user_id} — order ${actualOrderId} cancelled`);

    // Notify the buyer that their payment window expired and it counts as a cancellation
    if (auction_id) {
      const { data: auctionForNotif } = await supabase
        .from('Auctions')
        .select('products_id, Products(name)')
        .eq('auction_id', auction_id)
        .maybeSingle();
      const productName = auctionForNotif?.Products?.name || 'the item';
      await supabase.from('Notifications').insert([{
        user_id,
        type: 'order_cancelled',
        reference_id: actualOrderId || auction_id,
        reference_type: actualOrderId ? 'order' : 'auction',
        payload: {
          title: 'Payment Window Expired',
          message: `Your 24-hour payment window for "${productName}" has expired. Your order has been automatically cancelled and recorded as a cancellation on your account.`
        },
        read_at: '2099-12-31T23:59:59.000Z'
      }]);
    }

    // Clear this buyer as winner so they stop seeing the "To Pay" fallback
    if (auction_id) {
      await supabase
        .from('Auctions')
        .update({ winner_user_id: null, winning_bid_id: null, final_price: null })
        .eq('auction_id', auction_id)
        .eq('winner_user_id', user_id);
    }

    // Cascade to next highest bidder (non-blocking)
    if (auction_id) {
      cascadeToNextWinner(auction_id, user_id).catch(err =>
        console.warn('Cascade after payment expiry failed:', err.message)
      );
    }

    res.json({
      success: true,
      already_processed: false,
      order_cancelled: true
    });
  } catch (err) {
    console.error('Error expiring payment window:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get user's cancellation history
export const getCancellationHistory = async (req, res) => {
  try {
    const { user_id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const history = await getUserCancellationHistory(user_id, limit);

    res.json(history);
  } catch (err) {
    console.error('Error getting cancellation history:', err);
    res.status(500).json({ error: err.message });
  }
};

export default {
  getUserViolationRecord,
  checkBiddingEligibility,
  submitSellerReport,
  getSellerReports,
  submitAppeal,
  getUserAppeals,
  checkBannedIdentity,
  notifySuccessfulTransaction,
  checkCancellationLimit,
  cancelOrder,
  getCancellationHistory
};
