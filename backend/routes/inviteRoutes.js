import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getMyInvite } from '../controllers/inviteController.js';

const router = express.Router();

router.get('/me', authenticateToken, getMyInvite);

export default router;
