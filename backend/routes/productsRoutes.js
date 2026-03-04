import express from 'express';
import {
  getAllProducts,
  getProductById,
  getProductsBySeller,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  updateProductStatus,
  searchProducts
} from '../controllers/productsController.js';

const router = express.Router();

// Get all products with filters
router.get('/', getAllProducts);

// Search products
router.get('/search', searchProducts);

// Get products by seller
router.get('/seller/:seller_id', getProductsBySeller);

// Get product by ID
router.get('/:products_id', getProductById);

// Create new product
router.post('/', createProduct);

// Update product details
router.put('/:products_id', updateProduct);

// Update product status
router.patch('/:products_id/status', updateProductStatus);

// Soft delete product
router.delete('/:products_id', deleteProduct);

// Restore deleted product
router.patch('/:products_id/restore', restoreProduct);

export default router;
