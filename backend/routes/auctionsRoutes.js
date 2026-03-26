import express from 'express';
import { scheduleAuction, getSellerAuctions, startAuction, endAuction, getAllAuctions, getAuctionById, getLiveComments, postLiveComment, placeBid, getAuctionStats, getAuctionWinner, getAuctionBids } from '../controllers/auctionsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all auctions for discovery
router.get('/', getAllAuctions);

// Get all auctions for a seller
router.get('/seller/:seller_id', getSellerAuctions);

// Schedule a new live auction
router.post('/schedule', scheduleAuction);
router.post('/:id/start', startAuction);
router.post('/:id/end', endAuction);

// Live comments
router.get('/:id/comments', getLiveComments);
router.post('/:id/comments', postLiveComment);

// Get all bids for an auction
router.get('/:id/bids', getAuctionBids);

// Place a bid (requires authentication)
router.post('/:id/bids', authenticateToken, placeBid);

// Get auction stats (views, likes, shares)
router.get('/:id/stats', getAuctionStats);

// Get auction winner details
router.get('/:id/winner', getAuctionWinner);

router.get('/:id', getAuctionById);

export default router;
