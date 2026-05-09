'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, MessageCircle, Gavel, Package, X, CheckCheck, Users, ShieldCheck, ShieldX, Megaphone } from 'lucide-react';
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
        case 'auction_ended': return <Gavel size={16} />;
        case 'auction_sold': return <Package size={16} />;
        case 'auction_reserve_not_met': return <Gavel size={16} />;
        case 'auction_no_sale': return <Package size={16} />;
        case 'order_update':
        case 'order_cancelled': return <Package size={16} />;
        case 'kyc_approved': return <ShieldCheck size={16} />;
        case 'kyc_rejected': return <ShieldX size={16} />;
        case 'account_violation':
        case 'warning':
        case 'buyer_violation': return <Bell size={16} />;
        case 'auction_reminder': return <Bell size={16} />;
        case 'auction_interest': return <Users size={16} />;
        case 'auction_upcoming': return <Bell size={16} />;
        case 'auction_promoted': return <Megaphone size={16} />;
        default: return <Bell size={16} />;
    }
}

function getNotificationTarget(notification) {
    const { type, reference_id, reference_type } = notification;
    const title = (notification.payload?.title || '').toLowerCase();
    const payloadAuctionId = notification.payload?.auction_id || reference_id;
    const payloadOrderId = notification.payload?.order_id || null;

    switch (type) {
        // Buyer won — go pay
        case 'auction_won':
            return payloadAuctionId ? `/checkout?auction_id=${payloadAuctionId}${payloadOrderId ? `&order_id=${payloadOrderId}` : ''}` : '/orders';

        // Buyer lost but can still view the recap
        case 'auction_ended':
            return payloadAuctionId ? `/live?id=${payloadAuctionId}` : '/';

        // Seller's item sold — see full results
        case 'auction_sold':
            return payloadAuctionId ? `/seller/auctions/${payloadAuctionId}/results` : '/seller';

        // Reserve not met — show the auction recap live page (no order was created)
        case 'auction_reserve_not_met':
            return payloadAuctionId ? `/live?id=${payloadAuctionId}` : '/';

        // Seller: auction ended without a sale — go to auction results/recap
        case 'auction_no_sale':
            return payloadAuctionId ? `/seller/auctions/${payloadAuctionId}/results` : '/seller/auctions';

        // order_cancelled:
        //   reference_type='auction' → buyer cancelled auction order → seller sees auction results
        //   reference_type='order'   → COD/fixed-price cancel → seller orders
        case 'order_cancelled':
            if (reference_type === 'auction') {
                if (title.includes('no more bidders')) {
                    return '/seller/auctions';
                }
                return reference_id ? `/seller/auctions/${reference_id}/results` : '/seller/auctions';
            }
            return '/seller/orders';

        // order_update:
        //   "New Winner Assigned" (reference_type='auction') → auction results
        //   seller payment/shipping updates (reference_type='auction') → seller orders
        //   buyer updates (reference_type='order') → buyer orders
        case 'order_update': {
            if (reference_type === 'auction') {
                return payloadAuctionId ? `/seller/auctions/${payloadAuctionId}/results` : '/seller/auctions';
            }
            const forSeller = reference_type === 'auction' || title.includes('by buyer');
            return forSeller ? '/seller/orders' : '/orders';
        }

        // KYC decisions → re-submit or view profile
        case 'kyc_approved':
            return '/profile';
        case 'kyc_rejected':
            return '/buyer/setup';

        // Legacy system notifications — route based on payload title
        case 'system': {
            const title = notification.payload?.title || '';
            if (title.includes('Rejected')) return '/buyer/setup';
            if (title.includes('Approved')) return '/profile';
            return '/';
        }

        // Buyer violations/warnings → Account Standing in profile
        case 'account_violation':
        case 'warning':
            return '/profile?tab=account-standing';

        // Seller notified of a flagged buyer → seller orders
        case 'buyer_violation':
            return '/seller/orders';

        // Seller: auction was promoted → go to dashboard to start live
        case 'auction_promoted':
            return '/seller';

        // Reminder / upcoming auction → live page
        case 'auction_reminder':
        case 'auction_upcoming':
            return reference_id ? `/live?id=${reference_id}` : '/';

        // Seller: someone set a reminder / bid on auction → their live auction
        case 'auction_interest':
        case 'new_bid':
            return reference_id ? `/live?id=${reference_id}` : '/seller';

        // Messages handled separately (excluded from bell)
        case 'new_message':
            return '/messages';

        default:
            return '/';
    }
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
                <span className={styles.bellIconWrap}>
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </span>
                <span className={styles.bellLabel}>Notifications</span>
            </button>

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
                            notifications
                                .filter(n => n.payload && (n.payload.title || n.payload.message || n.payload.itemName || n.type === 'order_update'))
                                .slice(0, 20).map(n => (
                                <div
                                    key={n.notification_id}
                                    className={`${styles.item} ${isUnread(n) ? styles.unread : ''} ${isUnread(n) ? (styles[n.type] || '') : ''}`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className={`${styles.iconWrap} ${styles[n.type] || ''}`}>
                                        {getNotificationIcon(n.type)}
                                    </div>
                                    <div className={styles.itemContent}>
                                        <p className={styles.itemText}>
                                            {n.type === 'new_bid' && (
                                                <>New bid on <strong>{n.payload?.itemName}</strong></>
                                            )}
                                            {n.type === 'auction_won' && (
                                                <>
                                                    <strong>{n.payload?.title}</strong>
                                                    {n.payload?.message && <><br /><span style={{ color: '#64748b', fontSize: '0.82em' }}>{n.payload.message}</span></>}
                                                    {isUnread(n) && (
                                                        <><br /><span style={{ color: '#D32F2F', fontWeight: 700, fontSize: '0.82em' }}>Pay Now →</span></>
                                                    )}
                                                </>
                                            )}
                                            {(n.type === 'auction_ended' || n.type === 'auction_sold' || n.type === 'auction_reserve_not_met' || n.type === 'auction_no_sale') && (
                                                <><strong>{n.payload?.title}</strong>{n.payload?.message && <><br />{n.payload.message}</>}</>
                                            )}
                                            {(n.type === 'kyc_approved' || n.type === 'kyc_rejected' || n.type === 'system') && (
                                                <><strong>{n.payload?.title}</strong>{n.payload?.message && <><br />{n.payload.message}</>}</>
                                            )}
                                            {(n.type === 'order_cancelled' || n.type === 'account_violation' || n.type === 'warning' || (n.type === 'order_update' && n.payload?.title)) && (
                                                <><strong>{n.payload?.title}</strong>{n.payload?.message && <><br />{n.payload.message}</>}</>
                                            )}
                                            {n.type === 'order_update' && !n.payload?.title && (
                                                <>Your order has been updated</>
                                            )}
                                            {!['new_bid', 'order_update', 'order_cancelled', 'auction_won', 'auction_ended', 'auction_sold', 'auction_reserve_not_met', 'auction_no_sale', 'account_violation', 'warning', 'kyc_approved', 'kyc_rejected', 'system'].includes(n.type) && (
                                                <>{n.payload?.title ? <><strong>{n.payload.title}</strong>{n.payload.message && <><br />{n.payload.message}</>}</> : n.payload?.message || 'You have a new notification'}</>
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
