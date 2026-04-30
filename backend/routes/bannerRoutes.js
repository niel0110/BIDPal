import express from 'express';
import { getBannerButtons, trackBannerButtonClick } from '../controllers/bannerController.js';

const router = express.Router();

router.get('/buttons', getBannerButtons);
router.post('/buttons/:id/click', trackBannerButtonClick);

export default router;
