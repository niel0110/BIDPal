'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Package, Truck, CreditCard, Clock, CheckCircle2, XCircle, Loader2, Gavel, Ban, MapPin, Star, X, MessageCircle, Receipt } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import PaymentCountdown from '@/components/PaymentCountdown';
import CancellationModal from '@/components/CancellationModal';
import styles from './page.module.css';

export default function OrdersPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentWindows, setPaymentWindows] = useState({});
    const [expiredWindows, setExpiredWindows] = useState(new Set());
    const [cancellationLimit, setCancellationLimit] = useState(null);
    const [violationRecord, setViolationRecord] = useState(null);
    const [cancellingOrder, setCancellingOrder] = useState(null);
    const [showCancellationModal, setShowCancellationModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState(null);

    // Review state
    const [reviewTarget, setReviewTarget] = useState(null);   // order being reviewed
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewHover, setReviewHover] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [existingReviews, setExistingReviews] = useState({}); // { order_id: review }
    const [viewReviewTarget, setViewReviewTarget] = useState(null); // { order, review }
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    const tabs = [
        { id: 'all', label: 'All', icon: <Package size={18} /> },
        { id: 'pay', label: 'To Pay', icon: <CreditCard size={18} /> },
        { id: 'ship', label: 'To Ship', icon: <Clock size={18} /> },
        { id: 'receive', label: 'To Receive', icon: <Truck size={18} /> },
        { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={18} /> },
        { id: 'cancelled', label: 'Cancelled', icon: <XCircle size={18} /> },
    ];

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/orders/user/${user.user_id}`);
            if (res.ok) {
                setOrders(await res.json());
            }
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchOrders();
        } else {
            setLoading(false);
        }
    }, [user, fetchOrders]);

    const filteredOrders = orders.filter(order => {
        // Map new status format to tab filter
        let tabStatus = order.status;
        if (order.status === 'pending_payment') tabStatus = 'pay';
        if (order.status === 'processing') tabStatus = 'ship';
        if (order.status === 'shipped') tabStatus = 'receive';

        if (activeTab !== 'all' && tabStatus !== activeTab) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const idMatch = order.id.toLowerCase().includes(query);
            const itemMatch = order.items?.some(item => item.name.toLowerCase().includes(query));
            if (!idMatch && !itemMatch) return false;
        }
        return true;
    });

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending_payment': return 'To Pay';
            case 'pay': return 'To Pay';
            case 'processing': return 'To Ship';
            case 'ship': return 'To Ship';
            case 'shipped': return 'To Receive';
            case 'receive': return 'To Receive';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            default: return 'Processing';
        }
    };

    // Fetch cancellation limit + violation record together
    useEffect(() => {
        const fetchViolationData = async () => {
            if (!user) return;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            try {
                const [limitRes, recordRes] = await Promise.all([
                    fetch(`${apiUrl}/api/violations/user/${user.user_id}/cancellation-limit`),
                    fetch(`${apiUrl}/api/violations/user/${user.user_id}/record`)
                ]);
                if (limitRes.ok) setCancellationLimit(await limitRes.json());
                if (recordRes.ok) setViolationRecord(await recordRes.json());
            } catch (err) {
                console.error('Error fetching violation data:', err);
            }
        };
        fetchViolationData();
    }, [user]);

    // Build payment deadlines for pending auction orders
    // Prefer payment_deadline from the API (Payment_Windows table);
    // fall back to placed_at_raw + 24h if no window record exists yet
    useEffect(() => {
        const pending = orders.filter(o => o.order_type === 'auction' && o.status === 'pending_payment');
        if (!pending.length) return;
        const windows = {};
        for (const order of pending) {
            if (order.payment_deadline) {
                windows[order.id] = order.payment_deadline;
            } else if (order.placed_at_raw) {
                const base = new Date(order.placed_at_raw);
                base.setHours(base.getHours() + 24);
                windows[order.id] = base.toISOString();
            }
        }
        setPaymentWindows(windows);
    }, [orders]);

    // Fetch existing reviews for completed orders from Supabase
    useEffect(() => {
        const fetchReviews = async () => {
            const completedOrders = orders.filter(o => o.status === 'completed');
            if (!completedOrders.length) return;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const map = {};
            await Promise.all(completedOrders.map(async (order) => {
                try {
                    const res = await fetch(`${apiUrl}/api/reviews/order/${order.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        map[order.id] = data; // null = no review yet, object = reviewed
                    }
                } catch { /* ignore */ }
            }));
            setExistingReviews(map);
        };
        fetchReviews();
    }, [orders]);

    const openReviewModal = (order) => {
        setReviewTarget(order);
        setReviewRating(0);
        setReviewHover(0);
        setReviewComment('');
        setReviewError('');
    };

    const handleSubmitReview = async () => {
        if (!reviewRating) { setReviewError('Please select a star rating.'); return; }
        if (!user || !reviewTarget) return;
        setReviewSubmitting(true);
        setReviewError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            // Fetch seller_id from auction
            const sellerRes = await fetch(`${apiUrl}/api/orders/auction/${reviewTarget.auction_id}/seller`);
            if (!sellerRes.ok) throw new Error('Could not find seller info');
            const sellerData = await sellerRes.json();

            const res = await fetch(`${apiUrl}/api/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: reviewTarget.id,
                    seller_id: sellerData.seller_id,
                    user_id: user.user_id,
                    rating: reviewRating,
                    comment: reviewComment.trim() || null
                })
            });
            const data = await res.json();
            if (res.ok) {
                const review = data.review || { rating: reviewRating, comment: reviewComment.trim() || null };
                setExistingReviews(prev => ({ ...prev, [reviewTarget.id]: review }));
                setReviewTarget(null);
            } else if (res.status === 409) {
                // Already in DB — re-fetch the saved review from Supabase
                try {
                    const existing = await fetch(`${apiUrl}/api/reviews/order/${reviewTarget.id}`);
                    const existingData = existing.ok ? await existing.json() : null;
                    setExistingReviews(prev => ({ ...prev, [reviewTarget.id]: existingData || { rating: reviewRating } }));
                } catch {
                    setExistingReviews(prev => ({ ...prev, [reviewTarget.id]: { rating: reviewRating } }));
                }
                setReviewTarget(null);
            } else {
                setReviewError(data.error || 'Failed to submit review.');
            }
        } catch (err) {
            setReviewError(err.message);
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleCancelOrder = (order) => {
        if (!user) return;

        // Check cancellation limit
        if (!cancellationLimit) {
            alert('Unable to check cancellation eligibility. Please try again.');
            return;
        }

        // Open modal
        setOrderToCancel(order);
        setShowCancellationModal(true);
    };

    const confirmCancellation = async (reason) => {
        if (!orderToCancel || !user) return;

        setCancellingOrder(orderToCancel.id);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/violations/cancel-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.user_id,
                    auction_id: orderToCancel.auction_id,
                    order_id: orderToCancel.id,
                    reason
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Optimistically mark as cancelled so the order disappears from "To Pay" immediately
                setOrders(prev => prev.map(o =>
                    o.id === orderToCancel.id ? { ...o, status: 'cancelled' } : o
                ));
                setShowCancellationModal(false);
                setOrderToCancel(null);
                setActiveTab('cancelled');
                setActionSuccess('Order cancelled successfully. The next eligible bidder has been notified.');
                setTimeout(() => setActionSuccess(''), 5000);
                // Delay refetch so DB has time to commit winner_user_id = null before we re-query
                setTimeout(() => fetchOrders(), 1500);
                const [limitRes, recordRes] = await Promise.all([
                    fetch(`${apiUrl}/api/violations/user/${user.user_id}/cancellation-limit`),
                    fetch(`${apiUrl}/api/violations/user/${user.user_id}/record`)
                ]);
                if (limitRes.ok) setCancellationLimit(await limitRes.json());
                if (recordRes.ok) setViolationRecord(await recordRes.json());
            } else {
                setActionError(data.error || 'Failed to cancel order.');
            }
        } catch (err) {
            setActionError('Network error. Please try again.');
        } finally {
            setCancellingOrder(null);
        }
    };

    const handlePayNow = (order) => {
        if (!order.auction_id) return;
        // Redirect to checkout page with auction_id
        router.push(`/checkout?auction_id=${order.auction_id}`);
    };

    const handleConfirmDelivery = async (order) => {
        if (!user) return;
        setActionError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/orders/${order.id}/confirm-delivery`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id })
            });
            if (res.ok) {
                fetchOrders();
            } else {
                const data = await res.json();
                setActionError(data.error || 'Failed to confirm delivery.');
            }
        } catch (err) {
            setActionError('Network error. Please try again.');
        }
    };

    const handleContactSeller = async (order) => {
        if (!order.auction_id) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/orders/auction/${order.auction_id}/seller`);

            if (res.ok) {
                const sellerData = await res.json();
                // Redirect to existing messages page with seller's user_id
                router.push(`/messages?receiverId=${sellerData.seller_user_id}`);
            } else {
                alert('Could not fetch seller information');
            }
        } catch (err) {
            console.error('Error fetching seller:', err);
            alert('Error contacting seller. Please try again.');
        }
    };

    if (loading) return <BIDPalLoader />;

    if (!user) return (
        <div className={styles.ordersContainer}>
            <div className={styles.emptyState}>
                <h2>Please sign in</h2>
                <p>You need to be logged in to view your orders.</p>
                <Link href="/" className={styles.exploreBtn}>Go to Login</Link>
            </div>
        </div>
    );

    return (
        <div className={styles.ordersContainer}>
            <div className={styles.ordersContent}>
                <header className={styles.ordersHeader}>
                    <div className={styles.headerBack}>
                        <BackButton label="Back" />
                    </div>
                    <div className={styles.titleRow}>
                        <h1>My Orders</h1>
                        <div className={styles.searchBar}>
                            <Search size={18} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search by Order ID or Product Name"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </header>

                <nav className={styles.tabsNav}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.tabItem} ${activeTab === tab.id ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className={styles.tabIcon}>{tab.icon}</span>
                            <span className={styles.tabLabel}>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {actionSuccess && (
                    <div className={styles.actionSuccessBanner} onClick={() => setActionSuccess('')}>
                        <CheckCircle2 size={16} /> {actionSuccess}
                    </div>
                )}
                {actionError && (
                    <div className={styles.actionErrorBanner} onClick={() => setActionError('')}>
                        <XCircle size={16} /> {actionError}
                    </div>
                )}

                <div className={styles.ordersList}>
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map(order => (
                            <div key={order.id} className={styles.orderCard}>
                                <div className={styles.orderCardHeader}>
                                    <div className={styles.sellerInfo}>
                                        {order.order_type === 'auction' ? (
                                            <>
                                                <Gavel size={16} color={order.is_cascaded ? '#0369a1' : '#673AB7'} />
                                                <span className={order.is_cascaded ? styles.cascadedBadge : styles.auctionBadge}>
                                                    {order.is_cascaded ? 'Next Winner' : 'Auction Win'}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Package size={16} color="#666" />
                                                <span>{order.seller}</span>
                                            </>
                                        )}
                                    </div>
                                    <div className={`${styles.statusBadge} ${styles[order.status]}`}>
                                        {getStatusLabel(order.status)}
                                    </div>
                                </div>

                                {order.is_cascaded && order.status === 'pending_payment' && (
                                    <div className={styles.cascadedNotice}>
                                        The previous winner cancelled — you are now the winning bidder. Please pay or cancel within 24 hours.
                                    </div>
                                )}

                                <div className={styles.orderItems}>
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className={styles.orderItem}>
                                            <div className={styles.itemImage}>
                                                <img src={item.image || 'https://placehold.co/200x200?text=No+Image'} alt={item.name} />
                                            </div>
                                            <div className={styles.itemMeta}>
                                                <h3>{item.name}</h3>
                                                <p>Qty: {item.qty}</p>
                                            </div>
                                            <div className={styles.itemPrice}>
                                                ₱ {item.price.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.orderCardFooter}>
                                    <div className={styles.orderMeta}>
                                        <span className={styles.orderId}>ID: {order.id.slice(0, 8)}...</span>
                                        <span className={styles.orderDate}>{order.date}</span>
                                    </div>
                                    <div className={styles.orderTotal}>
                                        <span>Order Total:</span>
                                        <span className={styles.totalAmount}>₱ {order.total.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Payment Countdown for auction wins pending payment */}
                                {order.status === 'pending_payment' && order.order_type === 'auction' && paymentWindows[order.id] && (
                                    <div className={styles.countdownSection}>
                                        <PaymentCountdown
                                            deadline={paymentWindows[order.id]}
                                            onExpired={async () => {
                                                setExpiredWindows(prev => new Set(prev).add(order.id));
                                                try {
                                                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                                                    await fetch(`${apiUrl}/api/violations/expire-payment`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            user_id: user.user_id,
                                                            auction_id: order.auction_id,
                                                            order_id: order.id
                                                        })
                                                    });
                                                } catch (err) {
                                                    console.error('Failed to expire payment window:', err);
                                                } finally {
                                                    fetchOrders();
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Cancelled state notice — only show if not shipped/delivered */}
                                {order.status === 'cancelled' && !order.tracking_number && (
                                    <div className={styles.cancelledNotice}>
                                        <XCircle size={14} />
                                        <span>Order cancelled by buyer</span>
                                    </div>
                                )}

                                {/* Tracking Info (shipped orders) */}
                                {order.status === 'shipped' && order.tracking_number && (
                                    <div className={styles.trackingBanner}>
                                        <Truck size={16} />
                                        <span>
                                            <strong>{order.courier}</strong> — Tracking #: <span className={styles.trackingNum}>{order.tracking_number}</span>
                                        </span>
                                        <MapPin size={14} className={styles.trackingPin} />
                                    </div>
                                )}

                                <div className={styles.orderActions}>
                                    {order.status === 'pending_payment' && order.order_type === 'auction' ? (
                                        <>
                                            {!expiredWindows.has(order.id) && (
                                                <button
                                                    className={styles.payNowBtn}
                                                    onClick={() => handlePayNow(order)}
                                                >
                                                    Pay Now
                                                </button>
                                            )}
                                            {!expiredWindows.has(order.id) && (
                                                <button
                                                    className={styles.cancelBtn}
                                                    onClick={() => handleCancelOrder(order)}
                                                    disabled={cancellingOrder === order.id}
                                                >
                                                    {cancellingOrder === order.id ? (
                                                        <>
                                                            <Loader2 className={styles.spin} size={16} />
                                                            <span>Cancelling...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Ban size={16} />
                                                            <span>Cancel Order</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    ) : order.status === 'shipped' ? (
                                        <button
                                            className={styles.receivedBtn}
                                            onClick={() => handleConfirmDelivery(order)}
                                        >
                                            <CheckCircle2 size={16} />
                                            Order Received
                                        </button>
                                    ) : order.status === 'completed' ? (
                                        <>
                                            {existingReviews[order.id] ? (
                                                <button
                                                    className={styles.viewReviewBtn}
                                                    onClick={() => setViewReviewTarget({ order, review: existingReviews[order.id] })}
                                                >
                                                    <Star size={13} fill="#FBC02D" stroke="#FBC02D" />
                                                    Reviewed
                                                </button>
                                            ) : (
                                                <button className={styles.reviewBtn} onClick={() => openReviewModal(order)}>
                                                    <Star size={15} />
                                                    Leave a Review
                                                </button>
                                            )}
                                            <button className={styles.receiptBtn} onClick={() => router.push(`/orders/receipt/${order.id}`)}>
                                                <Receipt size={14} />
                                                View Receipt
                                            </button>
                                        </>
                                    ) : order.status === 'cancelled' ? null : order.status === 'processing' || order.status === 'shipped' ? (
                                        <button className={styles.receiptBtn} onClick={() => router.push(`/orders/receipt/${order.id}`)}>
                                            <Receipt size={14} />
                                            View Receipt
                                        </button>
                                    ) : (
                                        <button className={styles.secondaryBtn}>Order Details</button>
                                    )}
                                    {order.order_type === 'auction' && order.status !== 'cancelled' && (
                                        <button
                                            className={styles.primaryBtn}
                                            onClick={() => handleContactSeller(order)}
                                        >
                                            <MessageCircle size={14} />
                                            Contact Seller
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            <Package size={64} color="#ddd" strokeWidth={1} />
                            <h2>No orders found</h2>
                            <p>Try switching tabs or searching for something else.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* View Review Popup */}
            {viewReviewTarget && (
                <div className={styles.modalOverlay} onClick={() => setViewReviewTarget(null)}>
                    <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.reviewModalHead}>
                            <h3>Your Review</h3>
                            <button className={styles.reviewModalClose} onClick={() => setViewReviewTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.reviewModalBody}>
                            <div className={styles.reviewProduct}>
                                <img
                                    src={viewReviewTarget.order.items[0]?.image || 'https://placehold.co/52x52?text=Item'}
                                    alt={viewReviewTarget.order.items[0]?.name}
                                />
                                <div>
                                    <p className={styles.reviewProductName}>{viewReviewTarget.order.items[0]?.name}</p>
                                    <p className={styles.reviewProductSub}>Auction Win</p>
                                </div>
                            </div>
                            <div className={styles.viewReviewRating}>
                                <span className={styles.starLabel}>Your rating</span>
                                <div className={styles.viewReviewStars}>
                                    {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={20}
                                            fill={s <= viewReviewTarget.review.rating ? '#f59e0b' : 'none'}
                                            stroke={s <= viewReviewTarget.review.rating ? '#f59e0b' : '#d1d5db'}
                                        />
                                    ))}
                                    <span className={styles.ratingLabel}>
                                        {['','Poor','Fair','Good','Very Good','Excellent'][viewReviewTarget.review.rating]}
                                    </span>
                                </div>
                            </div>
                            {viewReviewTarget.review.comment ? (
                                <div className={styles.viewReviewComment}>
                                    <span className={styles.starLabel}>Your comment</span>
                                    <p>{viewReviewTarget.review.comment}</p>
                                </div>
                            ) : (
                                <p className={styles.viewReviewNoComment}>No comment was left.</p>
                            )}
                            {viewReviewTarget.review.created_at && (
                                <p className={styles.viewReviewDate}>
                                    Submitted on {new Date(viewReviewTarget.review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            )}
                        </div>
                        <div className={styles.reviewModalFoot}>
                            <button className={styles.reviewSubmitBtn} onClick={() => setViewReviewTarget(null)}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewTarget && (
                <div className={styles.modalOverlay} onClick={() => setReviewTarget(null)}>
                    <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.reviewModalHead}>
                            <Star size={20} className={styles.reviewModalIcon} />
                            <h3>Leave a Review</h3>
                            <button className={styles.reviewModalClose} onClick={() => setReviewTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.reviewModalBody}>
                            {/* Product */}
                            <div className={styles.reviewProduct}>
                                <img
                                    src={reviewTarget.items[0]?.image || 'https://placehold.co/52x52?text=Item'}
                                    alt={reviewTarget.items[0]?.name}
                                />
                                <div>
                                    <p className={styles.reviewProductName}>{reviewTarget.items[0]?.name}</p>
                                    <p className={styles.reviewProductSub}>Auction Win</p>
                                </div>
                            </div>

                            {/* Star selector */}
                            <div className={styles.starRow}>
                                <span className={styles.starLabel}>Your rating</span>
                                <div className={styles.stars}>
                                    {[1,2,3,4,5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            className={styles.starBtn}
                                            onMouseEnter={() => setReviewHover(star)}
                                            onMouseLeave={() => setReviewHover(0)}
                                            onClick={() => setReviewRating(star)}
                                        >
                                            <Star
                                                size={32}
                                                fill={(reviewHover || reviewRating) >= star ? '#f59e0b' : 'none'}
                                                stroke={(reviewHover || reviewRating) >= star ? '#f59e0b' : '#d1d5db'}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {reviewRating > 0 && (
                                    <span className={styles.ratingLabel}>
                                        {['','Poor','Fair','Good','Very Good','Excellent'][reviewRating]}
                                    </span>
                                )}
                            </div>

                            {/* Comment */}
                            <div className={styles.reviewCommentGroup}>
                                <label>Comments <span>(optional)</span></label>
                                <textarea
                                    rows={4}
                                    placeholder="Share your experience with this seller and product..."
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    maxLength={500}
                                />
                                <span className={styles.charCount}>{reviewComment.length}/500</span>
                            </div>

                            {reviewError && (
                                <div className={styles.reviewError}>
                                    <XCircle size={14} /> {reviewError}
                                </div>
                            )}
                        </div>

                        <div className={styles.reviewModalFoot}>
                            <button className={styles.reviewCancelBtn} onClick={() => setReviewTarget(null)}>
                                Cancel
                            </button>
                            <button
                                className={styles.reviewSubmitBtn}
                                onClick={handleSubmitReview}
                                disabled={reviewSubmitting || !reviewRating}
                            >
                                {reviewSubmitting ? (
                                    <><Loader2 size={15} className={styles.spin} /> Submitting...</>
                                ) : (
                                    <><Star size={15} /> Submit Review</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancellation Modal */}
            <CancellationModal
                isOpen={showCancellationModal}
                onClose={() => {
                    setShowCancellationModal(false);
                    setOrderToCancel(null);
                }}
                onConfirm={confirmCancellation}
                orderDetails={orderToCancel ? {
                    name: orderToCancel.items[0]?.name,
                    total: orderToCancel.total,
                    image: orderToCancel.items[0]?.image
                } : null}
                cancellationLimit={cancellationLimit}
                violationRecord={violationRecord}
            />
        </div>
    );
}
