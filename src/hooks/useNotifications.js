'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const BASE_INTERVAL = 15000;   // 15s when healthy
const MAX_INTERVAL  = 120000;  // 2 min max backoff
const MAX_FAILURES  = 5;       // circuit open after 5 consecutive failures

// Supabase returns timestamptz in +00:00 format, not .000Z — use year check instead of string compare
export const isUnread = (n) => !n.read_at || new Date(n.read_at).getFullYear() >= 2099;

export function useNotifications() {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);
    const failureCount = useRef(0);
    const currentInterval = useRef(BASE_INTERVAL);
    const timerRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        // Circuit open — stop polling until user navigates/refreshes
        if (failureCount.current >= MAX_FAILURES) return;

        try {
            const token = localStorage.getItem('bidpal_token');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const [notifRes, msgRes] = await Promise.all([
                fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }),
                fetch(`${API_URL}/api/messages/unread-count`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            ]);
            clearTimeout(timeout);

            if (notifRes.status === 401 || notifRes.status === 403) { logout(); return; }

            if (notifRes.ok) {
                const data = await notifRes.json();
                const list = (Array.isArray(data) ? data : []).filter(n => n.type !== 'new_message');
                setNotifications(list);
                setUnreadCount(list.filter(isUnread).length);
            }
            if (msgRes.ok) {
                const data = await msgRes.json();
                setUnreadMsgCount(data.count || 0);
            }

            // Success — reset backoff
            failureCount.current = 0;
            currentInterval.current = BASE_INTERVAL;
        } catch {
            failureCount.current += 1;
            // Exponential backoff: double each failure, cap at MAX_INTERVAL
            currentInterval.current = Math.min(currentInterval.current * 2, MAX_INTERVAL);
        }
    }, [user, logout]);

    useEffect(() => {
        if (!user) return;
        failureCount.current = 0;
        currentInterval.current = BASE_INTERVAL;

        const schedule = () => {
            timerRef.current = setTimeout(async () => {
                await fetchNotifications();
                if (failureCount.current < MAX_FAILURES) schedule();
            }, currentInterval.current);
        };

        fetchNotifications();   // immediate first fetch
        schedule();

        return () => clearTimeout(timerRef.current);
    }, [fetchNotifications, user]);

    // Mark a single notification as read in Supabase — real-time
    const markRead = async (notificationId) => {
        try {
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev =>
                prev.map(n => n.notification_id === notificationId
                    ? { ...n, read_at: new Date().toISOString() }
                    : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {}
    };

    // Mark all as read in Supabase
    const markAllRead = async () => {
        try {
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            const now = new Date().toISOString();
            setNotifications(prev => prev.map(n => ({ ...n, read_at: isUnread(n) ? now : n.read_at })));
            setUnreadCount(0);
        } catch (err) {}
    };

    // Called when the bell opens — marks all unread as read in Supabase
    const markAllSeen = async () => {
        setUnreadCount(0);
        const now = new Date().toISOString();
        setNotifications(prev => prev.map(n => ({ ...n, read_at: isUnread(n) ? now : n.read_at })));
        try {
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${API_URL}/api/notifications/mark-seen`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {}
    };

    const totalUnreadCount = unreadCount + unreadMsgCount;

    return { notifications, unreadCount, unreadMsgCount, totalUnreadCount, markRead, markAllRead, markAllSeen, refresh: fetchNotifications };
}
