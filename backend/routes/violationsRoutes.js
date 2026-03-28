import express from 'express';
import {
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
} from '../controllers/violationsController.js';
import {
  getPendingModerationCases,
  getModerationCaseDetails,
  assignModerator,
  confirmBan,
  resolveReduceStrike,
  resolveClearStrike,
  denyAppeal,
  getModerationStats
} from '../controllers/moderationController.js';

const router = express.Router();

// ===== USER VIOLATION ENDPOINTS =====

// Get user's violation record and strike history
router.get('/user/:user_id/record', getUserViolationRecord);

// Check if user can bid (for Strike 2+ restrictions)
router.get('/user/:user_id/bidding-eligibility', checkBiddingEligibility);

// Notify successful transaction (clears payment window)
router.post('/transaction/success', notifySuccessfulTransaction);

// ===== ORDER CANCELLATION ENDPOINTS =====

// Check if user can cancel (within 3 per week limit)
router.get('/user/:user_id/cancellation-limit', checkCancellationLimit);

// Cancel order
router.post('/cancel-order', cancelOrder);

// Get cancellation history
router.get('/user/:user_id/cancellation-history', getCancellationHistory);

// ===== SELLER REPORT ENDPOINTS =====

// Submit seller report for bogus buyer
router.post('/seller-reports', submitSellerReport);

// Get seller's submitted reports
router.get('/seller-reports/seller/:seller_id', getSellerReports);

// ===== APPEAL ENDPOINTS =====

// Submit appeal
router.post('/appeals', submitAppeal);

// Get user's appeals
router.get('/appeals/user/:user_id', getUserAppeals);

// ===== RE-REGISTRATION PREVENTION =====

// Check if identity is banned
router.post('/check-banned-identity', checkBannedIdentity);

// ===== MODERATION ENDPOINTS (Admin/Moderator only) =====

// Get pending moderation cases
router.get('/moderation/cases/pending', getPendingModerationCases);

// Get moderation statistics
router.get('/moderation/stats', getModerationStats);

// Get case details
router.get('/moderation/cases/:case_id', getModerationCaseDetails);

// Assign moderator to case
router.patch('/moderation/cases/:case_id/assign', assignModerator);

// Resolve case - confirm ban
router.post('/moderation/cases/:case_id/confirm-ban', confirmBan);

// Resolve case - reduce strike
router.post('/moderation/cases/:case_id/reduce-strike', resolveReduceStrike);

// Resolve case - clear strike
router.post('/moderation/cases/:case_id/clear-strike', resolveClearStrike);

// Deny appeal
router.post('/moderation/cases/:case_id/deny-appeal', denyAppeal);

export default router;
