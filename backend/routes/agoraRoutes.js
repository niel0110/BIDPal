import express from 'express';
import { generateToken, generateRtmToken } from '../controllers/agoraController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Audience tokens are public — guests need them to watch live streams
// Host tokens still require auth to prevent unauthorized publishing
router.get('/token', (req, res, next) => {
    if (req.query.role === 'host') return authenticateToken(req, res, next);
    next();
}, generateToken);
router.get('/rtm-token', authenticateToken, generateRtmToken);

export default router;
