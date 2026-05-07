import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { restrictToAdmin } from '../middleware/adminMiddleware.js';
import {
    getKycPendingUsers,
    getFlaggedListings,
    getDisputes,
    updateUserStanding,
    updateKycStatus,
    resolveDispute,
    moderateListing,
    getAdminDashboardStats,
    getAdminNotifications,
    markAdminNotificationRead,
    markAllAdminNotificationsRead,
} from '../controllers/adminController.js';

const router = express.Router();

// All routes here require Admin role
router.use(authenticateToken);
router.use(restrictToAdmin);

// Stats
router.get('/stats', getAdminDashboardStats);

// User Management
router.get('/kyc/pending', getKycPendingUsers);
router.patch('/users/:id/kyc', updateKycStatus);
router.patch('/users/:id/standing', updateUserStanding);

// Listing Moderation
router.get('/listings/moderation', getFlaggedListings);
router.post('/listings/:id/moderate', moderateListing);

// Dispute Resolution
router.get('/disputes', getDisputes);
router.post('/disputes/:id/resolve', resolveDispute);

// Admin Notifications
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/read-all', markAllAdminNotificationsRead);
router.patch('/notifications/:id/read', markAdminNotificationRead);

export default router;
