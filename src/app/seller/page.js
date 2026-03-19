'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
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
    Send,
    Eye,
    Share2,
    Heart,
    Video,
    Mic,
    MicOff,
    VideoOff
} from 'lucide-react';
import styles from './page.module.css';

// Dynamically import Agora to avoid SSR issues
let AgoraRTC = null;

export default function SellerDashboard() {
    const { user } = useAuth();
    const router = useRouter();
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
    const [recentMessages, setRecentMessages] = useState([]);
    const [latestConvId, setLatestConvId] = useState(null);
    const [streamReady, setStreamReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Agora refs
    const agoraClientRef = useRef(null);
    const localTracksRef = useRef({ audio: null, video: null });

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
        }
    }, [user]);

    // Fetch latest conversation messages for Engagement panel
    const fetchLatestMessages = useCallback(async () => {
        if (!user) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const token = localStorage.getItem('bidpal_token');
            const convRes = await fetch(`${apiUrl}/api/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!convRes.ok) return;
            const convs = await convRes.json();
            if (!convs || convs.length === 0) return;
            const convId = convs[0].id;
            setLatestConvId(convId);
            const msgRes = await fetch(`${apiUrl}/api/messages/${convId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!msgRes.ok) return;
            const msgs = await msgRes.json();
            setRecentMessages(Array.isArray(msgs) ? msgs.slice(-10) : []);
        } catch (err) {
            // silent
        }
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
        fetchLatestMessages();
        // Polling for updates every 10 seconds
        const interval = setInterval(() => {
            fetchDashboardData();
            fetchLatestMessages();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchDashboardData, fetchLatestMessages]);

    // Auto-start camera if auction is already live
    useEffect(() => {
        if (dashboardData.activeAuction && isLive && !streamReady && !agoraClientRef.current) {
            // Auction is active, start camera
            startAgoraStream(dashboardData.activeAuction.auction_id);
        }

        // Cleanup on unmount
        return () => {
            if (agoraClientRef.current) {
                const { audio, video } = localTracksRef.current;
                if (audio) {
                    audio.close();
                    localTracksRef.current.audio = null;
                }
                if (video) {
                    video.close();
                    localTracksRef.current.video = null;
                }
                agoraClientRef.current.leave().catch(() => {});
                agoraClientRef.current = null;
            }
        };
    }, [dashboardData.activeAuction, isLive, streamReady]);

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

    const startAgoraStream = async (auctionId) => {
        try {
            console.log('🎥 Requesting camera and microphone permissions...');

            // First, request browser permissions
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('✅ Browser permissions granted');

            // Stop the preview stream as Agora will create its own
            stream.getTracks().forEach(track => track.stop());

            // Dynamic import Agora
            const module = await import('agora-rtc-sdk-ng');
            AgoraRTC = module.default;
            AgoraRTC.setLogLevel(4);

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const token = localStorage.getItem('bidpal_token');

            console.log('🔑 Fetching Agora token...');
            // Fetch Agora token
            const tokenRes = await fetch(
                `${apiUrl}/api/agora/token?channelName=${auctionId}&role=host&uid=0`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) {
                throw new Error(tokenData.error || 'Failed to get Agora token');
            }
            console.log('✅ Agora token received');

            const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            agoraClientRef.current = client;

            await client.setClientRole('host');
            const uid = user?.id ? Number(String(user.id).replace(/\D/g, '').slice(-8)) || 0 : 0;

            console.log('🔗 Joining Agora channel...');
            await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID, String(auctionId), tokenData.token, uid);
            console.log('✅ Joined Agora channel');

            console.log('📹 Creating camera and microphone tracks...');
            // Create camera and mic tracks with simpler settings
            const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                { AEC: true, ANS: true },
                { encoderConfig: '480p_1' }
            );
            console.log('✅ Tracks created');

            localTracksRef.current = { audio: audioTrack, video: videoTrack };

            // Play video on dashboard
            console.log('▶️ Playing video on dashboard...');
            videoTrack.play('seller-camera-preview');
            setStreamReady(true);
            console.log('✅ Video playing');

            // Publish to channel
            console.log('📡 Publishing to channel...');
            await client.publish([audioTrack, videoTrack]);
            console.log('✅ Live stream started successfully!');
        } catch (err) {
            console.error('❌ Failed to start camera:', err);

            let errorMessage = 'Failed to start camera. ';

            if (err.name === 'NotAllowedError') {
                errorMessage += 'Camera/microphone permission denied. Please allow access in your browser settings.';
            } else if (err.name === 'NotReadableError' || err.code === 'NOT_READABLE') {
                errorMessage += 'Camera is already in use by another application. Please close other apps using the camera and try again.';
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'No camera or microphone found. Please connect a camera/microphone.';
            } else {
                errorMessage += err.message || 'Unknown error occurred.';
            }

            alert(errorMessage);
        }
    };

    const stopAgoraStream = () => {
        const { audio, video } = localTracksRef.current;
        if (audio) audio.close();
        if (video) video.close();
        if (agoraClientRef.current) {
            agoraClientRef.current.leave().catch(() => {});
        }
        setStreamReady(false);
    };

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
                    // Start camera on dashboard
                    await startAgoraStream(nextAuction.auction_id);
                    // Refresh dashboard to show active auction
                    fetchDashboardData();
                } else {
                    const error = await res.json();
                    alert(error.error || 'Failed to start auction');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred while starting the auction');
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
                    stopAgoraStream();
                    fetchDashboardData();
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const toggleMic = () => {
        const { audio } = localTracksRef.current;
        if (!audio) return;
        if (isMuted) { audio.setEnabled(true); } else { audio.setEnabled(false); }
        setIsMuted(!isMuted);
    };

    const toggleVideo = () => {
        const { video } = localTracksRef.current;
        if (!video) return;
        if (isVideoOff) { video.setEnabled(true); } else { video.setEnabled(false); }
        setIsVideoOff(!isVideoOff);
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
                    <Link href="/seller/add-product" className={styles.addBtnSmall}>
                        <Plus size={18} /> Add Product
                    </Link>
                    <button
                        className={`${styles.liveControlBtn} ${isLive ? styles.stop : styles.start} ${!hasProducts && !isLive ? styles.disabled : ''}`}
                        onClick={handleGoLive}
                        disabled={!hasProducts && !isLive}
                        title={!hasProducts ? 'Add products to start live auction' : ''}
                    >
                        {isLive ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {isLive ? 'End Stream' : 'Go Live'}
                    </button>
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
                                <div className={styles.showcaseImage} style={{ position: 'relative', background: '#000' }}>
                                    {streamReady ? (
                                        <>
                                            {/* Live Camera Feed */}
                                            <div
                                                id="seller-camera-preview"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    position: 'absolute',
                                                    inset: 0,
                                                    objectFit: 'cover'
                                                }}
                                            />
                                            {/* Camera Controls */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '1rem',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                display: 'flex',
                                                gap: '0.75rem',
                                                zIndex: 10
                                            }}>
                                                <button
                                                    onClick={toggleMic}
                                                    style={{
                                                        background: isMuted ? '#D32F2F' : 'rgba(255,255,255,0.2)',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: 44,
                                                        height: 44,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        backdropFilter: 'blur(4px)'
                                                    }}
                                                >
                                                    {isMuted ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
                                                </button>
                                                <button
                                                    onClick={toggleVideo}
                                                    style={{
                                                        background: isVideoOff ? '#D32F2F' : 'rgba(255,255,255,0.2)',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: 44,
                                                        height: 44,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        backdropFilter: 'blur(4px)'
                                                    }}
                                                >
                                                    {isVideoOff ? <VideoOff size={20} color="white" /> : <Video size={20} color="white" />}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <img src={activeItem.image} alt={activeItem.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {isLive && (
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'rgba(0,0,0,0.5)',
                                                    zIndex: 5
                                                }}>
                                                    <button
                                                        onClick={() => startAgoraStream(activeItem.id)}
                                                        style={{
                                                            padding: '14px 28px',
                                                            fontSize: '1rem',
                                                            fontWeight: 600,
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            background: '#D32F2F',
                                                            color: 'white',
                                                            border: 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)'
                                                        }}
                                                    >
                                                        <Video size={20} />
                                                        Start Camera
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
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

                    {/* Live Engagement / Messages Preview */}
                    <section className={`${styles.card} ${styles.chatCard}`}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <MessageSquare size={18} color="#111" />
                                <h2>Recent Messages</h2>
                            </div>
                            <Link href="/messages" style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, textDecoration: 'none' }}>View All</Link>
                        </div>
                        <div className={styles.chatBox}>
                            <div className={styles.commentList}>
                                {recentMessages.length > 0 ? recentMessages.map(msg => (
                                    <div key={msg.message_id} className={styles.comment}>
                                        <div className={styles.commentHeader}>
                                            <span className={styles.userName}>
                                                {msg.sender_id === (user?.user_id || user?.id) ? 'You' : 'Buyer'}
                                            </span>
                                            <span className={styles.commentTime}>
                                                {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={styles.commentText}>{msg.body}</p>
                                    </div>
                                )) : (
                                    <p className={styles.emptyChat}>No messages yet.<br /><Link href="/messages" style={{ color: '#555' }}>Check your inbox →</Link></p>
                                )}
                            </div>
                            {latestConvId && (
                                <div className={styles.chatInputArea}>
                                    <textarea
                                        placeholder="Quick reply..."
                                        className={styles.announcementInput}
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                router.push('/messages');
                                            }
                                        }}
                                    />
                                    <button
                                        className={styles.chatSendBtn}
                                        onClick={() => router.push('/messages')}
                                        title="Open Messages"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </>
    );
}
