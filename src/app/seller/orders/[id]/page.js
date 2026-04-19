'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Package, Truck, CheckCircle2, Clock, XCircle,
    User, CreditCard, MapPin, Star, Send, AlertCircle, X,
    MessageSquare, ExternalLink, DollarSign
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const COURIERS = ['LBC', 'J&T Express', 'Ninja Van', 'GoGo Xpress', 'Flash Express', 'Grab Express', 'Lalamove'];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/* ── Status helpers ── */
const STEPS = [
    { key: 'paid',      label: 'Payment Received', icon: DollarSign },
    { key: 'prepare',   label: 'Preparing Item',   icon: Package },
    { key: 'shipped',   label: 'Shipped',          icon: Truck },
    { key: 'delivered', label: 'Delivered',        icon: CheckCircle2 },
];

function getStepIndex(status) {
    if (status === 'processing') return 1;
    if (status === 'shipped')    return 2;
    if (status === 'completed')  return 3;
    return 0;
}

const STATUS_LABEL = {
    pending_payment: 'Pending Payment',
    processing:      'Payment Received — Ready to Ship',
    shipped:         'Shipped — Awaiting Delivery',
    completed:       'Completed',
    cancelled:       'Cancelled',
};

function formatAddress(addr) {
    if (!addr) return null;
    return [
        addr['Household/blk st.'],
        addr.Barangay,
        addr['Municipality/City'],
        addr.province,
        addr.region,
        addr['zip code']
    ].filter(Boolean).join(', ');
}

