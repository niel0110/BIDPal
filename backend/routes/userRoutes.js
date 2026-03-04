import express from 'express';
import multer from 'multer';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar
} from '../controllers/userController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.get('/', getAllUsers);
router.get('/:user_id', getUserById);
router.post('/', createUser);
router.put('/:user_id', updateUser);
router.post('/:user_id/avatar', upload.single('avatar'), uploadAvatar);
router.delete('/:user_id', deleteUser);

export default router;
