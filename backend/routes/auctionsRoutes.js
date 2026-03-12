import express from 'express';
import { scheduleAuction, getSellerAuctions } from '../controllers/auctionsController.js';

const router = express.Router();

// Get all auctions for a seller
router.get('/seller/:seller_id', getSellerAuctions);

// Schedule a new live auction
router.post('/schedule', scheduleAuction);

export default router;
