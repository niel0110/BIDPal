import { supabase } from '../config/supabase.js';
import { createModerationCase } from './violationService.js';

/**
 * COMPONENT 3: STRIKE ENGINE
 * Processes violations, applies consequences, and enforces the three-strike system
 */

// Process a strike and apply appropriate consequences
export const processStrike = async (violationEvent) => {
  try {
    console.log(`⚡ Processing Strike ${violationEvent.strike_number} for user ${violationEvent.user_id}`);

    // Get current violation record
    const { data: violationRecord, error: recordError } = await supabase
      .from('Violation_Records')
      .select('*')
      .eq('user_id', violationEvent.user_id)
      .single();

    if (recordError) throw recordError;

    // Increment strike count
    const newStrikeCount = violationEvent.strike_number;

    // Update violation record
    const { error: updateError } = await supabase
      .from('Violation_Records')
      .update({
        strike_count: newStrikeCount,
        account_status: getStatusForStrike(newStrikeCount)
      })
      .eq('user_id', violationEvent.user_id);

    if (updateError) throw updateError;

    // Apply consequences based on strike number
    switch (newStrikeCount) {
      case 1:
        await applyStrike1Consequences(violationEvent);
        break;
      case 2:
        await applyStrike2Consequences(violationEvent);
        break;
      case 3:
        await applyStrike3Consequences(violationEvent);
        break;
      default:
        console.warn(`Unexpected strike count: ${newStrikeCount}`);
    }

    return violationRecord;
  } catch (err) {
    console.error('Error processing strike:', err);
    throw err;
  }
};

// Get account status for strike number
const getStatusForStrike = (strikeCount) => {
  switch (strikeCount) {
    case 1: return 'warned';
    case 2: return 'restricted';
    case 3: return 'suspended';
    default: return 'clean';
  }
};

// STRIKE 1: Warning
const applyStrike1Consequences = async (violationEvent) => {
  try {
    console.log('📢 Applying Strike 1 consequences: Warning');

    // Send notification to buyer
    await sendStrikeNotification(violationEvent.user_id, 1, {
      title: '⚠️ Strike 1: Warning Issued',
      message: `You have received your first strike for failing to complete payment within the required timeframe. Please ensure you complete payments within 24 hours of winning auctions to avoid further penalties.`,
      auction_id: violationEvent.auction_id,
      violation_type: violationEvent.violation_type
    });

    // Log the action
    console.log(`✅ Strike 1 warning sent to user ${violationEvent.user_id}`);
  } catch (err) {
    console.error('Error applying Strike 1 consequences:', err);
    throw err;
  }
};

// STRIKE 2: Account Restriction + Pre-Authorization Requirement
const applyStrike2Consequences = async (violationEvent) => {
  try {
    console.log('🔒 Applying Strike 2 consequences: Account Restriction');

    // Create account restriction
    const { data: restriction, error: restrictionError } = await supabase
      .from('Account_Restrictions')
      .insert([{
        violation_record_id: violationEvent.violation_record_id,
        user_id: violationEvent.user_id,
        restriction_type: 'pre_authorization_required',
        is_active: true,
        details: {
          requires_pre_auth: true,
          reason: 'Strike 2 penalty',
          applied_strike: 2
        }
      }])
      .select()
      .single();

    if (restrictionError) throw restrictionError;

    // Send notification to buyer
    await sendStrikeNotification(violationEvent.user_id, 2, {
      title: '🔒 Strike 2: Account Restricted',
      message: `Your account has been restricted due to repeated payment failures. You must now provide payment pre-authorization before placing bids. This ensures you have available funds before bidding. Complete successful transactions to restore full privileges.`,
      auction_id: violationEvent.auction_id,
      violation_type: violationEvent.violation_type,
      restriction_details: {
        pre_authorization_required: true,
        bidding_restrictions: 'Payment verification required before bid placement'
      }
    });

    console.log(`✅ Strike 2 restrictions applied to user ${violationEvent.user_id}`);
  } catch (err) {
    console.error('Error applying Strike 2 consequences:', err);
    throw err;
  }
};