/* ══════════════════════════════════════════════ */
export default function SellerOrderDetailPage() {
    const { id: orderId } = useParams();
    const router = useRouter();
    useAuth();

    const [order, setOrder]       = useState(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);

    // Payment confirmation
    const [confirming, setConfirming]         = useState(false);
    const [confirmError, setConfirmError]     = useState('');

    // Ship form
    const [showShipForm, setShowShipForm] = useState(false);
    const [shipForm, setShipForm]         = useState({ courier: '', tracking_number: '' });
    const [shipping, setShipping]         = useState(false);
    const [shipError, setShipError]       = useState('');

    const fetchOrder = async () => {
        try {
            const res = await fetch(`${API_URL}/api/orders/seller/detail/${orderId}`);
            if (!res.ok) throw new Error('Order not found');
            setOrder(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (orderId) fetchOrder(); }, [orderId]);

    const handleConfirmPayment = async () => {
        setConfirming(true);
        setConfirmError('');
        try {
            const res = await fetch(`${API_URL}/api/orders/${orderId}/confirm-payment`, { method: 'PUT' });
            const data = await res.json();
            if (res.ok) fetchOrder();
            else setConfirmError(data.error || 'Failed to confirm payment.');
        } catch { setConfirmError('Network error. Try again.'); }
        finally { setConfirming(false); }
    };

    const handleShip = async (e) => {
        e.preventDefault();
        setShipError('');
        if (!shipForm.courier || !shipForm.tracking_number.trim()) {
            setShipError('Select a courier and enter a tracking number.');
            return;
        }
        setShipping(true);
        try {
            const res = await fetch(`${API_URL}/api/orders/${orderId}/ship`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courier: shipForm.courier, tracking_number: shipForm.tracking_number.trim() })
            });
            const data = await res.json();
            if (res.ok) { setShowShipForm(false); fetchOrder(); }
            else setShipError(data.error || 'Failed to mark as shipped.');
        } catch { setShipError('Network error. Try again.'); }
        finally { setShipping(false); }
    };

    /* ── Loading / error ── */
    if (loading) return <BIDPalLoader />;
    if (error || !order) return (
        <div className={styles.centered}>
            <AlertCircle size={40} color="#ef4444" />
            <p>{error || 'Order not found'}</p>
            <BackButton label="Back" />
        </div>
    );

    const stepIndex = getStepIndex(order.status);
    const isCancelled = order.status === 'cancelled';
    const isPending   = order.status === 'pending_payment';
    const addressStr = formatAddress(order.shipping_address);

    return (
        <div className={styles.page}>

            {/* ── Top bar ── */}
            <div className={styles.topBar}>
                <BackButton label="All Orders" />
                <div className={styles.topBarRight}>
                    <span className={`${styles.statusPill} ${styles[`pill_${order.status}`]}`}>
                        {STATUS_LABEL[order.status] || order.status}
                    </span>
                    <button
                        className={styles.iconBtn}
                        onClick={() => router.push(`/messages?receiverId=${order.buyer?.user_id}`)}
                        title="Message buyer"
                    >
                        <MessageSquare size={18} />
                    </button>
                    <button
                        className={styles.iconBtn}
                        onClick={() => router.push(`/seller/auctions/${order.auction_id}/results`)}
                        title="View auction"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>

            <h1 className={styles.pageTitle}>
                Order <span>#{(orderId?.startsWith('pending_') ? orderId.replace('pending_', '') : orderId)?.slice(0, 8).toUpperCase()}</span>
            </h1>

            <div className={styles.grid}>

                {/* ══ LEFT COLUMN ══ */}
                <div className={styles.leftCol}>

                    {/* ── Pending payment banner ── */}
                    {isPending && (
                        <section className={`${styles.card} ${styles.pendingCard}`}>
                            <Clock size={20} color="#d97706" />
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, color: '#92400e' }}>Awaiting payment from buyer</p>
                                {order.payment_deadline && (
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
                                        Deadline: {fmt(order.payment_deadline)}
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Progress timeline ── */}
                    {!isCancelled && !isPending && (
                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Order Progress</h2>
                            <div className={styles.timeline}>
                                {STEPS.map((step, i) => {
                                    const Icon = step.icon;
                                    const done    = stepIndex >= i;
                                    const current = stepIndex === i;
                                    return (
                                        <div key={step.key} className={styles.timelineItem}>
                                            <div className={styles.timelineLeft}>
                                                <div className={`${styles.stepCircle} ${done ? styles.stepDone : ''} ${current ? styles.stepCurrent : ''}`}>
                                                    {done && !current
                                                        ? <CheckCircle2 size={16} />
                                                        : <Icon size={16} />
                                                    }
                                                </div>
                                                {i < STEPS.length - 1 && (
                                                    <div className={`${styles.stepLine} ${stepIndex > i ? styles.stepLineDone : ''}`} />
                                                )}
                                            </div>
                                            <div className={styles.timelineRight}>
                                                <p className={`${styles.stepLabel} ${done ? styles.stepLabelDone : ''}`}>{step.label}</p>
                                                {/* Timestamps */}
                                                {i === 0 && order.placed_at && (
                                                    <p className={styles.stepTime}>{fmt(order.placed_at)}</p>
                                                )}
                                                {i === 2 && order.status !== 'processing' && order.tracking_number && (
                                                    <p className={styles.stepTime}>
                                                        {order.courier} · {order.tracking_number}
                                                    </p>
                                                )}
                                                {i === 3 && order.status === 'completed' && (
                                                    <p className={styles.stepTime}>Buyer confirmed receipt</p>
                                                )}
                                                {/* CTA for current step */}
                                                {current && i === 1 && !order.payment_confirmed && (
                                                    <div>
                                                        <button className={styles.ctaBtn} onClick={handleConfirmPayment} disabled={confirming}>
                                                            <CheckCircle2 size={15} /> {confirming ? 'Confirming…' : 'Confirm Payment Received'}
                                                        </button>
                                                        {confirmError && <p className={styles.shipError}><AlertCircle size={13}/> {confirmError}</p>}
                                                    </div>
                                                )}
                                                {current && i === 1 && order.payment_confirmed && !showShipForm && (
                                                    <button className={styles.ctaBtn} onClick={() => setShowShipForm(true)}>
                                                        <Truck size={15} /> Mark as Shipped
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Inline ship form ── */}
                            {showShipForm && (
                                <form className={styles.shipForm} onSubmit={handleShip}>
                                    <div className={styles.shipFormHeader}>
                                        <Truck size={18} color="#673AB7" />
                                        <h3>Enter Shipping Details</h3>
                                        <button type="button" className={styles.closeFormBtn}
                                            onClick={() => { setShowShipForm(false); setShipError(''); }}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Courier</label>
                                            <select value={shipForm.courier}
                                                onChange={e => setShipForm(f => ({ ...f, courier: e.target.value }))} required>
                                                <option value="">Select…</option>
                                                {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Tracking Number</label>
                                            <input type="text" placeholder="e.g. 1234567890AB"
                                                value={shipForm.tracking_number}
                                                onChange={e => setShipForm(f => ({ ...f, tracking_number: e.target.value }))} required />
                                        </div>
                                    </div>
                                    {shipError && <div className={styles.shipError}><AlertCircle size={14}/> {shipError}</div>}
                                    <div className={styles.shipFormActions}>
                                        <button type="button" className={styles.cancelShipBtn}
                                            onClick={() => { setShowShipForm(false); setShipError(''); }}>Cancel</button>
                                        <button type="submit" className={styles.confirmShipBtn} disabled={shipping}>
                                            <Send size={15} /> {shipping ? 'Submitting…' : 'Confirm Shipment'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Tracking info (already shipped) */}
                            {(order.status === 'shipped' || order.status === 'completed') && order.tracking_number && (
                                <div className={styles.trackingBanner}>
                                    <Truck size={16} />
                                    <div>
                                        <span className={styles.trackingCourier}>{order.courier}</span>
                                        <span className={styles.trackingNum}>{order.tracking_number}</span>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Cancelled banner */}
                    {isCancelled && (
                        <section className={`${styles.card} ${styles.cancelledCard}`}>
                            <XCircle size={20} color="#ef4444" />
                            <p>This order was cancelled.</p>
                        </section>
                    )}

                    {/* ── Product ── */}
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>Product</h2>
                        <div className={styles.productRow}>
                            <img
                                src={order.product?.image || 'https://placehold.co/80x80?text=Item'}
                                alt={order.product?.name}
                                className={styles.productImg}
                            />
                            <div className={styles.productInfo}>
                                <p className={styles.productName}>{order.product?.name}</p>
                                {order.product?.description && (
                                    <p className={styles.productDesc}>{order.product.description}</p>
                                )}
                                <button className={styles.viewAuctionLink}
                                    onClick={() => router.push(`/seller/auctions/${order.auction_id}/results`)}>
                                    View auction results <ExternalLink size={13} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── Review ── */}
                    {order.review && (
                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Buyer Review</h2>
                            <div className={styles.reviewBlock}>
                                <div className={styles.reviewStars}>
                                    {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={22}
                                            fill={s <= order.review.rating ? '#f59e0b' : 'none'}
                                            stroke={s <= order.review.rating ? '#f59e0b' : '#d1d5db'} />
                                    ))}
                                    <span className={styles.ratingText}>
                                        {['','Poor','Fair','Good','Very Good','Excellent'][order.review.rating]}
                                    </span>
                                </div>
                                {order.review.comment && (
                                    <p className={styles.reviewComment}>"{order.review.comment}"</p>
                                )}
                                <p className={styles.reviewDate}>{fmt(order.review.created_at)}</p>
                            </div>
                        </section>
                    )}
                    {order.status === 'completed' && !order.review && (
                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Buyer Review</h2>
                            <p className={styles.noReview}>The buyer hasn't left a review yet.</p>
                        </section>
                    )}
                </div>

                {/* ══ RIGHT COLUMN ══ */}
                <div className={styles.rightCol}>

                    {/* ── Transaction summary ── */}
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>Transaction Summary</h2>
                        <div className={styles.summaryRows}>
                            <div className={styles.summaryRow}>
                                <span>Winning Bid</span>
                                <span>₱{(order.winning_bid?.bid_amount ?? order.final_price ?? 0).toLocaleString('en-PH')}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Shipping Fee</span>
                                <span>₱{(order.shipping_fee || 0).toLocaleString('en-PH')}</span>
                            </div>
                            <div className={styles.divider} />
                            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                <span>Total Collected</span>
                                <span>₱{(order.total_amount || 0).toLocaleString('en-PH')}</span>
                            </div>
                        </div>
                    </section>

                    {/* ── Payment ── */}
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}><CreditCard size={16}/> Payment</h2>
                        <div className={styles.infoRows}>
                            {isPending ? (
                                <div className={styles.infoRow}>
                                    <span>Status</span>
                                    <span className={styles.pendingChip}><Clock size={13}/> Awaiting payment</span>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.infoRow}>
                                        <span>Method</span>
                                        <span>{order.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' : order.payment_method || '—'}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span>Buyer paid</span>
                                        <span className={styles.paidChip}>
                                            <CheckCircle2 size={13} /> Paid
                                        </span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span>Seller confirmed</span>
                                        {order.payment_confirmed
                                            ? <span className={styles.paidChip}><CheckCircle2 size={13}/> Confirmed {order.payment_confirmed_at ? fmt(order.payment_confirmed_at) : ''}</span>
                                            : <span className={styles.pendingChip}><Clock size={13}/> Pending confirmation</span>
                                        }
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span>Date placed</span>
                                        <span>{order.placed_at ? fmt(order.placed_at) : '—'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* ── Buyer ── */}
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}><User size={16}/> Buyer</h2>
                        <div className={styles.buyerRow}>
                            {order.buyer?.avatar
                                ? <img src={order.buyer.avatar} alt={order.buyer.name} className={styles.buyerAvatar} />
                                : <div className={styles.buyerAvatarFallback}><User size={20}/></div>
                            }
                            <div>
                                <p className={styles.buyerName}>{order.buyer?.name || 'Unknown'}</p>
                                <p className={styles.buyerEmail}>{order.buyer?.email}</p>
                            </div>
                        </div>
                        <button className={styles.msgBuyerBtn}
                            onClick={() => router.push(`/messages?receiverId=${order.buyer?.user_id}`)}>
                            <MessageSquare size={15}/> Message Buyer
                        </button>
                    </section>

                    {/* ── Shipping address ── */}
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}><MapPin size={16}/> Ship to</h2>
                        {addressStr
                            ? <p className={styles.addressText}>{addressStr}</p>
                            : <p className={styles.noReview}>No address on record.</p>
                        }
                    </section>
                </div>
            </div>
        </div>
    );
}

function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
