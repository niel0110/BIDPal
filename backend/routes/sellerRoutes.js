import express from 'express';
import {
  getAllSellers,
  getSellerById,
  getSellerByUserId,
  createSeller,
  updateSeller,
  deleteSeller,
  updateSellerRating
} from '../controllers/sellerController.js';

const router = express.Router();

// Get all sellers
router.get('/', getAllSellers);

// Get seller by seller_id
router.get('/seller/:seller_id', getSellerById);

// Get seller by user_id (for logged-in seller user)
router.get('/user/:user_id', getSellerByUserId);

// Create new seller (open a shop)
router.post('/', createSeller);

// Update seller details
router.put('/:seller_id', updateSeller);

// Delete seller
router.delete('/:seller_id', deleteSeller);

// Update seller rating
router.patch('/:seller_id/rating', updateSellerRating);

export default router;
