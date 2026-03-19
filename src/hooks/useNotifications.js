'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const POLL_INTERVAL = 10000; // 10 seconds

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const token = localStorage.getItem('bidpal_token');
            const [notifRes, msgRes] = await Promise.all([
                fetch(`${API_URL}/api/notifications`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/messages/unread-count`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (notifRes.ok) {
                const data = await notifRes.json();
                const list = Array.isArray(data) ? data : [];
                setNotifications(list);
                setUnreadCount(list.filter(n => !n.read_at).length);
            }
            if (msgRes.ok) {
                const data = await msgRes.json();
                setUnreadMsgCount(data.count || 0);
            }
        } catch (err) {
            // Silent fail — network hiccup shouldn't crash the UI
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markRead = async (notificationId) => {
        try {
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev =>
                prev.map(n => n.notification_id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {}
    };

    const markAllRead = async () => {
        try {
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const now = new Date().toISOString();
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
            setUnreadCount(0);
        } catch (err) {}
    };

    const totalUnreadCount = unreadCount + unreadMsgCount;

    return { notifications, unreadCount, unreadMsgCount, totalUnreadCount, markRead, markAllRead, refresh: fetchNotifications };
}
