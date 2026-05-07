import express from 'express';
import {
  uploadMiddleware,
  uploadIdDocument,
  submitReactivationRequest,
  getReactivationStatus,
} from '../controllers/reactivationController.js';

const router = express.Router();

// No authentication required — banned users cannot log in
router.post('/upload-id', uploadMiddleware.single('idDocument'), uploadIdDocument);
router.post('/request', submitReactivationRequest);
router.get('/status', getReactivationStatus);

export default router;
