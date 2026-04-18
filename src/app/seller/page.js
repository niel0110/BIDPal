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
    User,
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
    const [auctionEndModal, setAuctionEndModal] = useState({ show: false, hasWinner: false, winner: null });
    const [mobileTab, setMobileTab] = useState('live');
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [setupPermissions, setSetupPermissions] = useState({ cam: 'pending', mic: 'pending' });

    // Agora refs
    const agoraClientRef = useRef(null);
    const localTracksRef = useRef({ audio: null, video: null });
    const socketRef = useRef(null);
    const liveStartTimeRef = useRef(null);
    const setupStreamRef = useRef(null);
    const setupVideoRef = useRef(null);
    const chatScrollRef = useRef(null);

    const fetchDashboardData = useCallback(async () => {
        if (!user) {
            router.push('/');
            return;
        }
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const seller_id = user.seller_id;
            const user_id = user.user_id || user.id;

            const res = await fetch(`${apiUrl}/api/dashboard/summary?${seller_id ? `seller_id=${seller_id}` : `user_id=${user_id}`}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (res.status === 401 || res.status === 403) {
                console.warn('Session expired in dashboard summary. Logging out.');
                logout();
                return;
            }

            if (res.ok) {
                const data = await res.json();
                // Show live concurrent viewers only (not accumulated total views)
                if (data.stats) {
                    data.stats.viewers = data.stats.liveViewers ?? 0;
                }
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const convRes = await fetch(`${apiUrl}/api/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (convRes.status === 401 || convRes.status === 403) {
                logout();
                return;
            }
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
        if (!user) {
            router.replace('/');
            return;
        }
        
        fetchDashboardData();
        fetchLatestMessages();
        // Polling for updates every 10 seconds
        const interval = setInterval(() => {
            fetchDashboardData();
            fetchLatestMessages();
        }, 10000);
        return () => clearInterval(interval);
    }, [user, router, fetchDashboardData, fetchLatestMessages]);
    
    // ── Poll auction stats while live ───
    useEffect(() => {
        const auctionId = dashboardData.activeAuction?.auction_id;
        if (!auctionId || !isLive) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        const pollStats = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/stats`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.stats) {
                    setDashboardData(prev => ({
                        ...prev,
                        stats: {
                            ...prev.stats,
                            viewers: data.stats.liveViewers ?? prev.stats.viewers,
                            likes: data.stats.likes ?? prev.stats.likes,
                            shares: data.stats.shares ?? prev.stats.shares,
                        }
                    }));
                }
            } catch (_) {}
        };

        pollStats();
        const interval = setInterval(pollStats, 15000);
        return () => clearInterval(interval);
    }, [dashboardData.activeAuction?.auction_id, isLive]);

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

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('📡 Connected to auction socket:', auctionId);
            socket.emit('join-auction', { auctionId, role: 'seller' });

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

        // Listen for real-time stat updates
        socket.on('viewer-count', (count) => {
            setDashboardData(prev => ({
                ...prev,
                stats: { ...prev.stats, viewers: count }
            }));
        });

        socket.on('total-views-update', (count) => {
            setDashboardData(prev => ({
                ...prev,
                stats: { ...prev.stats, viewers: count }
            }));
        });

        socket.on('like-update', (count) => {
            setDashboardData(prev => ({
                ...prev,
                stats: { ...prev.stats, likes: count }
            }));
        });

        socket.on('share-update', (count) => {
            setDashboardData(prev => ({
                ...prev,
                stats: { ...prev.stats, shares: count }
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

    // Auto-scroll chat to latest comment
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [comments]);

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

    const hasPlayedRef = useRef(false);

    // Handle video playback once DOM container is ready
    useEffect(() => {
        if (!streamReady) {
            hasPlayedRef.current = false;
        }

        if (streamReady && localTracksRef.current.video && dashboardData.activeAuction?.auction_id) {
            const container = document.getElementById('seller-camera-preview');
            if (container && !hasPlayedRef.current) {
                console.log('▶️ Playing video locally...');
                try {
                    container.innerHTML = '';
                    localTracksRef.current.video.play(container);
                    hasPlayedRef.current = true;
                } catch (e) {
                    console.warn('Video playback failed:', e);
                }
            }
        }
    }, [streamReady, dashboardData.activeAuction?.auction_id]);

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
        image: (dashboardData.activeAuction.products?.images?.[0]?.image_url && dashboardData.activeAuction.products?.images?.[0]?.image_url !== 'noposter') ? dashboardData.activeAuction.products?.images?.[0]?.image_url : "https://placehold.co/400x400?text=No+Image",
        currentBid: dashboardData.activeAuction.current_price || dashboardData.activeAuction.reserve_price || 0,
        timeLeft: '---', // Needs timer logic
        bidders: dashboardData.activeAuction.bids?.[0]?.count || 0
    } : null;

    const handleSetNext = (auctionId) => {
        setDashboardData(prev => {
            const queue = [...prev.queue];
            const idx = queue.findIndex(i => i.auction_id === auctionId);
            if (idx <= 0) return prev; // already first or not found
            const [item] = queue.splice(idx, 1);
            queue.unshift(item);
            return { ...prev, queue };
        });
    };

    // Check if there are products available (queue + active)
    const hasProducts = dashboardData.queue.length > 0 || activeItem !== null;

    // Seller is "new" when they have no auction history at all
    const isNewSeller = !activeItem && dashboardData.queue.length === 0 && dashboardData.completed.length === 0;

    const startAgoraStream = async (auctionId, cancelled = { val: false }) => {
        try {
            console.log('🎥 Starting live stream setup...');

            // Dynamic import Agora first
            const module = await import('agora-rtc-sdk-ng');
            if (cancelled.val) return;
            AgoraRTC = module.default;
            AgoraRTC.setLogLevel(4); // Only errors

            // Get Agora token
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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

    // Stop the camera preview stream in the setup modal
    const stopSetupPreview = () => {
        if (setupStreamRef.current) {
            setupStreamRef.current.getTracks().forEach(t => t.stop());
            setupStreamRef.current = null;
        }
    };

    // Request camera + mic for the pre-live setup modal
    const startSetupPreview = async () => {
        setSetupPermissions({ cam: 'pending', mic: 'pending' });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setupStreamRef.current = stream;
            setSetupPermissions({ cam: 'granted', mic: 'granted' });
        } catch (err) {
            const camDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
            setSetupPermissions({ cam: camDenied ? 'denied' : 'error', mic: camDenied ? 'denied' : 'error' });
        }
    };

    // Attach stream to preview video when both modal and stream are ready
    useEffect(() => {
        if (showSetupModal && setupPermissions.cam === 'granted' && setupVideoRef.current && setupStreamRef.current) {
            setupVideoRef.current.srcObject = setupStreamRef.current;
            setupVideoRef.current.play().catch(() => {});
        }
    }, [showSetupModal, setupPermissions]);

    // Cleanup preview when modal closes
    useEffect(() => {
        if (!showSetupModal) stopSetupPreview();
    }, [showSetupModal]);

    // The actual go-live logic (called after setup confirmation)
    const executeGoLive = async () => {
        if (dashboardData.queue.length === 0) {
            alert('You need to schedule products before starting a live auction.');
            return;
        }
        const nextAuction = dashboardData.queue[0];
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/auctions/${nextAuction.auction_id}/start`, {
                method: 'POST',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });
            if (res.ok) {
                await fetchDashboardData();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to start auction');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred while starting the auction');
        }
    };

    const handleSetupConfirm = async () => {
        stopSetupPreview();
        setShowSetupModal(false);
        setSetupPermissions({ cam: 'pending', mic: 'pending' });
        await executeGoLive();
    };

    const handleSetupCancel = () => {
        stopSetupPreview();
        setShowSetupModal(false);
        setSetupPermissions({ cam: 'pending', mic: 'pending' });
    };

    const handleGoLive = async () => {
        if (!isLive) {
            if (dashboardData.queue.length === 0) {
                alert('You need to schedule products before starting a live auction.');
                return;
            }
            setShowSetupModal(true);
            startSetupPreview();
            return;
        } else {
            // End Stream
            const confirmed = confirm('Are you sure you want to end this live auction? This will declare the winner and cannot be undone.');
            if (!confirmed) return;

            try {
                console.log('🏁 Ending auction:', activeItem.id);
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');

                const res = await fetch(`${apiUrl}/api/auctions/${activeItem.id}/end`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });

                const data = await res.json();
                console.log('End auction response:', data);

                if (res.ok) {
                    console.log('✅ Auction ended successfully');

                    // Stop stream and refresh
                    await stopAgoraStream();
                    await fetchDashboardData();

                    // Show modal with winner info
                    setAuctionEndModal({
                        show: true,
                        hasWinner: data.has_winner,
                        winner: data.winner
                    });
                } else {
                    console.error('Failed to end auction:', data);
                    alert(`Failed to end auction: ${data.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('Error ending auction:', err);
                alert(`Error ending auction: ${err.message}`);
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
            {/* Header */}
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
                        title={!hasProducts ? 'Add products to your queue first' : ''}
                    >
                        {isLive ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        {isLive ? 'End Stream' : 'Go Live'}
                    </button>
                </div>
            </header>

            {/* Mobile Tab Bar — Live | Queue */}
            <nav className={styles.mobileTabBar}>
                <button
                    className={`${styles.mobileTab} ${mobileTab === 'live' ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab('live')}
                >
                    <Radio size={15} />
                    <span>Live</span>
                </button>
                <button
                    className={`${styles.mobileTab} ${mobileTab === 'queue' ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab('queue')}
                >
                    <Clock size={15} />
                    <span>Queue</span>
                </button>
            </nav>

            <div className={styles.controlRoom}>

                {/* ── LEFT / MAIN: Video → Product Info → Bids → Chat ── */}
                <div className={`${styles.mainWorkArea} ${mobileTab !== 'live' ? styles.tabSectionHidden : ''}`}>

                    {/* Video section (with stats + camera controls overlaid) */}
                    {activeItem ? (
                        <div className={styles.liveAuctionArea}>
                            {isLive && (
                                <div className={styles.livePulseBadge}>
                                    <div className={styles.livePulseDot}></div>
                                    LIVE
                                </div>
                            )}

                            <div className={styles.videoContainer}>
                                {streamReady ? (
                                    <div
                                        id="seller-camera-preview"
                                        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }}
                                    />
                                ) : (
                                    <>
                                        <img src={activeItem.image} alt={activeItem.title} className={styles.videoPlaceholder} />
                                        {isLive && (
                                            <div className={styles.cameraStartOverlay}>
                                                <button onClick={() => startAgoraStream(activeItem.id)} className={styles.startCameraBtn}>
                                                    <Video size={22} /> Start Camera
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Stats overlay — always visible over video */}
                                <div className={styles.videoStatsOverlay}>
                                    <div className={styles.videoStat}>
                                        <Eye size={13} />
                                        <span>{dashboardData.stats.viewers}</span>
                                    </div>
                                    <div className={styles.videoStat}>
                                        <Heart size={13} />
                                        <span>{dashboardData.stats.likes}</span>
                                    </div>
                                    <div className={styles.videoStat}>
                                        <Share2 size={13} />
                                        <span>{dashboardData.stats.shares}</span>
                                    </div>
                                </div>

                                {/* Camera controls */}
                                {streamReady && (
                                    <div className={styles.cameraControls}>
                                        <button onClick={toggleMic} className={`${styles.controlBtn} ${isMuted ? styles.controlBtnDanger : ''}`} title={isMuted ? 'Unmute' : 'Mute'}>
                                            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                        </button>
                                        <button onClick={toggleVideo} className={`${styles.controlBtn} ${isVideoOff ? styles.controlBtnDanger : ''}`} title={isVideoOff ? 'Camera on' : 'Camera off'}>
                                            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Product info strip */}
                            <div className={styles.productDetailsSection}>
                                <div className={styles.productTitleArea}>
                                    <Radio size={14} color="#D32F2F" className={styles.productIcon} />
                                    <h1 className={styles.productTitle}>{activeItem.title}</h1>
                                </div>
                                <div className={styles.productStatsGrid}>
                                    <div className={styles.statCard}>
                                        <div className={styles.statCardLabel}>Current Bid</div>
                                        <div className={styles.statCardValue}>₱{activeItem.currentBid.toLocaleString()}</div>
                                    </div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statCardLabel}>Duration</div>
                                        <div className={styles.statCardValue}>
                                            <Clock size={14} />
                                            {String(liveDuration.hours).padStart(2, '0')}:{String(liveDuration.minutes).padStart(2, '0')}:{String(liveDuration.seconds).padStart(2, '0')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <Radio size={48} color="#ddd" strokeWidth={1.5} />
                            <h2>No Active Auction</h2>
                            <p>{isNewSeller ? 'Add products to your queue, then hit Go Live.' : 'No auction live. Add products to the Queue tab and hit Go Live.'}</p>
                            {isNewSeller && (
                                <Link href="/seller/add-product" className={styles.emptyStateBtn}>
                                    <Plus size={16} /> Add Your First Product
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Combined Bids & Chat — side by side */}
                    <section className={styles.bidsChatCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitleGroup}>
                                <Gavel size={15} color="#111" />
                                <div className={styles.cardHeaderText}>
                                    <h2>Bids &amp; Chat</h2>
                                    {bidderCount > 0 && <p>{bidderCount} active bidder{bidderCount !== 1 ? 's' : ''}</p>}
                                </div>
                            </div>
                            <button onClick={() => setComments([])} className={styles.clearChatBtn}>
                                Clear chat
                            </button>
                        </div>

                        <div className={styles.bidsChatBody}>
                            {/* Left: Bids */}
                            <div className={styles.bidsChatLeft}>
                                <div className={styles.bidsChatLabel}>
                                    <Gavel size={11} /> Bids
                                </div>
                                <div className={styles.bidsScroll}>
                                    {recentBids.length > 0 ? recentBids.map((bid, index) => (
                                        <div key={bid.bid_id || index} className={styles.bidRowCompact}>
                                            <div className={styles.bidderAvatarSm}>
                                                {(bid.bidder_name || 'B').charAt(0).toUpperCase()}
                                            </div>
                                            <span className={styles.bidderNameSm}>{bid.bidder_name || 'Anon'}</span>
                                            <span className={styles.bidPriceSm}>₱{Number(bid.amount).toLocaleString()}</span>
                                        </div>
                                    )) : (
                                        <p className={styles.emptyColMsg}>No bids yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Right: Chat */}
                            <div className={styles.bidsChatRight}>
                                <div className={styles.bidsChatLabel}>
                                    <MessageSquare size={11} /> Chat
                                </div>
                                <div className={styles.chatScroll} ref={chatScrollRef}>
                                    {comments.length > 0 ? comments.map(msg => (
                                        <div key={msg.id} className={styles.commentCompact}>
                                            <span className={styles.commentUserSm}>{msg.user}</span>
                                            <p className={styles.commentTextSm}>{msg.text || msg.body}</p>
                                        </div>
                                    )) : (
                                        <p className={styles.emptyColMsg}>
                                            {isLive ? 'No comments yet.' : 'Go live to chat.'}
                                        </p>
                                    )}
                                </div>
                                <div className={styles.chatInputCompact}>
                                    <input
                                        type="text"
                                        placeholder={isLive ? 'Say something…' : 'Go live first'}
                                        className={styles.chatInputSm}
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        disabled={!isLive}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSendComment();
                                            }
                                        }}
                                    />
                                    <button
                                        className={styles.chatSendBtnSm}
                                        onClick={handleSendComment}
                                        disabled={!isLive || !messageInput.trim()}
                                    >
                                        <Send size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                {/* ── RIGHT / QUEUE TAB: Product Queue ── */}
                <aside className={`${styles.interactionPanel} ${mobileTab !== 'queue' ? styles.tabSectionHidden : ''}`}>
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderText}>
                                <h2>Product Queue</h2>
                                <p>Up next in the auction</p>
                            </div>
                            <Link href="/seller/add-product" className={styles.addQueueBtn}>
                                <Plus size={13} /> Add
                            </Link>
                        </div>
                        <div className={styles.queueGrid}>
                            {dashboardData.queue.length > 0 ? dashboardData.queue.map((item, idx) => (
                                <div key={item.auction_id} className={`${styles.queueGridItem} ${idx === 0 ? styles.queueGridItemFirst : ''}`}>
                                    <img src={(item.products?.images?.[0]?.image_url && item.products?.images?.[0]?.image_url !== 'noposter') ? item.products?.images?.[0]?.image_url : 'https://placehold.co/100x100?text=No+Image'} alt={item.products?.name} />
                                    <div className={styles.queueGridMeta}>
                                        <h4>{item.products?.name}</h4>
                                        <span>₱{item.reserve_price?.toLocaleString() || item.buy_now_price?.toLocaleString()}</span>
                                    </div>
                                    {!isLive ? (
                                        idx === 0 ? (
                                            <button className={styles.goLiveQueueBtn} onClick={handleGoLive}>Go Live</button>
                                        ) : (
                                            <button className={styles.setNextBtn} onClick={() => handleSetNext(item.auction_id)}>Set Next</button>
                                        )
                                    ) : (
                                        idx === 0 ? (
                                            <span className={styles.upNextBadge}>Up Next</span>
                                        ) : (
                                            <button className={styles.setNextBtn} onClick={() => handleSetNext(item.auction_id)}>Set Next</button>
                                        )
                                    )}
                                </div>
                            )) : (
                                <div className={styles.emptyQueue}>
                                    <p>Queue is empty.</p>
                                    <Link href="/seller/add-product">+ Add a product</Link>
                                </div>
                            )}
                        </div>
                    </section>
                </aside>

            </div>

            {/* Pre-Live Setup Modal */}
            {showSetupModal && (
                <div className={styles.modalOverlay} onClick={handleSetupCancel}>
                    <div className={styles.setupModalContent} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.setupModalTitle}>Camera &amp; Mic Setup</h2>
                        <p className={styles.setupModalSub}>Allow access so buyers can see and hear you.</p>

                        <div className={styles.setupPreviewWrap}>
                            {setupPermissions.cam === 'granted' ? (
                                <video
                                    ref={setupVideoRef}
                                    className={styles.setupPreviewVideo}
                                    autoPlay
                                    muted
                                    playsInline
                                />
                            ) : setupPermissions.cam === 'denied' || setupPermissions.cam === 'error' ? (
                                <div className={styles.setupPreviewBlocked}>
                                    <VideoOff size={32} color="#bbb" />
                                    <span>Camera blocked</span>
                                </div>
                            ) : (
                                <div className={styles.setupPreviewBlocked}>
                                    <Video size={28} color="#bbb" />
                                    <span>Requesting access…</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.setupPermList}>
                            <div className={styles.setupPermRow}>
                                <div className={`${styles.setupPermDot} ${
                                    setupPermissions.cam === 'granted' ? styles.setupPermGranted :
                                    setupPermissions.cam === 'denied' || setupPermissions.cam === 'error' ? styles.setupPermDenied :
                                    styles.setupPermPending
                                }`} />
                                <Video size={14} />
                                <span>Camera</span>
                                <span className={styles.setupPermStatus}>
                                    {setupPermissions.cam === 'granted' ? 'Allowed' :
                                     setupPermissions.cam === 'denied' ? 'Blocked — check browser settings' :
                                     setupPermissions.cam === 'error' ? 'Error' : 'Waiting…'}
                                </span>
                            </div>
                            <div className={styles.setupPermRow}>
                                <div className={`${styles.setupPermDot} ${
                                    setupPermissions.mic === 'granted' ? styles.setupPermGranted :
                                    setupPermissions.mic === 'denied' || setupPermissions.mic === 'error' ? styles.setupPermDenied :
                                    styles.setupPermPending
                                }`} />
                                <Mic size={14} />
                                <span>Microphone</span>
                                <span className={styles.setupPermStatus}>
                                    {setupPermissions.mic === 'granted' ? 'Allowed' :
                                     setupPermissions.mic === 'denied' ? 'Blocked' :
                                     setupPermissions.mic === 'error' ? 'Error' : 'Waiting…'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.setupActions}>
                            <button className={styles.setupCancelBtn} onClick={handleSetupCancel}>Cancel</button>
                            <button
                                className={styles.setupStartBtn}
                                onClick={handleSetupConfirm}
                                disabled={setupPermissions.cam !== 'granted' || setupPermissions.mic !== 'granted'}
                            >
                                <Play size={14} fill="currentColor" /> Start Live
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auction End Modal */}
            {auctionEndModal.show && (
                <div className={styles.modalOverlay} onClick={() => setAuctionEndModal({ show: false, hasWinner: false, winner: null })}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        {auctionEndModal.hasWinner ? (
                            <>
                                <div className={styles.modalIcon}>
                                    <div className={styles.iconCircle}>🎉</div>
                                </div>
                                <h2 className={styles.modalTitle}>Auction ended!</h2>
                                <div className={styles.modalBody}>
                                    <div className={styles.winnerInfo}>
                                        <div className={styles.winnerLabel}>Winner</div>
                                        <div className={styles.winnerValue}>
                                            User {auctionEndModal.winner?.user_id}
                                        </div>
                                    </div>
                                    <div className={styles.priceInfo}>
                                        <div className={styles.priceLabel}>Final Price</div>
                                        <div className={styles.priceValue}>
                                            ₱{auctionEndModal.winner?.bid_amount?.toLocaleString('en-PH')}
                                        </div>
                                    </div>
                                    <div className={styles.notificationNote}>
                                        Both you and the winner have been notified.
                                    </div>
                                </div>
                                <button
                                    className={styles.modalBtn}
                                    onClick={() => setAuctionEndModal({ show: false, hasWinner: false, winner: null })}
                                >
                                    OK
                                </button>
                            </>
                        ) : (
                            <>
                                <div className={styles.modalIcon}>
                                    <div className={styles.iconCircle}>📋</div>
                                </div>
                                <h2 className={styles.modalTitle}>Auction ended</h2>
                                <div className={styles.modalBody}>
                                    <p className={styles.noWinnerText}>
                                        No bids were placed or reserve price was not met.
                                    </p>
                                </div>
                                <button
                                    className={styles.modalBtn}
                                    onClick={() => setAuctionEndModal({ show: false, hasWinner: false, winner: null })}
                                >
                                    OK
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
