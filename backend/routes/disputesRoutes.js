import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { createDispute } from '../controllers/disputesController.js';

const router = express.Router();

router.post('/', authenticateToken, createDispute);

export default router;
