import express from 'express';
import { followSeller, unfollowSeller, getFollowers, getFollowing, checkFollow } from '../controllers/followsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for fetching lists
router.get('/followers/:seller_id', getFollowers);
router.get('/following/:user_id', getFollowing);

// Protected routes
router.use(authenticateToken);
router.get('/check/:seller_id', checkFollow);
router.post('/follow', followSeller);
router.post('/unfollow', unfollowSeller);

export default router;
