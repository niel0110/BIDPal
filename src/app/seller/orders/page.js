'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Package, Truck, CheckCircle2, Clock, XCircle,
    Search, Send, AlertCircle, X, MessageSquare, Eye, Star, Receipt, Tag
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const COURIERS = ['LBC', 'J&T Express', 'Ninja Van', 'GoGo Xpress', 'Flash Express', 'Grab Express', 'Lalamove'];

const STATUS_TABS = [
    { id: 'all',             label: 'All',         icon: <Package size={16} /> },
    { id: 'pending_payment', label: 'Awaiting Pay', icon: <Clock size={16} /> },
    { id: 'processing',      label: 'To Ship',      icon: <Clock size={16} /> },
    { id: 'shipped',         label: 'Shipped',      icon: <Truck size={16} /> },
    { id: 'completed',       label: 'Completed',    icon: <CheckCircle2 size={16} /> },
    { id: 'cancelled',       label: 'Cancelled',    icon: <XCircle size={16} /> },
];

const STATUS_LABEL = {
    pending_payment: 'Awaiting Payment',
    processing:      'To Ship',
    shipped:         'Shipped',
    completed:       'Completed',
    cancelled:       'Cancelled',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SellerOrdersPage() {
    const router  = useRouter();
    const { user } = useAuth();

    const [orders, setOrders]           = useState([]);
    const [fixedListings, setFixedListings] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [activeTab, setActiveTab]     = useState('all');
    const [search, setSearch]           = useState('');

    // Confirm payment
    const handleConfirmPay = async (order) => {
        try {
            const res = await fetch(`${API_URL}/api/orders/${order.order_id}/confirm-payment`, { method: 'PUT' });
            if (res.ok) fetchOrders();
        } catch (err) {
            console.error('Confirm payment error:', err);
        }
    };

    // Ship modal
    const [shipTarget, setShipTarget] = useState(null);
    const [shipForm, setShipForm]     = useState({ courier: '', tracking_number: '' });
    const [shipping, setShipping]     = useState(false);
    const [shipError, setShipError]   = useState('');

    // Review modal (read-only view for seller)
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviews, setReviews]           = useState({}); // { order_id: review }

    const fetchOrders = useCallback(async () => {
        if (!user) return;

        // seller_id may be missing from old localStorage session — resolve it if needed
        let sellerId = user.seller_id;
        if (!sellerId) {
            try {
                const res = await fetch(`${API_URL}/api/seller/user/${user.user_id}`);
                if (res.ok) {
                    const data = await res.json();
                    sellerId = data.seller_id;
                }
            } catch { /* ignore */ }
        }
        if (!sellerId) { setLoading(false); return; }

        try {
            const [ordersRes, fixedRes] = await Promise.all([
                fetch(`${API_URL}/api/orders/seller/${sellerId}`),
                fetch(`${API_URL}/api/auctions?sale_type=sale&seller_id=${sellerId}&limit=50`),
            ]);
            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (fixedRes.ok) {
                const fixedData = await fixedRes.json();
                setFixedListings(fixedData.data || []);
            }
        } catch (err) {
            console.error('Error fetching seller orders:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Load reviews for completed orders
    useEffect(() => {
        const load = async () => {
            const done = orders.filter(o => o.status === 'completed');
            if (!done.length) return;
            const map = {};
            await Promise.all(done.map(async o => {
                try {
                    const res = await fetch(`${API_URL}/api/reviews/order/${o.order_id}`);
                    if (res.ok) map[o.order_id] = await res.json();
                } catch { /* ignore */ }
            }));
            setReviews(map);
        };
        load();
    }, [orders]);

    const filtered = orders.filter(o => {
        if (activeTab !== 'all' && o.status !== activeTab) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                o.order_id?.toLowerCase().includes(q) ||
                o.product?.name?.toLowerCase().includes(q) ||
                o.buyer?.name?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const counts = {
        all:             orders.length,
        pending_payment: orders.filter(o => o.status === 'pending_payment').length,
        processing:      orders.filter(o => o.status === 'processing').length,
        shipped:         orders.filter(o => o.status === 'shipped').length,
        completed:       orders.filter(o => o.status === 'completed').length,
        cancelled:       orders.filter(o => o.status === 'cancelled').length,
    };

    // ── Ship order ──
    const openShipModal = (order) => {
        setShipTarget(order);
        setShipForm({ courier: '', tracking_number: '' });
        setShipError('');
    };

    const handleShip = async (e) => {
        e.preventDefault();
        if (!shipForm.courier || !shipForm.tracking_number.trim()) {
            setShipError('Select a courier and enter a tracking number.');
            return;
        }
        setShipping(true);
        try {
            const res = await fetch(`${API_URL}/api/orders/${shipTarget.order_id}/ship`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courier: shipForm.courier,
                    tracking_number: shipForm.tracking_number.trim()
                })
            });
            const data = await res.json();
            if (res.ok) {
                setShipTarget(null);
                fetchOrders();
            } else {
                setShipError(data.error || 'Failed to mark as shipped.');
            }
        } catch {
            setShipError('Network error. Please try again.');
        } finally {
            setShipping(false);
        }
    };

    if (loading) return <BIDPalLoader />;

    return (
        <div className={styles.page}>

            {/* ── Page header ── */}
            <div className={styles.pageHeader}>
                <BackButton label="Back" />
                <div className={styles.titleRow}>
                    <h1>Orders</h1>
                    <div className={styles.searchBar}>
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search by order, product, or buyer…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Fixed Price Listings ── */}
            {fixedListings.length > 0 && (
                <div className={styles.fixedSection}>
                    <div className={styles.fixedSectionHeader}>
                        <Tag size={16} />
                        <h2>Fixed Price Listings</h2>
                        <span className={styles.fixedCount}>{fixedListings.length}</span>
                    </div>
                    <div className={styles.fixedGrid}>
                        {fixedListings.map(item => (
                            <div key={item.id} className={styles.fixedCard}>
                                <img
                                    src={item.images?.[0] || 'https://placehold.co/72x72?text=No+Image'}
                                    alt={item.title}
                                    className={styles.fixedCardImg}
                                />
                                <div className={styles.fixedCardInfo}>
                                    <p className={styles.fixedCardName}>{item.title}</p>
                                    <p className={styles.fixedCardPrice}>₱{Number(item.price || 0).toLocaleString('en-PH')}</p>
                                    <span className={styles.fixedCardBadge}>For Sale</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className={styles.tabs}>
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        {tab.label}
                        {counts[tab.id] > 0 && (
                            <span className={styles.badge}>{counts[tab.id]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── List ── */}
            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <Package size={52} strokeWidth={1} />
                    <p>No orders found</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {filtered.map(order => (
                        <OrderCard
                            key={order.order_id}
                            order={order}
                            review={reviews[order.order_id] ?? undefined}
                            onConfirmPay={() => handleConfirmPay(order)}
                            onShip={() => openShipModal(order)}
                            onManage={() => router.push(`/seller/orders/${order.order_id}`)}
                            onContact={() => router.push(`/messages?receiverId=${order.buyer?.user_id}`)}
                            onViewAuction={() => router.push(`/seller/auctions/${order.auction_id}/results`)}
                            onViewReview={() => setReviewTarget({ order, review: reviews[order.order_id] })}
                            onViewReceipt={() => router.push(`/orders/receipt/${order.order_id}`)}
                        />
                    ))}
                </div>
            )}

            {/* ── Ship Modal ── */}
            {shipTarget && (
                <div className={styles.overlay} onClick={() => setShipTarget(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>

                        <div className={styles.modalHead}>
                            <Truck size={20} className={styles.modalIconShip} />
                            <h3>Mark as Shipped</h3>
                            <button className={styles.modalClose} onClick={() => setShipTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalProduct}>
                            <img
                                src={shipTarget.product?.image || 'https://placehold.co/56x56?text=Item'}
                                alt={shipTarget.product?.name}
                            />
                            <div>
                                <p className={styles.modalProductName}>{shipTarget.product?.name}</p>
                                <p className={styles.modalBuyer}>To: {shipTarget.buyer?.name || 'Buyer'}</p>
                            </div>
                            <div className={styles.modalAmount}>
                                ₱{(shipTarget.total_amount || 0).toLocaleString('en-PH')}
                            </div>
                        </div>

                        <form className={styles.shipForm} onSubmit={handleShip}>
                            <div className={styles.formGroup}>
                                <label>Courier</label>
                                <select
                                    value={shipForm.courier}
                                    onChange={e => setShipForm(f => ({ ...f, courier: e.target.value }))}
                                    required
                                >
                                    <option value="">Select courier…</option>
                                    {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Tracking Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1234567890AB"
                                    value={shipForm.tracking_number}
                                    onChange={e => setShipForm(f => ({ ...f, tracking_number: e.target.value }))}
                                    required
                                />
                            </div>
                            {shipError && (
                                <div className={styles.shipError}>
                                    <AlertCircle size={14} /> {shipError}
                                </div>
                            )}
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setShipTarget(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.confirmBtn} disabled={shipping}>
                                    <Send size={16} />
                                    {shipping ? 'Submitting…' : 'Confirm Shipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Review View Modal (seller reads buyer's review) ── */}
            {reviewTarget && (
                <div className={styles.overlay} onClick={() => setReviewTarget(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHead}>
                            <Star size={20} className={styles.modalIconReview} />
                            <h3>Buyer Review</h3>
                            <button className={styles.modalClose} onClick={() => setReviewTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.reviewBody}>
                            <div className={styles.modalProduct}>
                                <img
                                    src={reviewTarget.order.product?.image || 'https://placehold.co/56x56?text=Item'}
                                    alt={reviewTarget.order.product?.name}
                                />
                                <div>
                                    <p className={styles.modalProductName}>{reviewTarget.order.product?.name}</p>
                                    <p className={styles.modalBuyer}>From: {reviewTarget.order.buyer?.name || 'Buyer'}</p>
                                </div>
                            </div>

                            <div className={styles.reviewStars}>
                                {[1,2,3,4,5].map(s => (
                                    <Star
                                        key={s}
                                        size={28}
                                        fill={s <= reviewTarget.review.rating ? '#f59e0b' : 'none'}
                                        stroke={s <= reviewTarget.review.rating ? '#f59e0b' : '#d1d5db'}
                                    />
                                ))}
                                <span className={styles.reviewRatingNum}>{reviewTarget.review.rating}/5</span>
                            </div>

                            {reviewTarget.review.comment ? (
                                <p className={styles.reviewComment}>"{reviewTarget.review.comment}"</p>
                            ) : (
                                <p className={styles.reviewNoComment}>No written comment.</p>
                            )}

                            <p className={styles.reviewDate}>
                                {new Date(reviewTarget.review.created_at).toLocaleDateString('en-US', {
                                    month: 'long', day: 'numeric', year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Step progress mini-bar ── */
const FLOW_STEPS = ['Payment', 'Confirmed', 'Shipped', 'Delivered'];
function getFlowStep(order) {
    if (order.status === 'completed')  return 3;
    if (order.status === 'shipped')    return 2;
    if (order.status === 'processing' && order.payment_confirmed) return 1;
    if (order.status === 'processing') return 0;
    return -1;
}

/* ── Next-action banner ── */
function ActionBanner({ order, onConfirmPay, onShip }) {
    const { status, payment_confirmed, payment_deadline } = order;

    if (status === 'pending_payment') {
        const deadline = payment_deadline ? new Date(payment_deadline) : null;
        const hoursLeft = deadline ? Math.max(0, Math.floor((deadline - Date.now()) / 36e5)) : null;
        return (
            <div className={`${styles.actionBanner} ${styles.bannerWaiting}`}>
                <Clock size={15} />
                <span>
                    <strong>Awaiting payment</strong> from buyer.
                    {hoursLeft !== null && <> {hoursLeft}h left to pay.</>}
                </span>
            </div>
        );
    }
    if (status === 'processing' && !payment_confirmed) {
        return (
            <div className={`${styles.actionBanner} ${styles.bannerPay}`}>
                <AlertCircle size={15} />
                <span>
                    <strong>Action needed:</strong> Buyer has paid.
                    {order.payment_reference && (
                        <> Ref: <strong>{order.payment_reference}</strong>.</>
                    )}
                    {' '}Confirm you received the payment to unlock shipping.
                </span>
                <button className={styles.confirmPayBtn} onClick={onConfirmPay}>
                    <CheckCircle2 size={14} /> Confirm Payment
                </button>
            </div>
        );
    }
    if (status === 'processing' && payment_confirmed) {
        return (
            <div className={`${styles.actionBanner} ${styles.bannerShip}`}>
                <Package size={15} />
                <span><strong>Ready to ship:</strong> Payment confirmed. Enter tracking info and mark as shipped.</span>
                <button className={styles.shipBtn} onClick={onShip}>
                    <Truck size={14} /> Mark as Shipped
                </button>
            </div>
        );
    }
    if (status === 'shipped') {
        return (
            <div className={`${styles.actionBanner} ${styles.bannerTransit}`}>
                <Truck size={15} />
                <span>Package in transit — waiting for buyer to confirm delivery.</span>
            </div>
        );
    }
    return null;
}

/* ─────────────────────── Order Card ─────────────────────── */
function OrderCard({ order, review, onConfirmPay, onShip, onManage, onContact, onViewAuction, onViewReview, onViewReceipt }) {
    const status = order.status;
    const flowStep = getFlowStep(order);
    const isCancelled = status === 'cancelled';
    const isPending = status === 'pending_payment';

    return (
        <div className={`${styles.card} ${styles[`card_${status}`]}`}>

            {/* ── Product strip ── */}
            <div className={styles.cardHead}>
                <div className={styles.cardHeadLeft}>
                    <img
                        src={order.product?.image || 'https://placehold.co/72x72?text=Item'}
                        alt={order.product?.name}
                        className={styles.productThumb}
                    />
                    <div>
                        <p className={styles.productName}>{order.product?.name || 'Auction Item'}</p>
                        <p className={styles.orderId}>#{order.order_id?.slice(0, 8).toUpperCase()}</p>
                    </div>
                </div>
                <span className={`${styles.statusBadge} ${styles[`badge_${status}`]}`}>
                    {STATUS_LABEL[status] || status}
                </span>
            </div>

            {/* ── Card body ── */}
            <div className={styles.cardBody}>

                {/* Step progress bar */}
                {!isCancelled && !isPending && (
                    <div className={styles.stepBar}>
                        {FLOW_STEPS.map((label, i) => (
                            <div key={label} className={styles.stepBarItem}>
                                <div className={`${styles.stepBarDot}
                                    ${i <= flowStep ? styles.stepBarDotDone : ''}
                                    ${i === flowStep ? styles.stepBarDotCurrent : ''}`}
                                />
                                <span className={`${styles.stepBarLabel} ${i <= flowStep ? styles.stepBarLabelDone : ''}`}>
                                    {label}
                                </span>
                                {i < FLOW_STEPS.length - 1 && (
                                    <div className={`${styles.stepBarLine} ${i < flowStep ? styles.stepBarLineDone : ''}`} />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Action banner */}
                {!isCancelled && (
                    <ActionBanner order={order} onConfirmPay={onConfirmPay} onShip={onShip} />
                )}

                {/* Meta grid */}
                <div className={styles.cardMeta}>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Buyer</span>
                        <span className={styles.metaValue}>{order.buyer?.name || '—'}</span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Payment</span>
                        <span className={styles.metaValue}>
                            {order.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' : order.payment_method || '—'}
                        </span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Total</span>
                        <span className={`${styles.metaValue} ${styles.amount}`}>
                            ₱{(order.total_amount || 0).toLocaleString('en-PH')}
                        </span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Date</span>
                        <span className={styles.metaValue}>
                            {order.placed_at
                                ? new Date(order.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                        </span>
                    </div>
                </div>

                {/* Tracking */}
                {(status === 'shipped' || status === 'completed') && order.tracking_number && (
                    <div className={styles.trackingRow}>
                        <Truck size={15} />
                        <span><strong>{order.courier}</strong> · <span className={styles.trackingNum}>{order.tracking_number}</span></span>
                    </div>
                )}

                {/* Review */}
                {status === 'completed' && review && (
                    <div className={styles.reviewRow}>
                        <div className={styles.reviewStarsMini}>
                            {[1,2,3,4,5].map(s => (
                                <Star key={s} size={13}
                                    fill={s <= review.rating ? '#f59e0b' : 'none'}
                                    stroke={s <= review.rating ? '#f59e0b' : '#d1d5db'}
                                />
                            ))}
                        </div>
                        <span className={styles.reviewSnippet}>
                            {review.comment ? `"${review.comment.slice(0, 60)}${review.comment.length > 60 ? '…' : ''}"` : 'No comment'}
                        </span>
                        <button className={styles.viewReviewBtn} onClick={onViewReview}>Read</button>
                    </div>
                )}
                {status === 'completed' && !review && (
                    <div className={styles.noReviewChip}><Star size={13}/> No review yet</div>
                )}

                {/* Actions */}
                <div className={styles.cardActions}>
                    <button className={styles.manageBtn} onClick={onManage}>
                        <Eye size={15} /> Manage Order
                    </button>
                    <button className={styles.msgBtn} onClick={onContact}>
                        <MessageSquare size={15} /> Message Buyer
                    </button>
                    <button className={styles.viewBtn} onClick={onViewAuction}>
                        <Eye size={15} /> Auction
                    </button>
                    {(status === 'processing' || status === 'shipped' || status === 'completed') && (
                        <button className={styles.receiptBtn} onClick={onViewReceipt}>
                            <Receipt size={15} /> Receipt
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
