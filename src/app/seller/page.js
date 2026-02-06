'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Radio,
    Users,
    MessageSquare,
    Gavel,
    Play,
    Square,
    Clock,
    TrendingUp,
    ChevronRight,
    MoreVertical
} from 'lucide-react';
import styles from './page.module.css';

export default function SellerDashboard() {
    const [isLive, setIsLive] = useState(false);
    const [hasProducts] = useState(true); // Assuming they have products for this demo

    // Mock data for the live session
    const [activeItem, setActiveItem] = useState({
        title: 'Vintage Leather Satchel',
        currentBid: 3200,
        bidders: 45,
        timeLeft: '02:45',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=200'
    });

    const [comments, setComments] = useState([
        { id: 1, user: 'Sarah J.', text: 'Is the leather genuine?', time: '2m ago' },
        { id: 2, user: 'Mike R.', text: '₱3,500 for the next one!', time: '1m ago' },
        { id: 3, user: 'Anna K.', text: 'Love the color!', time: 'Just now' },
    ]);

    const [bids, setBids] = useState([
        { id: 1, user: 'John Doe', amount: 3200, time: '30s ago' },
        { id: 2, user: 'Emma Wilson', amount: 3100, time: '1m ago' },
        { id: 3, user: 'Robert Fox', amount: 2950, time: '3m ago' },
    ]);

    const [productQueue, setProductQueue] = useState([
        { id: 1, title: 'Silver Pocket Watch', price: 1200, image: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?auto=format&fit=crop&q=80&w=100' },
        { id: 2, title: 'Retro Camera', price: 5400, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=100' },
        { id: 3, title: 'Designer Sunglasses', price: 8900, image: 'https://images.unsplash.com/photo-1511499767390-a7391e0a9641?auto=format&fit=crop&q=80&w=100' },
    ]);

    if (!hasProducts) {
        return (
            <div className={styles.emptyStateContainer}>
                <div className={styles.emptyStateCard}>
                    <h1 className={styles.getStartedTitle}>Get Started</h1>
                    <Link href="/seller/add-product" className={styles.addFirstLink}>
                        Add your first product to sell
                    </Link>
                    <Link href="/seller/add-product" className={styles.addBtn}>
                        <Plus size={20} />
                        Add products
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            {/* Header Section */}
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1 className={styles.title}>Seller Hub</h1>
                    <div className={styles.statusBadge}>
                        <div className={`${styles.statusDot} ${isLive ? styles.live : ''}`}></div>
                        <span>{isLive ? 'Live Now' : 'Offline'}</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.liveControlBtn} ${isLive ? styles.stop : styles.start}`}
                        onClick={() => setIsLive(!isLive)}
                    >
                        {isLive ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {isLive ? 'End Stream' : 'Go Live'}
                    </button>
                    <Link href="/seller/add-product" className={styles.addBtnSmall}>
                        <Plus size={18} /> Add Product
                    </Link>
                </div>
            </header>

            <div className={styles.controlRoom}>
                {/* Left Column: Live Controls & Monitoring */}
                <div className={styles.mainWorkArea}>
                    {/* Active Auction Card */}
                    <section className={styles.activeAuctionGrid}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <Radio size={20} color="#D32F2F" />
                                <h2>Currently Selling</h2>
                            </div>
                            <button className={styles.iconBtn}><MoreVertical size={20} /></button>
                        </div>

                        <div className={styles.activeItemCard}>
                            <div className={styles.itemImageWrapper}>
                                <img src={activeItem.image} alt={activeItem.title} className={styles.itemImage} />
                                {isLive && <div className={styles.liveOverlay}>LIVE VIEW</div>}
                            </div>
                            <div className={styles.itemDetails}>
                                <h3 className={styles.itemName}>{activeItem.title}</h3>
                                <div className={styles.itemStats}>
                                    <div className={styles.itemStat}>
                                        <span className={styles.statLabel}>Current Bid</span>
                                        <span className={styles.statValue}>₱ {activeItem.currentBid.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.itemStat}>
                                        <span className={styles.statLabel}>Time Remaining</span>
                                        <span className={styles.statValue}>
                                            <Clock size={16} /> {activeItem.timeLeft}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bid History */}
                        <div className={styles.sectionHeader}>
                            <div className={styles.cardTitleGroup}>
                                <Gavel size={18} />
                                <h3>Recent Bids</h3>
                            </div>
                            <span className={styles.viewerCount}><Users size={14} /> {activeItem.bidders} Bidders</span>
                        </div>
                        <div className={styles.bidList}>
                            {bids.map(bid => (
                                <div key={bid.id} className={styles.bidItem}>
                                    <div className={styles.bidInfo}>
                                        <span className={styles.bidUser}>{bid.user}</span>
                                        <span className={styles.bidTime}>{bid.time}</span>
                                    </div>
                                    <span className={styles.bidAmount}>₱ {bid.amount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Product Queue */}
                    <section className={styles.queueSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Next Items to Sell</h3>
                            <Link href="/seller/inventory" className={styles.textLink}>View Inventory</Link>
                        </div>
                        <div className={styles.queueGrid}>
                            {productQueue.map(item => (
                                <div key={item.id} className={styles.queueCard}>
                                    <img src={item.image} alt={item.title} />
                                    <div className={styles.queueInfo}>
                                        <h4>{item.title}</h4>
                                        <span>Start: ₱ {item.price.toLocaleString()}</span>
                                    </div>
                                    <button className={styles.queueBtn}>Set Next</button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column: Interaction & Metrics */}
                <aside className={styles.interactionPanel}>
                    {/* Real-time Insights */}
                    <section className={styles.metricsCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <TrendingUp size={20} />
                                <h2>Live Insights</h2>
                            </div>
                        </div>
                        <div className={styles.metricsGrid}>
                            <div className={styles.metric}>
                                <span className={styles.mValue}>152</span>
                                <span className={styles.mLabel}>Viewers</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.mValue}>12</span>
                                <span className={styles.mLabel}>Shared</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.mValue}>85</span>
                                <span className={styles.mLabel}>Likes</span>
                            </div>
                        </div>
                    </section>

                    {/* Live Chat */}
                    <section className={styles.chatSection}>
                        <div className={styles.chatHeader}>
                            <MessageSquare size={18} />
                            <h3>Live Engagement</h3>
                        </div>
                        <div className={styles.chatContainer}>
                            <div className={styles.commentList}>
                                {comments.map(comment => (
                                    <div key={comment.id} className={styles.commentItem}>
                                        <div className={styles.commentUserGroup}>
                                            <span className={styles.cUser}>{comment.user}</span>
                                            <span className={styles.cTime}>{comment.time}</span>
                                        </div>
                                        <p className={styles.cText}>{comment.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.chatInputWrapper}>
                                <input type="text" placeholder="Announce something..." className={styles.chatInput} />
                                <button className={styles.sendBtn}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