// STRIKE 3: Account Suspension + Moderation Review
const applyStrike3Consequences = async (violationEvent) => {
  try {
    console.log('🚫 Applying Strike 3 consequences: Account Suspension');

    // Create account restriction - suspend all bidding
    const { data: restriction, error: restrictionError } = await supabase
      .from('Account_Restrictions')
      .insert([{
        violation_record_id: violationEvent.violation_record_id,
        user_id: violationEvent.user_id,
        restriction_type: 'account_suspended',
        is_active: true,
        details: {
          reason: 'Strike 3 - pending moderation review',
          suspension_date: new Date(),
          review_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        }
      }])
      .select()
      .single();

    if (restrictionError) throw restrictionError;

    // Create moderation case for review
    const moderationCase = await createModerationCase({
      user_id: violationEvent.user_id,
      violation_event_id: violationEvent.violation_event_id,
      case_type: 'strike_3_review',
      priority: 'high'
    });

    // Send notification to buyer
    await sendStrikeNotification(violationEvent.user_id, 3, {
      title: '🚫 Strike 3: Account Suspended',
      message: `Your account has been suspended due to three payment violations. Your case is under review by our moderation team. You may submit an appeal within 7 days. If the suspension is confirmed, your account will be permanently banned.`,
      auction_id: violationEvent.auction_id,
      violation_type: violationEvent.violation_type,
      moderation_case_id: moderationCase.moderation_case_id,
      appeal_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Notify seller(s) affected by this buyer's violations
    await notifyAffectedSellers(violationEvent);

    console.log(`✅ Strike 3 suspension applied to user ${violationEvent.user_id}, case ${moderationCase.moderation_case_id}`);
  } catch (err) {
    console.error('Error applying Strike 3 consequences:', err);
    throw err;
  }
};

// Send strike notification to user
const sendStrikeNotification = async (userId, strikeNumber, details) => {
  try {
    const { error } = await supabase
      .from('Notifications')
      .insert([{
        user_id: userId,
        type: 'account_violation',
        title: details.title,
        message: details.message,
        reference_type: 'violation',
        reference_id: details.auction_id || null,
        data: {
          strike_number: strikeNumber,
          violation_type: details.violation_type,
          ...details
        }
      }]);

    if (error) throw error;
    console.log(`📧 Notification sent to user ${userId} for Strike ${strikeNumber}`);
  } catch (err) {
    console.error('Error sending strike notification:', err);
    // Don't throw - notification failure shouldn't break the strike process
  }
};

// Notify sellers affected by violating buyer
const notifyAffectedSellers = async (violationEvent) => {
  try {
    // Get auction seller
    const { data: auction, error } = await supabase
      .from('Auctions')
      .select(`
        auction_id,
        Products (
          seller_id,
          Seller (
            user_id,
            store_name
          )
        )
      `)
      .eq('auction_id', violationEvent.auction_id)
      .single();

    if (error || !auction?.Products?.Seller) {
      console.warn('Could not find seller for notification');
      return;
    }

    const sellerUserId = auction.Products.Seller.user_id;

    // Send notification to seller
    await supabase
      .from('Notifications')
      .insert([{
        user_id: sellerUserId,
        type: 'buyer_violation',
        title: '⚠️ Bogus Buyer Flagged',
        message: `The winning bidder for your auction has been flagged for repeated payment violations. Their account is now under review by our moderation team.`,
        reference_type: 'auction',
        reference_id: violationEvent.auction_id
      }]);

    console.log(`📧 Seller ${sellerUserId} notified about buyer violation`);
  } catch (err) {
    console.error('Error notifying sellers:', err);
  }
};

// Check if user has active restrictions
export const checkUserRestrictions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('Account_Restrictions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return {
      hasRestrictions: data && data.length > 0,
      restrictions: data || [],
      requiresPreAuth: data?.some(r => r.restriction_type === 'pre_authorization_required'),
      biddingDisabled: data?.some(r =>
        r.restriction_type === 'bidding_disabled' ||
        r.restriction_type === 'account_suspended' ||
        r.restriction_type === 'permanently_banned'
      )
    };
  } catch (err) {
    console.error('Error checking user restrictions:', err);
    throw err;
  }
};

// Reduce strike (used by moderation when appeal is upheld)
export const reduceStrike = async (userId, reason) => {
  try {
    const { data: record, error: fetchError } = await supabase
      .from('Violation_Records')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    if (record.strike_count === 0) {
      throw new Error('User has no strikes to reduce');
    }

    const newStrikeCount = record.strike_count - 1;
    const newStatus = getStatusForStrike(newStrikeCount);

    const { error: updateError } = await supabase
      .from('Violation_Records')
      .update({
        strike_count: newStrikeCount,
        account_status: newStatus
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Deactivate highest-level restriction
    await supabase
      .from('Account_Restrictions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('applied_at', { ascending: false })
      .limit(1);

    // Notify user
    await sendStrikeNotification(userId, newStrikeCount, {
      title: '✅ Strike Reduced',
      message: `Good news! Your appeal has been reviewed and one strike has been removed from your account. Reason: ${reason}`,
      violation_type: 'appeal_upheld'
    });

    console.log(`✅ Strike reduced for user ${userId}: ${record.strike_count} → ${newStrikeCount}`);
    return { previous: record.strike_count, current: newStrikeCount, status: newStatus };
  } catch (err) {
    console.error('Error reducing strike:', err);
    throw err;
  }
};

// Clear strike (complete removal)
export const clearStrike = async (userId, violationEventId, reason) => {
  try {
    // Mark violation as cleared
    await supabase
      .from('Violation_Events')
      .update({
        resolution_status: 'cleared',
        resolved_at: new Date()
      })
      .eq('violation_event_id', violationEventId);

    // Recalculate strike count
    const { data: remainingViolations, error: countError } = await supabase
      .from('Violation_Events')
      .select('violation_event_id')
      .eq('user_id', userId)
      .neq('resolution_status', 'cleared');

    if (countError) throw countError;

    const newStrikeCount = remainingViolations.length;
    const newStatus = newStrikeCount === 0 ? 'clean' : getStatusForStrike(newStrikeCount);

    await supabase
      .from('Violation_Records')
      .update({
        strike_count: newStrikeCount,
        account_status: newStatus
      })
      .eq('user_id', userId);

    console.log(`✅ Strike cleared for user ${userId}, reason: ${reason}`);
    return { newStrikeCount, newStatus };
  } catch (err) {
    console.error('Error clearing strike:', err);
    throw err;
  }
};

export default {
  processStrike,
  checkUserRestrictions,
  reduceStrike,
  clearStrike
};
