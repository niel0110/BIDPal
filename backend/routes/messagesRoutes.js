import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
} from '../controllers/messagesController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All messaging routes require authentication
router.use(authenticateToken);

router.get('/', getConversations);
router.get('/unread-count', getUnreadCount);
router.get('/:conversationId', getMessages);
router.post('/send', sendMessage);
router.patch('/:conversationId/read', markAsRead);

export default router;
