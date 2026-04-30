import express from 'express';
import {
  register,
  login,
  socialLogin,
  googleLogin,
  sendEmailVerificationCode,
  verifyEmailCode,
  resetPassword
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/send-verification-code', sendEmailVerificationCode);
router.post('/verify-email-code', verifyEmailCode);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin);
router.post('/social-login', socialLogin); // Legacy route for backward compatibility

export default router;
