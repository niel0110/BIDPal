'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, MessageCircle, Gavel, Package, X, CheckCheck, Users } from 'lucide-react';
import { useNotifications, isUnread } from '@/hooks/useNotifications';
import styles from './NotificationBell.module.css';

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function getNotificationIcon(type) {
    switch (type) {
        case 'new_message': return <MessageCircle size={16} />;
        case 'new_bid': return <Gavel size={16} />;
        case 'auction_won': return <Gavel size={16} />;
        case 'auction_sold': return <Package size={16} />;
        case 'auction_reserve_not_met': return <Gavel size={16} />;
        case 'order_update': return <Package size={16} />;
        case 'auction_reminder': return <Bell size={16} />;
        case 'auction_interest': return <Users size={16} />;
        case 'auction_upcoming': return <Bell size={16} />;
        default: return <Bell size={16} />;
    }
}

function getNotificationTarget(notification) {
    const { type, reference_id, metadata } = notification;
    let meta = metadata;
    if (typeof metadata === 'string') {
        try { meta = JSON.parse(metadata); } catch (e) { meta = {}; }
    }
    if (type === 'new_message') return `/messages`;
    if (type === 'auction_won') return `/orders`;
    if (type === 'auction_sold' && reference_id) return `/seller/auctions/${reference_id}/results`;
    if (type === 'auction_reserve_not_met' && reference_id) return `/live?id=${reference_id}`;
    if (type === 'order_update' && meta?.order_id) return `/orders`;
    if (type === 'auction_upcoming' && reference_id) return `/live?id=${reference_id}`;
    return '/';
}

export default function NotificationBell() {
    const router = useRouter();
    const { notifications, unreadCount, markRead, markAllRead, markAllSeen } = useNotifications();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotificationClick = async (notification) => {
        if (isUnread(notification)) await markRead(notification.notification_id);
        const target = getNotificationTarget(notification);
        setOpen(false);
        router.push(target);
    };

    return (
        <div className={styles.wrapper} ref={ref}>
            <button
                className={styles.bellBtn}
                onClick={() => {
                    const opening = !open;
                    setOpen(opening);
                    if (opening) markAllSeen();
                }}
                aria-label="Notifications"
                title="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>
            <span className={styles.bellLabel}>Notifications</span>

            {open && (
                <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                        <h3>Notifications</h3>
                        <div className={styles.headerActions}>
                            {unreadCount > 0 && (
                                <button className={styles.markAllBtn} onClick={markAllRead} title="Mark all as read">
                                    <CheckCheck size={16} /> Mark all read
                                </button>
                            )}
                            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className={styles.list}>
                        {notifications.length === 0 ? (
                            <div className={styles.empty}>
                                <Bell size={32} />
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.slice(0, 20).map(n => (
                                <div
                                    key={n.notification_id}
                                    className={`${styles.item} ${isUnread(n) ? styles.unread : ''}`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className={`${styles.iconWrap} ${styles[n.type] || ''}`}>
                                        {getNotificationIcon(n.type)}
                                    </div>
                                    <div className={styles.itemContent}>
                                        <p className={styles.itemText}>
                                            {n.type === 'new_message' && (
                                                <><strong>{n.payload?.senderName}</strong> sent you a message: &quot;{n.payload?.preview}&quot;</>
                                            )}
                                            {n.type === 'new_bid' && (
                                                <>New bid on <strong>{n.payload?.itemName}</strong></>
                                            )}
                                            {n.type === 'auction_won' && (
                                                <><strong>{n.title}</strong><br/>{n.message}</>
                                            )}
                                            {n.type === 'auction_sold' && (
                                                <><strong>{n.title}</strong><br/>{n.message}</>
                                            )}
                                            {n.type === 'auction_reserve_not_met' && (
                                                <><strong>{n.title}</strong><br/>{n.message}</>
                                            )}
                                            {n.type === 'order_update' && (
                                                <>Your order has been updated</>
                                            )}
                                            {!['new_message', 'new_bid', 'order_update', 'auction_won', 'auction_sold', 'auction_reserve_not_met'].includes(n.type) && (
                                                <>{n.message || n.payload?.message || 'You have a new notification'}</>
                                            )}
                                        </p>
                                        <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                                    </div>
                                    {isUnread(n) && <div className={styles.unreadDot} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
