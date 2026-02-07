'use client';

import { useState } from 'react';
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
    MoreVertical,
    Send,
    Eye,
    Share2,
    Heart
} from 'lucide-react';
import styles from './page.module.css';

const mockComments = [
    { id: 1, user: 'Sarah J.', text: 'Is the leather genuine?', time: '2m ago' },
    { id: 2, user: 'Mike R.', text: '₱3,500 for the next one!', time: '1m ago' },
    { id: 3, user: 'Anna K.', text: 'Love the color!', time: 'Just now' },
];

const mockBids = [
    { id: 1, user: 'John Doe', amount: 3200, time: '30s ago' },
    { id: 2, user: 'Emma Wilson', amount: 3100, time: '1m ago' },
    { id: 3, user: 'Robert Fox', amount: 2950, time: '3m ago' },
];

const mockQueue = [
    { id: 1, title: 'Silver Pocket Watch', price: 1200, image: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?auto=format&fit=crop&q=80&w=100' },
    { id: 2, title: 'Retro Camera', price: 5400, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=100' },
    { id: 3, title: 'Designer Sunglasses', price: 8900, image: 'https://images.unsplash.com/photo-1511499767390-a7391e0a9641?auto=format&fit=crop&q=80&w=100' },
];

export default function SellerDashboard() {
    const [isLive, setIsLive] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [queueProgress, setQueueProgress] = useState(0);

    const handleQueueScroll = (e) => {
        const element = e.target;
        const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
        setQueueProgress(isNaN(progress) ? 0 : progress);
    };

    const activeItem = {
        title: 'Vintage Leather Satchel',
        currentBid: 3200,
        bidders: 45,
        timeLeft: '02:45',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=400'
    };

    return (
        <div className={styles.dashboardContainer}>
            {/* Header Section */}
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <h1 className={styles.title}>Seller Hub</h1>
                    <div className={styles.statusBadge}>
                        <div className={`${styles.statusDot} ${isLive ? styles.live : ''}`}></div>
                        <span>{isLive ? 'Live Session Active' : 'Offline'}</span>
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
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <div className={styles.iconCircle}>
                                    <Radio size={18} color="#D32F2F" />
                                </div>
                                <div className={styles.cardHeaderText}>
                                    <h2>Currently Selling</h2>
                                    <p>Live auction in progress</p>
                                </div>
                            </div>
                            <button className={styles.moreBtn}><MoreVertical size={20} /></button>
                        </div>

                        <div className={styles.activeItemContent}>
                            <div className={styles.itemShowcase}>
                                <img src={activeItem.image} alt={activeItem.title} className={styles.itemImage} />
                                {isLive && <div className={styles.liveTag}><div className={styles.tagDot} /> LIVE VIEW</div>}
                            </div>
                            <div className={styles.itemData}>
                                <h3 className={styles.itemName}>{activeItem.title}</h3>
                                <div className={styles.itemStats}>
                                    <div className={styles.statBox}>
                                        <span className={styles.statLabel}>Current Bid</span>
                                        <span className={styles.statValue}>₱ {activeItem.currentBid.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.statBox}>
                                        <span className={styles.statLabel}>Time Remaining</span>
                                        <div className={styles.timeValue}>
                                            <Clock size={16} /> <span>{activeItem.timeLeft}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Bids */}
                        <div className={styles.bidsSection}>
                            <div className={styles.subHeader}>
                                <div className={styles.subTitle}>
                                    <Gavel size={16} />
                                    <span>Recent Bids</span>
                                </div>
                                <div className={styles.biddersCount}>
                                    <Users size={14} /> {activeItem.bidders} Active Bidders
                                </div>
                            </div>
                            <div className={styles.bidHistory}>
                                {mockBids.map(bid => (
                                    <div key={bid.id} className={styles.bidRow}>
                                        <div className={styles.bidderInfo}>
                                            <span className={styles.bidderName}>{bid.user}</span>
                                            <span className={styles.bidTimestamp}>{bid.time}</span>
                                        </div>
                                        <span className={styles.bidPrice}>₱ {bid.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Product Queue */}
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderText}>
                                <h2>Auction Queue</h2>
                                <p>Next items to be showcased</p>
                            </div>
                            {/* Dynamic Scroll Indicator */}
                            <div className={styles.scrollIndicator}>
                                <div
                                    className={styles.scrollThumb}
                                    style={{
                                        left: `${queueProgress * 100}%`,
                                        transform: `translateX(-${queueProgress * 100}%)`
                                    }}
                                />
                            </div>
                            <Link href="/seller/inventory" className={styles.viewInventoryBtn}>View All</Link>
                        </div>
                        <div className={styles.queueList} onScroll={handleQueueScroll}>
                            {mockQueue.map(item => (
                                <div key={item.id} className={styles.queueItem}>
                                    <img src={item.image} alt={item.title} />
                                    <div className={styles.queueMeta}>
                                        <h4>{item.title}</h4>
                                        <span>Starts at ₱ {item.price.toLocaleString()}</span>
                                    </div>
                                    <button className={styles.setNextBtn}>Set Next</button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column: Interaction & Metrics */}
                <aside className={styles.interactionPanel}>
                    {/* Live Insights */}
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <TrendingUp size={20} color="#111" />
                                <h2>Hub Insights</h2>
                            </div>
                        </div>
                        <div className={styles.metricsGrid}>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Eye size={18} /></div>
                                <span className={styles.metricLabel}>Live Viewers</span>
                                <span className={styles.metricValue}>152</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Share2 size={18} /></div>
                                <span className={styles.metricLabel}>Shares</span>
                                <span className={styles.metricValue}>12</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Heart size={18} /></div>
                                <span className={styles.metricLabel}>Likes</span>
                                <span className={styles.metricValue}>85</span>
                            </div>
                        </div>
                    </section>

                    {/* Live Engagement */}
                    <section className={`${styles.card} ${styles.chatCard}`}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <MessageSquare size={18} color="#111" />
                                <h2>Engagement</h2>
                            </div>
                        </div>
                        <div className={styles.chatBox}>
                            <div className={styles.commentList}>
                                {mockComments.map(comment => (
                                    <div key={comment.id} className={styles.comment}>
                                        <div className={styles.commentHeader}>
                                            <span className={styles.userName}>{comment.user}</span>
                                            <span className={styles.commentTime}>{comment.time}</span>
                                        </div>
                                        <p className={styles.commentText}>{comment.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.chatInputArea}>
                                <textarea
                                    placeholder="Type an announcement..."
                                    className={styles.announcementInput}
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    rows={1}
                                />
                                <button className={styles.chatSendBtn} disabled={!messageInput.trim()}>
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
