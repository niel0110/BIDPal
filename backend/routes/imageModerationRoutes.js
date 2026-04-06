import { Router } from 'express';
import { checkImageContent } from '../controllers/imageModerationController.js';

const router = Router();

router.post('/check', checkImageContent);

export default router;
