import express from 'express';
import { submitEmailSupportInquiry } from '../controllers/supportController.js';

const router = express.Router();

router.post('/email', submitEmailSupportInquiry);

export default router;
