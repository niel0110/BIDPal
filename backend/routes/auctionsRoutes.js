import express from 'express';
import { scheduleAuction, getSellerAuctions, startAuction, endAuction, getAllAuctions, getAuctionById, getLiveComments, postLiveComment } from '../controllers/auctionsController.js';

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

router.get('/:id', getAuctionById);

export default router;
