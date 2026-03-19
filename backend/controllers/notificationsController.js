import { supabase } from '../config/supabase.js';

// Internal helper — called by other controllers to create notifications
export const createNotification = async (userId, type, payload) => {
  try {
    const { error } = await supabase
      .from('Notifications')
      .insert([{
        user_id: userId,
        type,
        payload,
        created_at: new Date().toISOString()
      }]);
    if (error) console.error('Failed to create notification:', error.message);
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
};

// GET /api/notifications — fetch notifications for current user
export const getNotifications = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('Notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/notifications/unread-count
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { count, error } = await supabase
      .from('Notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .is('read_at', null);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/notifications/:id/read — mark single notification read
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.user;

    const { error } = await supabase
      .from('Notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('notification_id', id)
      .eq('user_id', user_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/notifications/read-all — mark all as read
export const markAllNotificationsRead = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { error } = await supabase
      .from('Notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .is('read_at', null);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
