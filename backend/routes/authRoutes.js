import express from 'express';
import { register, login, socialLogin, googleLogin } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/social-login', socialLogin); // Legacy route for backward compatibility

export default router;
