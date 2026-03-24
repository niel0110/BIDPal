import express from 'express';
import { generateToken, generateRtmToken } from '../controllers/agoraController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/token', authenticateToken, generateToken);
router.get('/rtm-token', authenticateToken, generateRtmToken);

export default router;
