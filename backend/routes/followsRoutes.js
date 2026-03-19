import express from 'express';
import { followSeller, unfollowSeller, getFollowers, getFollowing } from '../controllers/followsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for fetching lists
router.get('/followers/:seller_id', getFollowers);
router.get('/following/:user_id', getFollowing);

// Protected routes for following/unfollowing
router.use(authenticateToken);
router.post('/follow', followSeller);
router.post('/unfollow', unfollowSeller);

export default router;
