'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
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
    const [bidderCount, setBidderCount] = useState(0);
    const [recentMessages, setRecentMessages] = useState([]);
    const [comments, setComments] = useState([]);
    const [latestConvId, setLatestConvId] = useState(null);
    const [streamReady, setStreamReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [liveDuration, setLiveDuration] = useState({ hours: 0, minutes: 0, seconds: 0 });

    // Agora refs
    const agoraClientRef = useRef(null);
    const localTracksRef = useRef({ audio: null, video: null });
    const socketRef = useRef(null);
    const liveStartTimeRef = useRef(null);

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

                // Set live start time for duration tracking
                if (data.activeAuction && data.activeAuction.start_time) {
                    liveStartTimeRef.current = new Date(data.activeAuction.start_time);
                }

                // If there's an active auction, fetch bids
                if (data.activeAuction) {
                    const bidsRes = await fetch(`${apiUrl}/api/dashboard/auction/${data.activeAuction.auction_id}/bids`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });
                    if (bidsRes.ok) {
                        const bidsData = await bidsRes.json();
                        setRecentBids(bidsData.bids || []);
                        setBidderCount(bidsData.bidderCount || 0);
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
    
    // ── Socket.IO for Live Comments ─────
    useEffect(() => {
        const auctionId = dashboardData.activeAuction?.auction_id;
        if (!auctionId || !isLive) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
        const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('📡 Connected to auction socket:', auctionId);
            socket.emit('join-auction', auctionId);

            // Fetch existing comments from database when joining
            fetch(`${apiUrl}/api/auctions/${auctionId}/comments`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const formattedComments = data.map(c => ({
                            id: c.comment_id,
                            user: c.username,
                            text: c.text,
                            sent_at: c.created_at,
                            user_id: c.user_id
                        }));
                        setComments(formattedComments);
                        console.log(`📥 Loaded ${data.length} existing comments`);
                    }
                })
                .catch(err => console.error('Failed to fetch existing comments:', err));
        });

        socket.on('new-comment', (comment) => {
            console.log('💬 New comment received:', comment);
            setComments(prev => [...prev, comment]);
        });

        // Listen for viewer count updates
        socket.on('viewer-count', (count) => {
            console.log('👥 Viewer count updated:', count);
            setDashboardData(prev => ({
                ...prev,
                stats: {
                    ...prev.stats,
                    viewers: count
                }
            }));
        });

        // Listen for new bids
        socket.on('bid-update', (bid) => {
            console.log('💰 New bid received:', bid);
            setRecentBids(prev => {
                // Prevent duplicates
                const bidExists = prev.some(b =>
                    b.bid_id === bid.bid_id ||
                    (b.bidder_name === bid.bidder_name && b.amount === bid.amount)
                );
                if (bidExists) return prev;
                return [bid, ...prev].slice(0, 20);
            });
        });

        // Listen for bidder count updates
        socket.on('bidder-count-update', ({ bidderCount, latestBid }) => {
            console.log('👤 Bidder count updated:', bidderCount);
            setBidderCount(bidderCount);
            if (latestBid) {
                setRecentBids(prev => {
                    // Prevent duplicates
                    const bidExists = prev.some(b =>
                        b.bid_id === latestBid.bid_id ||
                        (b.bidder_name === latestBid.bidder_name && b.amount === latestBid.amount)
                    );
                    if (bidExists) return prev;
                    return [latestBid, ...prev].slice(0, 20);
                });
            }
        });

        return () => {
            if (socketRef.current) {
                console.log('📡 Disconnecting from auction:', auctionId);
                socketRef.current.emit('leave-auction', auctionId);
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [dashboardData.activeAuction?.auction_id, isLive]);

    // Auto-start camera if auction is already live
    useEffect(() => {
        let cancelled = { val: false };
        const auctionId = dashboardData.activeAuction?.auction_id;

        if (auctionId && isLive && !streamReady && !agoraClientRef.current) {
            // Auction is active, start camera
            startAgoraStream(auctionId, cancelled);
        }

        // Cleanup on unmount or if auction/isLive changes
        return () => {
            cancelled.val = true;
            stopAgoraStream();
        };
    }, [dashboardData.activeAuction?.auction_id, isLive]);

    // Handle video playback once DOM container is ready
    useEffect(() => {
        if (streamReady && localTracksRef.current.video) {
            console.log('▶️ Playing video locally...');
            try {
                localTracksRef.current.video.play('seller-camera-preview');
            } catch (e) {
                console.warn('Video playback failed:', e);
            }
        }
    }, [streamReady]);

    // Live duration counter
    useEffect(() => {
        if (!isLive || !liveStartTimeRef.current) {
            setLiveDuration({ hours: 0, minutes: 0, seconds: 0 });
            return;
        }

        const updateDuration = () => {
            const now = new Date();
            const diff = now - liveStartTimeRef.current;
            const totalSeconds = Math.floor(diff / 1000);

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            setLiveDuration({ hours, minutes, seconds });
        };

        // Update immediately
        updateDuration();

        // Update every second
        const interval = setInterval(updateDuration, 1000);

        return () => clearInterval(interval);
    }, [isLive]);

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

    const startAgoraStream = async (auctionId, cancelled = { val: false }) => {
        try {
            console.log('🎥 Starting live stream setup...');

            // Dynamic import Agora first
            const module = await import('agora-rtc-sdk-ng');
            if (cancelled.val) return;
            AgoraRTC = module.default;
            AgoraRTC.setLogLevel(4); // Only errors

            // Get Agora token
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const token = localStorage.getItem('bidpal_token');

            console.log('🔑 Fetching Agora token...');
            const tokenRes = await fetch(
                `${apiUrl}/api/agora/token?channelName=${auctionId}&role=host&uid=0`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (cancelled.val) return;
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) {
                throw new Error(tokenData.error || 'Failed to get Agora token');
            }
            console.log('✅ Token received');

            // Create tracks FIRST (before creating client)
            console.log('📹 Creating camera and microphone tracks...');
            let audioTrack, videoTrack;

            try {
                [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                    {
                        AEC: true, // Echo cancellation
                        ANS: true, // Noise suppression
                        AGC: true  // Auto gain
                    },
                    {
                        encoderConfig: {
                            width: 640,
                            height: 480,
                            frameRate: 15,
                            bitrateMin: 300,
                            bitrateMax: 600,
                        }
                    }
                );
            } catch (mediaError) {
                console.error('Media error:', mediaError);
                throw new Error('CAMERA_IN_USE: ' + mediaError.message);
            }

            console.log('✅ Tracks created successfully');
            localTracksRef.current = { audio: audioTrack, video: videoTrack };

            // Video will be played by a separate useEffect once streamReady is true
            setStreamReady(true);

            if (cancelled.val) {
                audioTrack.stop();
                audioTrack.close();
                videoTrack.stop();
                videoTrack.close();
                return;
            }

            // NOW create client and join
            const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            agoraClientRef.current = client;

            await client.setClientRole('host');
            const uid = user?.id ? Number(String(user.id).replace(/\D/g, '').slice(-8)) || 0 : 0;

            console.log('🔗 Joining Agora channel...');
            try {
                await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID, String(auctionId), tokenData.token, uid);
                if (cancelled.val) {
                    client.leave().catch(() => {});
                    return;
                }
                console.log('✅ Joined channel');
            } catch (joinError) {
                if (cancelled.val || joinError?.code === 'OPERATION_ABORTED' || joinError?.message?.includes('cancel token canceled')) {
                    console.log('Agora join cancelled');
                    return;
                }
                console.error('Join failed:', joinError);
                // Don't fail completely - video still works locally
                console.warn('Continuing with local preview only');
                return;
            }

            // Publish tracks
            console.log('📡 Publishing tracks...');
            try {
                await client.publish([audioTrack, videoTrack]);
                console.log('✅ Live stream started!');
            } catch (pubError) {
                console.error('Publish failed:', pubError);
                console.warn('Continuing with local preview only');
            }

        } catch (err) {
            console.error('❌ Stream setup failed:', err);

            // Clean up any created tracks
            if (localTracksRef.current.audio) {
                localTracksRef.current.audio.close();
                localTracksRef.current.audio = null;
            }
            if (localTracksRef.current.video) {
                localTracksRef.current.video.close();
                localTracksRef.current.video = null;
            }

            setStreamReady(false);

            let errorMessage = 'Failed to start live stream. ';

            if (err.name === 'NotAllowedError') {
                errorMessage = 'Camera/Microphone Access Denied\n\nPlease allow camera and microphone access in your browser and refresh the page.';
            } else if (err.message && err.message.includes('CAMERA_IN_USE')) {
                errorMessage = 'Camera In Use\n\nYour camera is being used by another application.\n\nPlease close:\n• Zoom\n• Microsoft Teams\n• Skype\n• Other video apps\n\nThen refresh this page.';
            } else if (err.name === 'NotReadableError' || err.code === 'NOT_READABLE') {
                errorMessage = 'Camera Access Error\n\nCannot access camera. It may be:\n• Used by another application\n• Blocked by system settings\n• Hardware issue\n\nTry restarting your browser or computer.';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No Camera Found\n\nPlease connect a camera/webcam and refresh the page.';
            } else {
                errorMessage += err.message || 'Unknown error';
            }

            alert(errorMessage);
        }
    };

    const stopAgoraStream = async () => {
        console.log('🛑 Stopping stream...');

        // Unpublish and leave channel first
        if (agoraClientRef.current) {
            const client = agoraClientRef.current;
            agoraClientRef.current = null;
            
            if (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING' || client.connectionState === 'RECONNECTING') {
                try {
                    const { audio, video } = localTracksRef.current;
                    if (audio || video) {
                        const tracks = [audio, video].filter(Boolean);
                        // Silence unpublish errors during cleanup
                        await client.unpublish(tracks).catch(() => {});
                    }
                    // Silently handle leave regardless of the error type during cleanup
                    await client.leave().catch(e => {
                        // Only log if it's NOT a common abortion error
                        if (e.code !== 'OPERATION_ABORTED' && e.code !== 'WS_ABORT' && !e.message?.includes('LEAVE')) {
                            console.warn('Non-critical leave error:', e);
                        }
                    });
                } catch (e) {
                    // Fail silently for any unexpected cleanup errors
                }
            }
        }

        // Close tracks after leaving
        const { audio, video } = localTracksRef.current;
        if (audio) {
            audio.close();
            localTracksRef.current.audio = null;
        }
        if (video) {
            video.close();
            localTracksRef.current.video = null;
        }

        setStreamReady(false);
        console.log('✅ Stream stopped');
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

    const handleSendComment = () => {
        if (!messageInput.trim()) return;
        const auctionId = dashboardData.activeAuction?.auction_id;

        const newComment = {
            id: Date.now(),
            user_id: user?.id || user?.user_id || null,
            user: user?.Fname || 'Seller',
            text: messageInput,
            sent_at: new Date().toISOString()
        };

        if (socketRef.current && isLive && auctionId) {
            socketRef.current.emit('send-comment', { auctionId, comment: newComment });
            setMessageInput('');
        } else {
            // If not live, maybe it's a regular message?
            // The user wants live comments, so we'll just encourage going live.
            alert('You must be live to send comments to the auction room.');
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
                            {/* Live Badge */}
                            {isLive && (
                                <div className={styles.livePulseBadge}>
                                    <div className={styles.livePulseDot}></div>
                                    LIVE
                                </div>
                            )}

                            {/* Fullscreen Video Container */}
                            <div className={styles.videoContainer}>
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
                                        <div className={styles.cameraControls}>
                                            <button
                                                onClick={toggleMic}
                                                className={`${styles.controlBtn} ${isMuted ? styles.controlBtnDanger : ''}`}
                                                title={isMuted ? 'Unmute' : 'Mute'}
                                            >
                                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                            </button>
                                            <button
                                                onClick={toggleVideo}
                                                className={`${styles.controlBtn} ${isVideoOff ? styles.controlBtnDanger : ''}`}
                                                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                                            >
                                                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <img src={activeItem.image} alt={activeItem.title} className={styles.videoPlaceholder} />
                                        {isLive && (
                                            <div className={styles.cameraStartOverlay}>
                                                <button
                                                    onClick={() => startAgoraStream(activeItem.id)}
                                                    className={styles.startCameraBtn}
                                                >
                                                    <Video size={24} />
                                                    Start Camera
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Product Details Below Video */}
                            <div className={styles.productDetailsSection}>
                                <div className={styles.productHeader}>
                                    <div className={styles.productTitleArea}>
                                        <Radio size={18} color="#D32F2F" className={styles.productIcon} />
                                        <h1 className={styles.productTitle}>{activeItem.title}</h1>
                                    </div>
                                </div>

                                <div className={styles.productStatsGrid}>
                                    <div className={styles.statCard}>
                                        <div className={styles.statCardLabel}>Current Bid</div>
                                        <div className={styles.statCardValue}>₱{activeItem.currentBid.toLocaleString()}</div>
                                    </div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statCardLabel}>Live Duration</div>
                                        <div className={styles.statCardValue}>
                                            <Clock size={20} />
                                            {String(liveDuration.hours).padStart(2, '0')}:
                                            {String(liveDuration.minutes).padStart(2, '0')}:
                                            {String(liveDuration.seconds).padStart(2, '0')}
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
                            {activeItem && bidderCount > 0 && (
                                <div className={styles.biddersCount}>
                                    <Users size={16} /> {bidderCount} Bidder{bidderCount !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                        <div className={styles.bidsList}>
                            {recentBids.length > 0 ? recentBids.map((bid, index) => (
                                <div key={bid.bid_id || index} className={styles.bidRow}>
                                    <div>
                                        <div className={styles.bidderName}>{bid.bidder_name}</div>
                                        <div className={styles.bidTimestamp}>{bid.timeAgo}</div>
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

                    {/* Completed Auctions - Hidden per user request
                    <section className={styles.card}>
                        ... (content hidden)
                    </section>
                    */}
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
                                <h2>Live Comments</h2>
                            </div>
                            <button 
                                onClick={() => setComments([])} 
                                style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Clear
                            </button>
                        </div>
                        <div className={styles.chatBox}>
                            <div className={styles.commentList}>
                                {comments.length > 0 ? comments.map(msg => (
                                    <div key={msg.id} className={styles.comment}>
                                        <div className={styles.commentHeader}>
                                            <span className={styles.userName}>
                                                {msg.user}
                                            </span>
                                            <span className={styles.commentTime}>
                                                {new Date(msg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={styles.commentText}>{msg.text || msg.body}</p>
                                    </div>
                                )) : (
                                    <p className={styles.emptyChat}>
                                        {isLive ? 'No comments yet. Start the conversation!' : 'Comments will appear here when you go live.'}
                                    </p>
                                )}
                            </div>
                            <div className={styles.chatInputArea}>
                                <textarea
                                    placeholder={isLive ? "Type a comment..." : "Go live to comment"}
                                    className={styles.announcementInput}
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    rows={1}
                                    disabled={!isLive}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendComment();
                                        }
                                    }}
                                />
                                <button
                                    className={styles.chatSendBtn}
                                    onClick={handleSendComment}
                                    disabled={!isLive || !messageInput.trim()}
                                    title="Send Comment"
                                >
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
