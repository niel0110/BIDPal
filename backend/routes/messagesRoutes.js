import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
  uploadMessageMedia,
  deleteMessage,
  deleteConversation,
  blockUser,
  unblockUser,
  getBlockedUsers,
  upload
} from '../controllers/messagesController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// Fixed-path routes first (before /:conversationId wildcard)
router.get('/unread-count', getUnreadCount);
router.get('/blocked', getBlockedUsers);
router.post('/send', sendMessage);
router.post('/upload', upload.single('file'), uploadMessageMedia);
router.post('/block', blockUser);
router.delete('/block/:userId', unblockUser);

// Wildcard conversation routes
router.get('/', getConversations);
router.get('/:conversationId', getMessages);
router.patch('/:conversationId/read', markAsRead);
router.delete('/:conversationId/messages/:sentAt', deleteMessage);
router.delete('/:conversationId', deleteConversation);

export default router;
