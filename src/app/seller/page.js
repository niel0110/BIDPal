'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
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
    const { user } = useAuth();
    const [isLive, setIsLive] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [queueProgress, setQueueProgress] = useState(0);
    const [dashboardData, setDashboardData] = useState({
        activeAuction: null,
        queue: [],
        completed: [],
        stats: { viewers: 0, shares: 0, likes: 0 }
    });
    const [recentBids, setRecentBids] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const token = localStorage.getItem('bidpal_token');
            const seller_id = user.seller_id;
            const user_id = user.user_id || user.id;

            const res = await fetch(`${apiUrl}/api/dashboard/summary?${seller_id ? `seller_id=${seller_id}` : `user_id=${user_id}`}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (res.ok) {
                const data = await res.json();
                setDashboardData(data);
                setIsLive(data.activeAuction !== null);
                
                // If there's an active auction, fetch bids
                if (data.activeAuction) {
                    const bidsRes = await fetch(`${apiUrl}/api/dashboard/auction/${data.activeAuction.auction_id}/bids`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });
                    if (bidsRes.ok) {
                        const bidsData = await bidsRes.json();
                        setRecentBids(bidsData);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
        // Polling for updates every 10 seconds
        const interval = setInterval(fetchDashboardData, 10000);
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    const handleQueueScroll = (e) => {
        const element = e.target;
        const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
        setQueueProgress(isNaN(progress) ? 0 : progress);
    };

    const activeItem = dashboardData.activeAuction ? {
        id: dashboardData.activeAuction.auction_id,
        title: dashboardData.activeAuction.products?.name,
        image: dashboardData.activeAuction.products?.images?.[0]?.image_url || "https://placehold.co/400x400?text=No+Image",
        currentBid: dashboardData.activeAuction.current_price || dashboardData.activeAuction.reserve_price || 0,
        timeLeft: '---', // Needs timer logic
        bidders: dashboardData.activeAuction.bids?.[0]?.count || 0
    } : null;

    // Check if there are products available (queue + active)
    const hasProducts = dashboardData.queue.length > 0 || activeItem !== null;

    const handleGoLive = async () => {
        if (!isLive) {
            if (dashboardData.queue.length === 0) {
                alert('You need to schedule products before starting a live auction.');
                return;
            }
            const nextAuction = dashboardData.queue[0];
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/auctions/${nextAuction.auction_id}/start`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                if (res.ok) {
                    fetchDashboardData();
                } else {
                    const error = await res.json();
                    alert(error.error || 'Failed to start auction');
                }
            } catch (err) {
                console.error(err);
            }
        } else {
            // End Stream
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/auctions/${activeItem.id}/end`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                if (res.ok) {
                    fetchDashboardData();
                }
            } catch (err) {
                console.error(err);
            }
        }
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
                            {recentBids.length > 0 ? recentBids.map(bid => (
                                <div key={bid.bid_id} className={styles.bidRow}>
                                    <div>
                                        <div className={styles.bidderName}>{bid.bidder?.Fname} {bid.bidder?.Lname}</div>
                                        <div className={styles.bidTimestamp}>{new Date(bid.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
                            {dashboardData.queue.length > 0 ? dashboardData.queue.map(item => (
                                <div key={item.auction_id} className={styles.queueItem}>
                                    <img src={item.products?.images?.[0]?.image_url || "https://placehold.co/100x100?text=No+Image"} alt={item.products?.name} />
                                    <div className={styles.queueMeta}>
                                        <h4>{item.products?.name}</h4>
                                        <span>Starts at ₱ {item.reserve_price?.toLocaleString() || item.buy_now_price?.toLocaleString()}</span>
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

                    {/* Completed Auctions */}
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderText}>
                                <h2>Completed Auctions</h2>
                                <p>Recently finished sales</p>
                            </div>
                        </div>
                        <div className={styles.completedList}>
                            {dashboardData.completed && dashboardData.completed.length > 0 ? (
                                <div className={styles.completedGrid}>
                                    {dashboardData.completed.map(item => (
                                        <div key={item.auction_id} className={styles.completedItem}>
                                            <div className={styles.completedImage}>
                                                <img src={item.products?.images?.[0]?.image_url || "https://placehold.co/80x80?text=No+Image"} alt={item.products?.name} />
                                                <div className={styles.completedBadge}>ENDED</div>
                                            </div>
                                            <div className={styles.completedInfo}>
                                                <h4>{item.products?.name}</h4>
                                                <div className={styles.completedStats}>
                                                    <span className={styles.finalPrice}>₱{item.current_price?.toLocaleString() || '0'}</span>
                                                    <span className={styles.bidCount}>{item.bids?.[0]?.count || 0} bids</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.emptyCompleted}>
                                    <p>No completed auctions yet.</p>
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
                                <span className={styles.metricValue}>{dashboardData.stats.viewers}</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Share2 size={18} /></div>
                                <span className={styles.metricLabel}>Shares</span>
                                <span className={styles.metricValue}>{dashboardData.stats.shares}</span>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricIcon}><Heart size={18} /></div>
                                <span className={styles.metricLabel}>Likes</span>
                                <span className={styles.metricValue}>{dashboardData.stats.likes}</span>
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
