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
    MoreVertical,
    Send,
    Eye,
    Share2,
    Heart
} from 'lucide-react';
import styles from './page.module.css';

const mockComments = [];

const mockBids = [];

const mockQueue = [];

export default function SellerDashboard() {
    const [isLive, setIsLive] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [queueProgress, setQueueProgress] = useState(0);

    const handleQueueScroll = (e) => {
        const element = e.target;
        const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
        setQueueProgress(isNaN(progress) ? 0 : progress);
    };

    const activeItem = null;

    // Check if there are products available (queue + active)
    const hasProducts = mockQueue.length > 0 || activeItem !== null;

    const handleGoLive = () => {
        if (!hasProducts) {
            alert('You need to add products before starting a live auction. Please add products to your inventory first.');
            return;
        }
        setIsLive(!isLive);
    };

    return (
        <>
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
                        className={`${styles.liveControlBtn} ${isLive ? styles.stop : styles.start} ${!hasProducts && !isLive ? styles.disabled : ''}`}
                        onClick={handleGoLive}
                        disabled={!hasProducts && !isLive}
                        title={!hasProducts ? 'Add products to start live auction' : ''}
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
                    {/* Live Auction Display - No Card Container */}
                    {activeItem ? (
                        <div className={styles.liveAuctionArea}>
                            <div className={styles.liveHeader}>
                                <div className={styles.liveIndicator}>
                                    <Radio size={20} color="#D32F2F" />
                                    <div>
                                        <h2>Currently Selling</h2>
                                        <p>Live auction in progress</p>
                                    </div>
                                </div>
                                {isLive && <div className={styles.livePulse}>LIVE</div>}
                            </div>

                            <div className={styles.auctionShowcase}>
                                <div className={styles.showcaseImage}>
                                    <img src={activeItem.image} alt={activeItem.title} />
                                </div>
                                <div className={styles.showcaseDetails}>
                                    <h1 className={styles.showcaseTitle}>{activeItem.title}</h1>
                                    <div className={styles.showcaseStats}>
                                        <div className={styles.bigStat}>
                                            <span className={styles.bigStatLabel}>Current Bid</span>
                                            <span className={styles.bigStatValue}>₱{activeItem.currentBid.toLocaleString()}</span>
                                        </div>
                                        <div className={styles.bigStat}>
                                            <span className={styles.bigStatLabel}>Time Left</span>
                                            <div className={styles.bigStatValue}>
                                                <Clock size={24} /> {activeItem.timeLeft}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <Radio size={64} color="#ddd" strokeWidth={1.5} />
                            <h2>No Active Auction</h2>
                            <p>Start selling by adding products to your inventory</p>
                            <Link href="/seller/add-product" className={styles.emptyStateBtn}>
                                <Plus size={20} /> Add Your First Product
                            </Link>
                        </div>
                    )}

                    {/* Recent Bids Card */}
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <Gavel size={20} />
                                <div>
                                    <h2>Recent Bids</h2>
                                    <p>Live bidding activity</p>
                                </div>
                            </div>
                            {activeItem && (
                                <div className={styles.biddersCount}>
                                    <Users size={16} /> {activeItem.bidders} Bidders
                                </div>
                            )}
                        </div>
                        <div className={styles.bidsList}>
                            {mockBids.length > 0 ? mockBids.map(bid => (
                                <div key={bid.id} className={styles.bidRow}>
                                    <div>
                                        <div className={styles.bidderName}>{bid.user}</div>
                                        <div className={styles.bidTimestamp}>{bid.time}</div>
                                    </div>
                                    <span className={styles.bidPrice}>₱{bid.amount.toLocaleString()}</span>
                                </div>
                            )) : (
                                <div className={styles.emptyBids}>
                                    <Gavel size={48} color="#eee" strokeWidth={1.5} />
                                    <p>No bids yet</p>
                                </div>
                            )}
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
                            {mockQueue.length > 0 ? mockQueue.map(item => (
                                <div key={item.id} className={styles.queueItem}>
                                    <img src={item.image} alt={item.title} />
                                    <div className={styles.queueMeta}>
                                        <h4>{item.title}</h4>
                                        <span>Starts at ₱ {item.price.toLocaleString()}</span>
                                    </div>
                                    <button className={styles.setNextBtn}>Set Next</button>
                                </div>
                            )) : (
                                <div className={styles.emptyQueue}>
                                    <p>Your auction queue is empty.</p>
                                    <Link href="/seller/inventory">Add products to queue</Link>
                                </div>
                            )}
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
                                <span className={styles.metricValue}>0</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Share2 size={18} /></div>
                                <span className={styles.metricLabel}>Shares</span>
                                <span className={styles.metricValue}>0</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Heart size={18} /></div>
                                <span className={styles.metricLabel}>Likes</span>
                                <span className={styles.metricValue}>0</span>
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
                                {mockComments.length > 0 ? mockComments.map(comment => (
                                    <div key={comment.id} className={styles.comment}>
                                        <div className={styles.commentHeader}>
                                            <span className={styles.userName}>{comment.user}</span>
                                            <span className={styles.commentTime}>{comment.time}</span>
                                        </div>
                                        <p className={styles.commentText}>{comment.text}</p>
                                    </div>
                                )) : (
                                    <p className={styles.emptyChat}>No messages yet</p>
                                )}
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
        </>
    );
}
