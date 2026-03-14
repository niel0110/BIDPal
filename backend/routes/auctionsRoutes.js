import express from 'express';
import { scheduleAuction, getSellerAuctions, startAuction, endAuction } from '../controllers/auctionsController.js';

const router = express.Router();

// Get all auctions for a seller
router.get('/seller/:seller_id', getSellerAuctions);

// Schedule a new live auction
router.post('/schedule', scheduleAuction);
router.post('/:id/start', startAuction);
router.post('/:id/end', endAuction);

export default router;
