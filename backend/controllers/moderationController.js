import { supabase } from '../config/supabase.js';
import { reduceStrike, clearStrike } from '../services/strikeEngine.js';
import { hashIdentity } from '../services/violationService.js';

/**
 * COMPONENT 4: MODERATION ENGINE
 * Admin/moderator actions for reviewing cases, appeals, and making enforcement decisions
 */

// Get all pending moderation cases
export const getPendingModerationCases = async (req, res) => {
  try {
    const { priority, case_type } = req.query;

    let query = supabase
      .from('Moderation_Cases')
      .select(`
        *,
        User!Moderation_Cases_user_id_fkey (
          user_id,
          email,
          Fname,
          Lname
        ),
        Violation_Events (
          *,
          Violation_Records (
            strike_count,
            account_status,
            successful_transaction_count
          )
        ),
        Appeals (
          *
        ),
        Seller_Reports (
          *,
          Seller (
            store_name,
            user_id
          )
        )
      `)
      .in('case_status', ['pending', 'under_review'])
      .order('created_at', { ascending: true });

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (case_type) {
      query = query.eq('case_type', case_type);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error getting pending cases:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get single moderation case details
export const getModerationCaseDetails = async (req, res) => {
  try {
    const { case_id } = req.params;

    const { data, error } = await supabase
      .from('Moderation_Cases')
      .select(`
        *,
        User!Moderation_Cases_user_id_fkey (
          user_id,
          email,
          Fname,
          Lname,
          create_at
        ),
        Violation_Events (
          *,
          Auctions (
            auction_id,
            final_price,
            live_ended_at,
            Products (
              name,
              seller_id
            )
          ),
          Violation_Records (
            strike_count,
            account_status,
            successful_transaction_count
          )
        ),
        Appeals (
          *
        )
      `)
      .eq('moderation_case_id', case_id)
      .single();

    if (error) throw error;

    // Get full violation history for this user
    const { data: violationHistory, error: historyError } = await supabase
      .from('Violation_Events')
      .select('*')
      .eq('user_id', data.user_id)
      .order('created_at', { ascending: false });

    if (historyError) throw historyError;

    // Get transaction history for context
    const { data: transactions, error: transError } = await supabase
      .from('Orders')
      .select('order_id, total_amount, status, placed_at')
      .eq('user_id', data.user_id)
      .eq('status', 'completed')
      .order('placed_at', { ascending: false })
      .limit(10);

    if (transError) throw transError;

    res.json({
      ...data,
      violation_history: violationHistory || [],
      successful_transactions: transactions || []
    });
  } catch (err) {
    console.error('Error getting case details:', err);
    res.status(500).json({ error: err.message });
  }
};

// Assign moderator to case
export const assignModerator = async (req, res) => {
  try {
    const { case_id } = req.params;
    const { moderator_id } = req.body;

    const { data, error } = await supabase
      .from('Moderation_Cases')
      .update({
        assigned_moderator_id: moderator_id,
        case_status: 'under_review'
      })
      .eq('moderation_case_id', case_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Moderator assigned successfully', case: data });
  } catch (err) {
    console.error('Error assigning moderator:', err);
    res.status(500).json({ error: err.message });
  }
};

// Resolve moderation case - Ban confirmed
export const confirmBan = async (req, res) => {
  try {
    const { case_id } = req.params;
    const { decision_reason, moderator_id } = req.body;

    // Get case details
    const { data: moderationCase, error: caseError } = await supabase
      .from('Moderation_Cases')
      .select('*, Violation_Events(*, Violation_Records(*))')
      .eq('moderation_case_id', case_id)
      .single();

    if (caseError) throw caseError;

    const userId = moderationCase.user_id;

    // Update violation record to banned
    await supabase
      .from('Violation_Records')
      .update({ account_status: 'banned' })
      .eq('user_id', userId);

    // Create permanent ban restriction
    const { data: violationRecord, error: recordError } = await supabase
      .from('Violation_Records')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (recordError) throw recordError;

    await supabase
      .from('Account_Restrictions')
      .insert([{
        violation_record_id: violationRecord.violation_record_id,
        user_id: userId,
        restriction_type: 'permanently_banned',
        is_active: true,
        expires_at: null,
        details: {
          banned_by: moderator_id,
          reason: decision_reason,
          ban_date: new Date()
        }
      }]);

    // Add to banned accounts registry
    await supabase
      .from('Banned_Accounts_Registry')
      .insert([{
        violation_record_id: violationRecord.violation_record_id,
        user_id: userId,
        verified_identity_hash: violationRecord.verified_identity_hash,
        ban_reason: decision_reason,
        is_permanent: true
      }]);

    // Update moderation case
    await supabase
      .from('Moderation_Cases')
      .update({
        case_status: 'resolved',
        decision: 'ban_confirmed',
        decision_reason,
        resolved_at: new Date(),
        reviewed_at: new Date()
      })
      .eq('moderation_case_id', case_id);

    // Update violation event
    if (moderationCase.violation_event_id) {
      await supabase
        .from('Violation_Events')
        .update({
          resolution_status: 'confirmed',
          resolved_at: new Date()
        })
        .eq('violation_event_id', moderationCase.violation_event_id);
    }

    // Send notification to user
    await supabase
      .from('Notifications')
      .insert([{
        user_id: userId,
        type: 'account_banned',
        title: '🚫 Account Permanently Banned',
        message: `Your account has been permanently banned following a moderation review. Reason: ${decision_reason}`,
        reference_type: 'moderation_case',
        reference_id: case_id
      }]);

    console.log(`✅ Ban confirmed for user ${userId}, case ${case_id}`);
    res.json({
      message: 'Ban confirmed and applied',
      user_id: userId,
      case_id
    });
  } catch (err) {
    console.error('Error confirming ban:', err);
    res.status(500).json({ error: err.message });
  }
};

// Resolve moderation case - Reduce strike
export const resolveReduceStrike = async (req, res) => {
  try {
    const { case_id } = req.params;
    const { decision_reason } = req.body;

    // Get case details
    const { data: moderationCase, error: caseError } = await supabase
      .from('Moderation_Cases')
      .select('*')
      .eq('moderation_case_id', case_id)
      .single();

    if (caseError) throw caseError;

    // Reduce strike
    await reduceStrike(moderationCase.user_id, decision_reason);

    // Update moderation case
    await supabase
      .from('Moderation_Cases')
      .update({
        case_status: 'resolved',
        decision: 'strike_reduced',
        decision_reason,
        resolved_at: new Date(),
        reviewed_at: new Date()
      })
      .eq('moderation_case_id', case_id);

    // Update appeal if exists
    if (moderationCase.case_type === 'appeal') {
      await supabase
        .from('Appeals')
        .update({
          appeal_status: 'upheld',
          response: decision_reason,
          responded_at: new Date()
        })
        .eq('moderation_case_id', case_id);
    }

    console.log(`✅ Strike reduced for user ${moderationCase.user_id}, case ${case_id}`);
    res.json({
      message: 'Strike reduced successfully',
      user_id: moderationCase.user_id,
      case_id
    });
  } catch (err) {
    console.error('Error reducing strike:', err);
    res.status(500).json({ error: err.message });
  }
};

// Resolve moderation case - Clear strike
export const resolveClearStrike = async (req, res) => {
  try {
    const { case_id } = req.params;
    const { decision_reason } = req.body;

    // Get case details
    const { data: moderationCase, error: caseError } = await supabase
      .from('Moderation_Cases')
      .select('*')
      .eq('moderation_case_id', case_id)
      .single();

    if (caseError) throw caseError;

    // Clear strike
    if (moderationCase.violation_event_id) {
      await clearStrike(
        moderationCase.user_id,
        moderationCase.violation_event_id,
        decision_reason
      );
    }

    // Update moderation case
    await supabase
      .from('Moderation_Cases')
      .update({
        case_status: 'resolved',
        decision: 'strike_cleared',
        decision_reason,
        resolved_at: new Date(),
        reviewed_at: new Date()
      })
      .eq('moderation_case_id', case_id);

    // Update appeal if exists
    if (moderationCase.case_type === 'appeal') {
      await supabase
        .from('Appeals')
        .update({
          appeal_status: 'upheld',
          response: decision_reason,
          responded_at: new Date()
        })
        .eq('moderation_case_id', case_id);
    }

    console.log(`✅ Strike cleared for user ${moderationCase.user_id}, case ${case_id}`);
    res.json({
      message: 'Strike cleared successfully',
      user_id: moderationCase.user_id,
      case_id
    });
  } catch (err) {
    console.error('Error clearing strike:', err);
    res.status(500).json({ error: err.message });
  }
};

// Deny appeal
export const denyAppeal = async (req, res) => {
  try {
    const { case_id } = req.params;
    const { decision_reason } = req.body;

    // Get case details
    const { data: moderationCase, error: caseError } = await supabase
      .from('Moderation_Cases')
      .select('*')
      .eq('moderation_case_id', case_id)
      .single();

    if (caseError) throw caseError;

    // Update moderation case
    await supabase
      .from('Moderation_Cases')
      .update({
        case_status: 'resolved',
        decision: 'appeal_denied',
        decision_reason,
        resolved_at: new Date(),
        reviewed_at: new Date()
      })
      .eq('moderation_case_id', case_id);

    // Update appeal
    await supabase
      .from('Appeals')
      .update({
        appeal_status: 'denied',
        response: decision_reason,
        responded_at: new Date()
      })
      .eq('moderation_case_id', case_id);

    // Notify user
    await supabase
      .from('Notifications')
      .insert([{
        user_id: moderationCase.user_id,
        type: 'appeal_denied',
        title: '❌ Appeal Denied',
        message: `Your appeal has been reviewed and denied. Reason: ${decision_reason}`,
        reference_type: 'moderation_case',
        reference_id: case_id
      }]);

    console.log(`✅ Appeal denied for user ${moderationCase.user_id}, case ${case_id}`);
    res.json({
      message: 'Appeal denied',
      user_id: moderationCase.user_id,
      case_id
    });
  } catch (err) {
    console.error('Error denying appeal:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get moderation statistics
export const getModerationStats = async (req, res) => {
  try {
    // Count pending cases
    const { count: pendingCount } = await supabase
      .from('Moderation_Cases')
      .select('*', { count: 'exact', head: true })
      .in('case_status', ['pending', 'under_review']);

    // Count resolved cases (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: resolvedCount } = await supabase
      .from('Moderation_Cases')
      .select('*', { count: 'exact', head: true })
      .eq('case_status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo.toISOString());

    // Count banned users
    const { count: bannedCount } = await supabase
      .from('Violation_Records')
      .select('*', { count: 'exact', head: true })
      .eq('account_status', 'banned');

    // Count active violations
    const { count: activeViolationsCount } = await supabase
      .from('Violation_Records')
      .select('*', { count: 'exact', head: true })
      .gt('strike_count', 0);

    res.json({
      pending_cases: pendingCount || 0,
      resolved_last_30_days: resolvedCount || 0,
      banned_users: bannedCount || 0,
      active_violations: activeViolationsCount || 0
    });
  } catch (err) {
    console.error('Error getting moderation stats:', err);
    res.status(500).json({ error: err.message });
  }
};

export default {
  getPendingModerationCases,
  getModerationCaseDetails,
  assignModerator,
  confirmBan,
  resolveReduceStrike,
  resolveClearStrike,
  denyAppeal,
  getModerationStats
};
