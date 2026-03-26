'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Package, Truck, CreditCard, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function OrdersPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

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
            if (!res.ok) throw new Error('Failed to fetch orders');
            const data = await res.json();
            setOrders(data);
        } catch (err) {
            console.error(err);
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
        if (activeTab !== 'all' && order.status !== activeTab) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const idMatch = order.id.toLowerCase().includes(query);
            const itemMatch = order.items.some(item => item.name.toLowerCase().includes(query));
            if (!idMatch && !itemMatch) return false;
        }
        return true;
    });

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pay': return 'To Pay';
            case 'ship': return 'To Ship';
            case 'receive': return 'To Receive';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            default: return 'Processing';
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
                                        <Package size={16} color="#666" />
                                        <span>{order.seller}</span>
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
                                <div className={styles.orderActions}>
                                    {order.status === 'completed' ? (
                                        <button className={styles.secondaryBtn}>Buy Again</button>
                                    ) : (
                                        <button className={styles.secondaryBtn}>Order Details</button>
                                    )}
                                    <button className={styles.primaryBtn}>Contact Seller</button>
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
        </div>
    );
}
