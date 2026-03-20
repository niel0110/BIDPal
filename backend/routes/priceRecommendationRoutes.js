import express from 'express';
import { getPriceRecommendation } from '../controllers/priceRecommendationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get AI price recommendation (requires authentication)
router.post('/price-recommendation', authenticateToken, getPriceRecommendation);

export default router;
