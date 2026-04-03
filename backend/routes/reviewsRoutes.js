import express from 'express';
import { submitReview, getReviewByOrder, getSellerReviews } from '../controllers/reviewsController.js';

const router = express.Router();

router.post('/', submitReview);
router.get('/order/:order_id', getReviewByOrder);
router.get('/seller/:seller_id', getSellerReviews);

export default router;
