import { supabase } from '../config/supabase.js';

// Unread sentinel: read_at set to far future on insert means "unread".
// Marking as read sets read_at to the actual current time (< sentinel).
const UNREAD_SENTINEL = '2099-12-31T23:59:59.000Z';

// Internal helper — called by other controllers to create notifications
export const createNotification = async (userId, type, payload) => {
  try {
    const { error } = await supabase
      .from('Notifications')
      .insert([{
        user_id: userId,
        type,
        payload,
        created_at: new Date().toISOString(),
        read_at: UNREAD_SENTINEL
      }]);
    if (error) console.error('Failed to create notification:', error.message);
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
};

// GET /api/notifications — fetch notifications for current user (exclude internal tracking records)
export const getNotifications = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('Notifications')
      .select('*')
      .eq('user_id', user_id)
      .neq('type', 'notif_seen')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/notifications/unread-count — count where read_at is still the far-future sentinel
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { count, error } = await supabase
      .from('Notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('read_at', UNREAD_SENTINEL)
      .neq('type', 'notif_seen');

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/notifications/:id/read — mark single notification as read (sets read_at to now)
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

// PATCH /api/notifications/mark-seen — when user opens bell, mark all as read in Supabase
export const markNotificationsSeen = async (req, res) => {
  try {
    const { user_id } = req.user;
    const now = new Date().toISOString();

    // Set read_at = now on all unread notifications for this user
    const { error } = await supabase
      .from('Notifications')
      .update({ read_at: now })
      .eq('user_id', user_id)
      .eq('read_at', UNREAD_SENTINEL);

    if (error) throw error;
    return res.json({ seen_at: now });
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
      .eq('read_at', UNREAD_SENTINEL);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
