import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar,
  submitKYC,
  cancelSellerAccount
} from '../controllers/userController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.get('/', getAllUsers);
router.get('/:user_id', getUserById);
router.post('/', createUser);
router.put('/:user_id', updateUser);
router.post('/:user_id/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.post('/:user_id/kyc', upload.fields([{ name: 'id_photo_front', maxCount: 1 }, { name: 'id_photo_back', maxCount: 1 }]), submitKYC);
router.post('/:user_id/cancel-account', cancelSellerAccount);
router.delete('/:user_id', deleteUser);

export default router;
