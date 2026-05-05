'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ChevronLeft, Trophy, Eye, Heart, Share2, Clock, User, TrendingUp,
    DollarSign, Package, Truck, CheckCircle2, MessageSquare, AlertCircle, Send,
    Calendar, X, RotateCcw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const COURIERS = ['LBC', 'J&T Express', 'Ninja Van', 'GoGo Xpress', 'Flash Express', 'Grab Express', 'Lalamove'];

export default function AuctionResultsPage() {
    const params = useParams();
    const router = useRouter();
    const auctionId = params.id;

    const [loading, setLoading] = useState(true);
    const [auctionData, setAuctionData] = useState(null);
    const [winner, setWinner] = useState(null);
    const [topBidders, setTopBidders] = useState([]);
    const [allBidders, setAllBidders] = useState([]);
    const [stats, setStats] = useState({ viewers: 0, likes: 0, shares: 0 });
    const [sellerOrder, setSellerOrder] = useState(null);

    // Reschedule state (shown when auction never went live)
    const [showReschedule, setShowReschedule] = useState(false);
    const [rescheduleForm, setRescheduleForm] = useState({ startDate: '', startTime: '' });
    const [rescheduleToast, setRescheduleToast] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    // Payment confirmation state
    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState('');

    // Shipping form state
    const [showShipForm, setShowShipForm] = useState(false);
    const [shipForm, setShipForm] = useState({ courier: '', tracking_number: '' });
    const [shipping, setShipping] = useState(false);
    const [shipError, setShipError] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const fetchAll = async () => {
        if (!auctionId) return;
        try {
            const [auctionRes, winnerRes, statsRes, bidsRes] = await Promise.all([
                fetch(`${apiUrl}/api/auctions/${auctionId}`),
                fetch(`${apiUrl}/api/auctions/${auctionId}/winner`),
                fetch(`${apiUrl}/api/auctions/${auctionId}/stats`),
                fetch(`${apiUrl}/api/auctions/${auctionId}/bids`),
            ]);

            const auction = await auctionRes.json();
            setAuctionData(auction);

            if (winnerRes.ok) {
                const winnerData = await winnerRes.json();
                setWinner(winnerData);

                // Use order embedded in winner response (includes payment_confirmed, tracking)
                if (winnerData?.order?.order_id) {
                    setSellerOrder(winnerData.order);
                }
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData.stats);
            }

            if (bidsRes.ok) {
                const bids = await bidsRes.json();
                const bidsByUser = {};
                bids.forEach(bid => {
                    if (!bidsByUser[bid.user_id] || bid.bid_amount > bidsByUser[bid.user_id].bid_amount) {
                        bidsByUser[bid.user_id] = bid;
                    }
                });
                const sorted = Object.values(bidsByUser).sort((a, b) => b.bid_amount - a.bid_amount);
                setTopBidders(sorted.slice(0, 3));
                setAllBidders(sorted);
            }
        } catch (err) {
            console.error('Failed to fetch auction results:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [auctionId]);

    const handleConfirmPayment = async () => {
        const orderId = sellerOrder?.order_id || winner?.order?.order_id;
        if (!orderId) {
            setConfirmError('Order not found. Please refresh the page.');
            return;
        }
        setConfirming(true);
        setConfirmError('');
        try {
            const res = await fetch(`${apiUrl}/api/orders/${orderId}/confirm-payment`, { method: 'PUT' });
            const data = await res.json();
            if (res.ok) {
                await fetchAll();
            } else {
                setConfirmError(data.error || 'Failed to confirm payment.');
            }
        } catch (err) {
            setConfirmError('Network error. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    const handleShipOrder = async (e) => {
        e.preventDefault();
        setShipError('');
        if (!shipForm.courier || !shipForm.tracking_number.trim()) {
            setShipError('Please select a courier and enter a tracking number.');
            return;
        }

        setShipping(true);
        try {
            const orderId = sellerOrder?.order_id || winner?.order?.order_id;
            const res = await fetch(`${apiUrl}/api/orders/${orderId}/ship`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courier: shipForm.courier, tracking_number: shipForm.tracking_number.trim() })
            });

            const data = await res.json();
            if (res.ok) {
                setShowShipForm(false);
                setShipForm({ courier: '', tracking_number: '' });
                await fetchAll();
            } else {
                setShipError(data.error || 'Failed to mark as shipped.');
            }
        } catch (err) {
            setShipError('Network error. Please try again.');
        } finally {
            setShipping(false);
        }
    };

    const handleContactBuyer = async () => {
        if (!winner?.winner?.user_id) return;
        router.push(`/messages?receiverId=${winner.winner.user_id}`);
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        setIsRescheduling(true);
        setRescheduleToast(null);
        try {
            const token = localStorage.getItem('bidpal_token');
            const startTimestamp = new Date(`${rescheduleForm.startDate}T${rescheduleForm.startTime}:00`).toISOString();
            if (isNaN(new Date(startTimestamp).getTime())) {
                setRescheduleToast({ type: 'error', message: 'Invalid date or time selected.' });
                return;
            }
            const payload = { start_time: startTimestamp };
            const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            let data = {};
            try { data = await res.json(); } catch { /* non-JSON response */ }

            if (!res.ok) {
                setRescheduleToast({ type: 'error', message: data.error || `Server error (${res.status})` });
            } else {
                setRescheduleToast({ type: 'success', message: 'Auction rescheduled! Redirecting…' });
                setTimeout(() => router.push('/seller/auctions'), 1500);
            }
        } catch (err) {
            console.error('Reschedule error:', err);
            setRescheduleToast({ type: 'error', message: err?.message || 'Network error. Please try again.' });
        } finally {
            setIsRescheduling(false);
        }
    };

    const getOrderStatus = () => sellerOrder?.status || winner?.order?.status;
    const getTrackingNumber = () => sellerOrder?.tracking_number || null;
    const getCourier = () => sellerOrder?.courier || null;

    const getStatusLabel = (status) => {
        const labels = {
            pending_payment: 'Pending Payment',
            processing: 'Payment Received',
            shipped: 'Shipped',
            completed: 'Completed',
            cancelled: 'Cancelled'
        };
        return labels[status] || status;
    };

    const getStatusStep = (status) => {
        const steps = { pending_payment: 1, processing: 2, shipped: 3, completed: 4 };
        return steps[status] || 0;
    };

    if (loading) return <BIDPalLoader />;

    if (!auctionData) return (
        <div className={styles.container}>
            <div className={styles.error}>Auction not found</div>
        </div>
    );

    const { product } = auctionData;
    const orderStatus = getOrderStatus();
    const currentStep = getStatusStep(orderStatus);
    // True when the auction ended with no winner (never went live OR went live but no bid won)
    const neverWentLive = auctionData.status === 'ended' && !auctionData.winner_user_id;
    // Duration is only meaningful when there was an actual live session
    const liveDurationMinutes = auctionData.live_started_at && auctionData.live_ended_at
        ? Math.floor((new Date(auctionData.live_ended_at) - new Date(auctionData.live_started_at)) / 60000)
        : null;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <Link href="/seller/auctions" className={styles.backLink}>
                    <span className={styles.backLinkIcon}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                    <span>My Auctions</span>
                </Link>
                <h1 className={styles.title}>Auction Results</h1>
            </div>

            {/* Product Info */}
            <div className={styles.productSection}>
                <img
                    src={product?.images?.[0]?.image_url || 'https://placehold.co/300x300?text=No+Image'}
                    alt={product?.name}
                    className={styles.productImage}
                />
                <div className={styles.productInfo}>
                    <h2>{product?.name || 'Unknown Product'}</h2>
                    <p className={styles.productDesc}>{product?.description}</p>
                    <div className={styles.auctionMeta}>
                        {neverWentLive ? (
                            <span style={{ color: '#b45309', fontWeight: 600 }}>
                                <Clock size={16} />
                                {!auctionData.live_started_at
                                    ? `Scheduled: ${new Date(auctionData.start_time).toLocaleString()} — not streamed`
                                    : `Streamed: ${new Date(auctionData.live_started_at).toLocaleString()} — no winner`}
                            </span>
                        ) : (
                            <span><Clock size={16} /> Ended: {new Date(auctionData.live_ended_at || auctionData.end_time).toLocaleString()}</span>
                        )}
                        {liveDurationMinutes !== null && (
                            <span>Duration: {liveDurationMinutes} minute{liveDurationMinutes !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <Eye size={24} />
                    <div className={styles.statValue}>{stats.viewers || 0}</div>
                    <div className={styles.statLabel}>Total Views</div>
                </div>
                <div className={styles.statCard}>
                    <Heart size={24} />
                    <div className={styles.statValue}>{stats.likes || 0}</div>
                    <div className={styles.statLabel}>Likes</div>
                </div>
                <div className={styles.statCard}>
                    <Share2 size={24} />
                    <div className={styles.statValue}>{stats.shares || 0}</div>
                    <div className={styles.statLabel}>Shares</div>
                </div>
                <div className={styles.statCard}>
                    <TrendingUp size={24} />
                    <div className={styles.statValue}>{allBidders.length}</div>
                    <div className={styles.statLabel}>Total Bidders</div>
                </div>
            </div>

            {/* Winner + Order Management Section */}
            {winner && winner.has_winner ? (
                <div className={styles.winnerSection}>
                    <div className={styles.sectionHeader}>
                        <Trophy size={24} color="#f59e0b" />
                        <h3>Auction Winner</h3>
                    </div>

                    {/* Winner Card */}
                    <div className={styles.winnerCard}>
                        <div className={styles.winnerAvatar}>
                            {winner.winner.avatar ? (
                                <img src={winner.winner.avatar} alt={winner.winner.name} />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div className={styles.winnerInfo}>
                            <h4>{winner.winner.name}</h4>
                            <p>Won on {new Date(winner.winning_bid.placed_at).toLocaleString()}</p>
                        </div>
                        <div className={styles.winnerPrice}>
                            <DollarSign size={20} />
                            <span>₱{winner.winning_bid.amount.toLocaleString('en-PH')}</span>
                        </div>
                        <button className={styles.contactBuyerBtn} onClick={handleContactBuyer}>
                            <MessageSquare size={16} />
                            Message Buyer
                        </button>
                    </div>

                    {/* Order Process Timeline */}
                    {orderStatus && (
                        <div className={styles.orderProcess}>
                            <h4 className={styles.processTitle}>Order Progress</h4>

                            <div className={styles.timeline}>
                                <div className={`${styles.timelineStep} ${currentStep >= 1 ? styles.stepDone : ''}`}>
                                    <div className={styles.stepIcon}><DollarSign size={16} /></div>
                                    <div className={styles.stepLabel}>Awaiting Payment</div>
                                </div>
                                <div className={`${styles.timelineLine} ${currentStep >= 2 ? styles.lineDone : ''}`} />
                                <div className={`${styles.timelineStep} ${currentStep >= 2 ? styles.stepDone : ''}`}>
                                    <div className={styles.stepIcon}><CheckCircle2 size={16} /></div>
                                    <div className={styles.stepLabel}>Payment Received</div>
                                </div>
                                <div className={`${styles.timelineLine} ${currentStep >= 3 ? styles.lineDone : ''}`} />
                                <div className={`${styles.timelineStep} ${currentStep >= 3 ? styles.stepDone : ''}`}>
                                    <div className={styles.stepIcon}><Truck size={16} /></div>
                                    <div className={styles.stepLabel}>Shipped</div>
                                </div>
                                <div className={`${styles.timelineLine} ${currentStep >= 4 ? styles.lineDone : ''}`} />
                                <div className={`${styles.timelineStep} ${currentStep >= 4 ? styles.stepDone : ''}`}>
                                    <div className={styles.stepIcon}><Package size={16} /></div>
                                    <div className={styles.stepLabel}>Completed</div>
                                </div>
                            </div>

                            {/* Current Status Badge */}
                            <div className={styles.currentStatusRow}>
                                <span className={styles.statusLabel}>Current Status:</span>
                                <span className={`${styles.statusBadge} ${styles[orderStatus]}`}>
                                    {getStatusLabel(orderStatus)}
                                </span>
                                <span className={styles.orderId}>
                                    Order: {(sellerOrder?.order_id || winner?.order?.order_id || '').slice(0, 8)}...
                                </span>
                            </div>

                            {/* Tracking Info (if shipped) */}
                            {(orderStatus === 'shipped' || orderStatus === 'completed') && getTrackingNumber() && (
                                <div className={styles.trackingInfo}>
                                    <Truck size={18} className={styles.trackingIcon} />
                                    <div>
                                        <div className={styles.trackingLabel}>Shipping Details</div>
                                        <div className={styles.trackingDetail}>
                                            <span className={styles.trackingField}>Courier:</span> {getCourier()}
                                        </div>
                                        <div className={styles.trackingDetail}>
                                            <span className={styles.trackingField}>Tracking #:</span>
                                            <span className={styles.trackingNumber}>{getTrackingNumber()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action: Confirm payment / Mark as Shipped (only when processing) */}
                            {orderStatus === 'processing' && (
                                <div className={styles.actionSection}>
                                    {/* Step 1: confirm payment received */}
                                    {!sellerOrder?.payment_confirmed && !showShipForm && (
                                        <div>
                                            <button
                                                className={styles.confirmPayBtn}
                                                onClick={handleConfirmPayment}
                                                disabled={confirming}
                                            >
                                                <CheckCircle2 size={18} />
                                                {confirming ? 'Confirming…' : 'Confirm Payment Received'}
                                            </button>
                                            {confirmError && (
                                                <div className={styles.shipError} style={{ marginTop: '0.5rem' }}>
                                                    <AlertCircle size={14} /> {confirmError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Step 2: once confirmed, ship */}
                                    {sellerOrder?.payment_confirmed && !showShipForm && (
                                        <button className={styles.shipBtn} onClick={() => setShowShipForm(true)}>
                                            <Truck size={18} />
                                            Mark as Shipped
                                        </button>
                                    )}
                                    {showShipForm && (
                                        <form className={styles.shipForm} onSubmit={handleShipOrder}>
                                            <h5 className={styles.shipFormTitle}>Enter Shipping Details</h5>
                                            <div className={styles.formGroup}>
                                                <label>Courier</label>
                                                <select
                                                    value={shipForm.courier}
                                                    onChange={e => setShipForm(f => ({ ...f, courier: e.target.value }))}
                                                    required
                                                >
                                                    <option value="">Select courier...</option>
                                                    {COURIERS.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
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
                                                    <AlertCircle size={15} /> {shipError}
                                                </div>
                                            )}
                                            <div className={styles.shipFormActions}>
                                                <button type="button" className={styles.cancelShipBtn} onClick={() => { setShowShipForm(false); setShipError(''); }}>
                                                    Cancel
                                                </button>
                                                <button type="submit" className={styles.submitShipBtn} disabled={shipping}>
                                                    <Send size={16} />
                                                    {shipping ? 'Submitting...' : 'Confirm Shipment'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}

                            {orderStatus === 'shipped' && (
                                <div className={styles.waitingBuyer}>
                                    <CheckCircle2 size={18} color="#10b981" />
                                    <span>Waiting for buyer to confirm receipt</span>
                                </div>
                            )}

                            {orderStatus === 'completed' && (
                                <div className={styles.completedBanner}>
                                    <CheckCircle2 size={20} color="#065f46" />
                                    <span>Order completed! Buyer confirmed receipt.</span>
                                </div>
                            )}

                            {orderStatus === 'cancelled' && (
                                <div className={styles.cancelledBanner}>
                                    <AlertCircle size={20} color="#991b1b" />
                                    <span>This order was cancelled by the buyer.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.noWinnerSection}>
                    <Trophy size={48} color="#ccc" />
                    <h3>{neverWentLive ? (auctionData.live_started_at ? 'No Winner' : 'Not Streamed') : 'No Winner'}</h3>
                    <p>
                        {neverWentLive
                            ? (auctionData.live_started_at
                                ? 'This auction was streamed live but ended without any bids or the reserve price was not met.'
                                : 'This auction was never streamed live. You can reschedule it with a new date and time.')
                            : 'This auction ended without any bids or the reserve price was not met.'}
                    </p>
                    {neverWentLive && !showReschedule && (
                        <button
                            onClick={() => setShowReschedule(true)}
                            style={{
                                marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                background: '#D32F2F', color: 'white', border: 'none', borderRadius: 10,
                                padding: '0.75rem 1.5rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                            }}
                        >
                            <RotateCcw size={16} />
                            Reschedule Auction
                        </button>
                    )}

                    {neverWentLive && showReschedule && (
                        <form
                            onSubmit={handleReschedule}
                            style={{
                                marginTop: '1.5rem', background: '#fff', border: '1.5px solid #e2e8f0',
                                borderRadius: 14, padding: '1.25rem', maxWidth: 420, width: '100%',
                                textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Set New Schedule</span>
                                <button type="button" onClick={() => { setShowReschedule(false); setRescheduleToast(null); }}
                                    style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px', cursor: 'pointer', display: 'flex' }}>
                                    <X size={16} color="#64748b" />
                                </button>
                            </div>

                            <div style={{ marginBottom: '0.85rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>Date</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '0.55rem 0.8rem', background: '#fafafa' }}>
                                    <Calendar size={14} color="#94a3b8" />
                                    <input type="date" required value={rescheduleForm.startDate}
                                        onChange={e => setRescheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '0.85rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>Time</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '0.55rem 0.8rem', background: '#fafafa' }}>
                                    <Clock size={14} color="#94a3b8" />
                                    <input type="time" required value={rescheduleForm.startTime}
                                        onChange={e => setRescheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                    />
                                </div>
                            </div>

                            {rescheduleToast && (
                                <div style={{
                                    padding: '0.65rem 0.9rem', borderRadius: 8, marginBottom: '0.85rem',
                                    background: rescheduleToast.type === 'success' ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${rescheduleToast.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
                                    color: rescheduleToast.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.8rem', fontWeight: 600
                                }}>
                                    {rescheduleToast.type === 'success' ? '✓ ' : '✕ '}{rescheduleToast.message}
                                </div>
                            )}

                            <button type="submit" disabled={isRescheduling} style={{
                                width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                borderRadius: 10, padding: '0.8rem', fontWeight: 700, fontSize: '0.88rem',
                                cursor: isRescheduling ? 'not-allowed' : 'pointer', opacity: isRescheduling ? 0.7 : 1
                            }}>
                                {isRescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Top 3 Bidders */}
            {topBidders.length > 0 && (
                <div className={styles.biddersSection}>
                    <div className={styles.sectionHeader}>
                        <TrendingUp size={24} />
                        <h3>Top 3 Winning Bidders</h3>
                    </div>
                    <p className={styles.sectionNote}>
                        Winner priority order. If #1 cancels, #2 becomes the winner, then #3.
                    </p>
                    <div className={styles.biddersList}>
                        {topBidders.map((bid, index) => (
                            <div key={bid.bid_id} className={`${styles.bidderCard} ${index < 3 ? styles.topBidder : ''}`}>
                                <div className={styles.bidderRank}>#{index + 1}</div>
                                <div className={styles.bidderAvatar}>
                                    {bid.bidder?.Avatar ? (
                                        <img src={bid.bidder.Avatar} alt={bid.bidder.Fname} />
                                    ) : (
                                        <User size={24} />
                                    )}
                                </div>
                                <div className={styles.bidderInfo}>
                                    <h5>
                                        {bid.bidder ? `${bid.bidder.Fname || ''} ${bid.bidder.Lname || ''}`.trim() : 'Anonymous'}
                                        {index === 0 && <span className={styles.currentWinner}>Current Winner</span>}
                                        {index === 1 && <span className={styles.backupWinner}>Backup Winner</span>}
                                        {index === 2 && <span className={styles.thirdPlace}>3rd Place</span>}
                                    </h5>
                                    <p>{new Date(bid.placed_at).toLocaleString()}</p>
                                </div>
                                <div className={styles.bidderAmount}>
                                    ₱{bid.bid_amount.toLocaleString('en-PH')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bidding History Summary — links to dedicated page */}
            {allBidders.length > 0 && (
                <div className={styles.transactionHistory}>
                    <div className={styles.sectionHeader}>
                        <Clock size={20} />
                        <h3>Complete Bidding History</h3>
                    </div>
                    <p className={styles.sectionSubtitle}>
                        {allBidders.length} total bidder{allBidders.length !== 1 ? 's' : ''} participated in this auction
                    </p>
                    <Link
                        href={`/seller/auctions/${auctionId}/bidders`}
                        className={styles.viewAllBtn}
                    >
                        <span>View All Bidders & Transaction History</span>
                        <span className={styles.viewAllBtnCount}>{allBidders.length}</span>
                    </Link>
                </div>
            )}
        </div>
    );
}
