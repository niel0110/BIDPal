import express from 'express';
import { getDashboardSummary, getAuctionBids } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/summary', getDashboardSummary);
router.get('/auction/:id/bids', getAuctionBids);

export default router;
