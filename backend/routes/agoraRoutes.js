import express from 'express';
import { generateToken } from '../controllers/agoraController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/token', authenticateToken, generateToken);

export default router;
