'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Package, Truck, CreditCard, Clock, CheckCircle2, XCircle, Loader2, Gavel, Ban } from 'lucide-react';
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
    const [cancellationLimit, setCancellationLimit] = useState(null);
    const [cancellingOrder, setCancellingOrder] = useState(null);
    const [showCancellationModal, setShowCancellationModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState(null);

    const tabs = [
        { id: 'all', label: 'All', icon: <Package size={18} /> },
        { id: 'pay', label: 'To Pay', icon: <CreditCard size={18} /> },
        { id: 'ship', label: 'To Ship', icon: <Clock size={18} /> },
        { id: 'receive', label: 'To Receive', icon: <Truck size={18} /> },
        { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={18} /> },
        { id: 'cancelled', label: 'Cancelled', icon: <XCircle size={18} /> },
    ];

    const fetchOrders = useCallback(async () => {
        if (!user) {
            console.log('❌ No user found');
            return;
        }

        console.log('👤 Current user:', user);
        console.log('🔑 User ID:', user.user_id);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

            // Fetch regular orders
            const ordersUrl = `${apiUrl}/api/orders/user/${user.user_id}`;
            console.log('📡 Fetching regular orders from:', ordersUrl);

            const ordersRes = await fetch(ordersUrl);
            console.log('📊 Orders response status:', ordersRes.status);

            let regularOrders = [];
            if (ordersRes.ok) {
                regularOrders = await ordersRes.json();
                console.log('✅ Regular orders received:', regularOrders.length);
            }

            // Fetch auction wins
            const winsUrl = `${apiUrl}/api/orders/user/${user.user_id}/auction-wins`;
            console.log('🏆 Fetching auction wins from:', winsUrl);

            const winsRes = await fetch(winsUrl);
            console.log('📊 Auction wins response status:', winsRes.status);

            let auctionWins = [];
            if (winsRes.ok) {
                auctionWins = await winsRes.json();
                console.log('🎉 Auction wins received:', auctionWins.length);
            }

            // Combine both arrays
            const allOrders = [...auctionWins, ...regularOrders];
            console.log('📦 Total orders (wins + regular):', allOrders.length);

            setOrders(allOrders);
        } catch (err) {
            console.error('❌ Error fetching orders:', err);
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

    // Fetch cancellation limit
    useEffect(() => {
        const fetchCancellationLimit = async () => {
            if (!user) return;

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const res = await fetch(`${apiUrl}/api/violations/user/${user.user_id}/cancellation-limit`);
                if (res.ok) {
                    const data = await res.json();
                    setCancellationLimit(data);
                }
            } catch (err) {
                console.error('Error fetching cancellation limit:', err);
            }
        };

        fetchCancellationLimit();
    }, [user]);

    // Fetch payment windows for auction wins
    useEffect(() => {
        const fetchPaymentWindows = async () => {
            if (!orders.length) return;

            const auctionOrders = orders.filter(o => o.order_type === 'auction' && o.status === 'pending_payment');
            if (!auctionOrders.length) return;

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const windows = {};

                for (const order of auctionOrders) {
                    // Fetch payment window from backend
                    // For now, calculate 24 hours from order date
                    const orderDate = new Date(order.date);
                    const deadline = new Date(orderDate);
                    deadline.setHours(deadline.getHours() + 24);
                    windows[order.id] = deadline.toISOString();
                }

                setPaymentWindows(windows);
            } catch (err) {
                console.error('Error fetching payment windows:', err);
            }
        };

        fetchPaymentWindows();
    }, [orders]);

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
                if (data.triggered_violation) {
                    alert(`⚠️ Order cancelled, but a strike has been issued to your account for exceeding the weekly cancellation limit.`);
                } else {
                    alert(`✅ Order cancelled successfully.\n\nRemaining cancellations this week: ${data.remaining_cancellations}`);
                }

                // Close modal
                setShowCancellationModal(false);
                setOrderToCancel(null);

                // Refresh orders
                fetchOrders();

                // Refresh cancellation limit
                const limitRes = await fetch(`${apiUrl}/api/violations/user/${user.user_id}/cancellation-limit`);
                if (limitRes.ok) {
                    const limitData = await limitRes.json();
                    setCancellationLimit(limitData);
                }
            } else {
                alert(`❌ Error: ${data.error || 'Failed to cancel order'}`);
            }
        } catch (err) {
            console.error('Error cancelling order:', err);
            alert('❌ Error cancelling order. Please try again.');
        } finally {
            setCancellingOrder(null);
        }
    };

    const handlePayNow = (order) => {
        if (!order.auction_id) return;
        // Redirect to checkout page with auction_id
        router.push(`/checkout?auction_id=${order.auction_id}`);
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

    if (loading) return (
        <div className={styles.loadingContainer}>
            <Loader2 className={styles.spinner} size={40} />
            <p>Loading your orders...</p>
        </div>
    );

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
                    <button className={styles.backBtn} onClick={() => router.push('/')}>
                        <ChevronLeft size={20} />
                        <span>Back to Marketplace</span>
                    </button>
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
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className={styles.ordersList}>
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map(order => (
                            <div key={order.id} className={styles.orderCard}>
                                <div className={styles.orderCardHeader}>
                                    <div className={styles.sellerInfo}>
                                        {order.order_type === 'auction' ? (
                                            <>
                                                <Gavel size={16} color="#673AB7" />
                                                <span className={styles.auctionBadge}>Auction Win</span>
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
                                            onExpired={() => {
                                                console.log('Payment window expired for order', order.id);
                                                fetchOrders(); // Refresh to update status
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Cancellation Limit Warning */}
                                {order.status === 'pending_payment' && cancellationLimit && !cancellationLimit.canCancel && (
                                    <div className={styles.cancellationWarning}>
                                        ⚠️ {cancellationLimit.message}
                                    </div>
                                )}

                                <div className={styles.orderActions}>
                                    {order.status === 'pending_payment' && order.order_type === 'auction' ? (
                                        <>
                                            <button
                                                className={styles.payNowBtn}
                                                onClick={() => handlePayNow(order)}
                                            >
                                                Pay Now
                                            </button>
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
                                        </>
                                    ) : order.status === 'completed' ? (
                                        <button className={styles.secondaryBtn}>Buy Again</button>
                                    ) : (
                                        <button className={styles.secondaryBtn}>Order Details</button>
                                    )}
                                    {order.order_type === 'auction' && (
                                        <button
                                            className={styles.primaryBtn}
                                            onClick={() => handleContactSeller(order)}
                                        >
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
            />
        </div>
    );
}
