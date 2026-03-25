import express from 'express';
import { getDashboardSummary, getAuctionBids, shareAuction, toggleLikeAuction, trackAuctionView } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/summary', getDashboardSummary);
router.get('/auction/:id/bids', getAuctionBids);
router.post('/auction/:id/share', shareAuction);
router.post('/auction/:id/like', toggleLikeAuction);
router.post('/auction/:id/view', trackAuctionView);

export default router;
