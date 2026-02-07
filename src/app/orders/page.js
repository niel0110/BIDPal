'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Package, Truck, CreditCard, Clock, CheckCircle2, XCircle } from 'lucide-react';
import styles from './page.module.css';

export default function OrdersPage() {
    const router = useRouter();
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

    const mockOrders = [
        {
            id: 'ORD-7721',
            date: 'Feb 05, 2026',
            status: 'completed',
            total: 2650,
            items: [
                {
                    name: 'PixelPast Analog Camera',
                    qty: 1,
                    price: 2500,
                    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=200'
                }
            ],
            seller: 'RetroVault'
        },
        {
            id: 'ORD-8812',
            date: 'Feb 06, 2026',
            status: 'ship',
            total: 3150,
            items: [
                {
                    name: 'Golden Horizon Set',
                    qty: 2,
                    price: 1500,
                    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=200'
                }
            ],
            seller: 'EleganceCo'
        }
    ];

    const filteredOrders = mockOrders.filter(order => {
        if (activeTab !== 'all' && order.status !== activeTab) return false;
        if (searchQuery && !order.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !order.items[0].name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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
                                                <img src={item.image} alt={item.name} />
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
                                        <span className={styles.orderId}>ID: {order.id}</span>
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
