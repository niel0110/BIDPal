import express from 'express';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsSeen
} from '../controllers/notificationsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// ── Diagnostic: test a raw insert into Notifications ─────────────────────────
router.get('/test-insert', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const { data, error } = await supabase
    .from('Notifications')
    .insert([{
      user_id,
      type: 'auction_reminder',
      payload: { auction_id: 'test-123', title: 'Test', message: 'Test message' },
      created_at: new Date().toISOString(),
      read_at: '2099-12-31T23:59:59.000Z'
    }])
    .select();
  res.json({ data, error });
});

router.use(authenticateToken);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/mark-seen', markNotificationsSeen);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
