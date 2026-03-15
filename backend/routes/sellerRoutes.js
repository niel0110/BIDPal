import express from 'express';
import {
  getAllSellers,
  getSellerById,
  getSellerByUserId,
  createSeller,
  updateSeller,
  deleteSeller,
  uploadStoreLogo,
  uploadStoreBanner
} from '../controllers/sellerController.js';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for banners
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all sellers
router.get('/', getAllSellers);

// Get seller by seller_id
router.get('/:seller_id', getSellerById);

// Get seller by user_id (for logged-in seller user)
router.get('/user/:user_id', getSellerByUserId);

// Create new seller (open a shop)
router.post('/', createSeller);

// Update seller details
router.put('/:seller_id', updateSeller);

// Delete seller
router.delete('/:seller_id', deleteSeller);

// Upload store media
router.post('/:seller_id/logo', upload.single('logo'), uploadStoreLogo);
router.post('/:seller_id/banner', upload.single('banner'), uploadStoreBanner);

export default router;
