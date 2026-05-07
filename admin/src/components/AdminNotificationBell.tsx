import { useState, useEffect, useRef } from 'react';
import { Bell, UserPlus, CheckCheck, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  new_user:             { icon: UserPlus,   color: '#2563eb', bg: '#eff6ff', label: 'New User' },
  reactivation_request: { icon: RotateCcw,  color: '#7c3aed', bg: '#f5f3ff', label: 'Reactivation' },
  blacklisted_reactivation_appeal: { icon: RotateCcw, color: '#7c3aed', bg: '#f5f3ff', label: 'Blacklist Appeal' },
};

const DEFAULT_CONFIG = { icon: Bell, color: '#6b7280', bg: '#f9fafb', label: 'Alert' };

const AdminNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('Admin_Notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('Admin_Notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('Admin_Notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('admin-notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Admin_Notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as AdminNotification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Admin notifications"
        style={{
          position: 'relative',
          background: open ? '#FEF2F2' : 'white',
          border: `1.5px solid ${open ? 'var(--accent-primary)' : '#e5e7eb'}`,
          borderRadius: '10px',
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: open ? 'var(--accent-primary)' : '#6b7280',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            background: 'var(--accent-primary)',
            color: 'white',
            fontSize: '0.6rem',
            fontWeight: 800,
            borderRadius: '20px',
            minWidth: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid white',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: '380px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
              zIndex: 2000,
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={15} color="var(--accent-primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#111' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#FEF2F2',
                    color: 'var(--accent-primary)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                    }}
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af', display: 'flex' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <Bell size={36} color="#d1d5db" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                    No notifications yet
                  </p>
                  <p style={{ color: '#d1d5db', fontSize: '0.78rem', margin: '4px 0 0' }}>
                    New user registrations will appear here
                  </p>
                </div>
              ) : (
                notifications.map(notif => {
                  const cfg = TYPE_CONFIG[notif.type] || DEFAULT_CONFIG;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => { if (!notif.is_read) markRead(notif.id); }}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '12px 16px',
                        borderBottom: '1px solid #f9fafb',
                        background: notif.is_read ? 'white' : '#fef9f9',
                        cursor: notif.is_read ? 'default' : 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: cfg.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={18} color={cfg.color} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{
                            fontWeight: notif.is_read ? 500 : 700,
                            fontSize: '0.82rem',
                            color: '#111',
                            lineHeight: 1.3,
                          }}>
                            {notif.title}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#9ca3af', flexShrink: 0, paddingTop: '1px' }}>
                            {timeAgo(notif.created_at)}
                          </span>
                        </div>

                        {notif.message && (
                          <p style={{
                            margin: '3px 0 0',
                            fontSize: '0.78rem',
                            color: '#6b7280',
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as any,
                          }}>
                            {notif.message}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: cfg.color,
                            background: cfg.bg,
                            padding: '1px 7px',
                            borderRadius: '20px',
                          }}>
                            {cfg.label}
                          </span>
                          {!notif.is_read && (
                            <div style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: 'var(--accent-primary)',
                            }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f3f4f6',
                textAlign: 'center',
                fontSize: '0.75rem',
                color: '#9ca3af',
                fontWeight: 500,
              }}>
                Showing last {Math.min(notifications.length, 50)} notifications
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminNotificationBell;
