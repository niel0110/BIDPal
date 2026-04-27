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
    VideoOff,
    ShieldX,
    AlertTriangle,
    Trash2,
} from 'lucide-react';
import Logo from '@/components/Logo';
import styles from './page.module.css';

// Dynamically import Agora to avoid SSR issues
let AgoraRTC = null;

export default function SellerDashboard() {
    const { user, logout } = useAuth();
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
    const [kycStatus, setKycStatus] = useState(null);
    const [kycLoading, setKycLoading] = useState(true);
    const [kycToast, setKycToast] = useState(null);
    const [deletedAt, setDeletedAt] = useState(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const kycStatusRef = useRef(null);
    const kycLoadedRef = useRef(false);
    const kycNotifRef = useRef(null); // tracks notification_id currently shown (prevents duplicate toasts)

    // Agora refs
    const agoraClientRef = useRef(null);
    const localTracksRef = useRef({ audio: null, video: null });
    const socketRef = useRef(null);
    const liveStartTimeRef = useRef(null);
    const setupStreamRef = useRef(null);
    const setupVideoRef = useRef(null);
    const chatScrollRef = useRef(null);

    // Fetch fresh kyc_status and poll every 30s to detect admin decisions in real-time
    useEffect(() => {
        if (!user?.user_id) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        const checkKyc = async () => {
            try {
                const token = localStorage.getItem('bidpal_token');
                const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

                const res = await fetch(`${apiUrl}/api/users/${user.user_id}`, { headers: authHeader });
                if (!res.ok) return;
                const data = await res.json();
                const newStatus = data.kyc_status ?? null;
                if (data.deleted_at) setDeletedAt(data.deleted_at);

                kycStatusRef.current = newStatus;
                setKycStatus(newStatus);

                // Check Supabase for an unread KYC decision notification (replaces localStorage tracking)
                const notifRes = await fetch(`${apiUrl}/api/notifications`, { headers: authHeader }).catch(() => null);
                if (notifRes?.ok) {
                    const notifs = await notifRes.json().catch(() => []);
                    const now = new Date().toISOString();
                    const kycNotif = Array.isArray(notifs) ? notifs.find(n =>
                        n.type === 'system' &&
                        n.read_at > now &&
                        (n.payload?.title?.includes('Verification Approved') || n.payload?.title?.includes('Verification Rejected'))
                    ) : null;

                    if (kycNotif && kycNotifRef.current !== kycNotif.notification_id) {
                        kycNotifRef.current = kycNotif.notification_id;
                        const isApproved = kycNotif.payload?.title?.includes('Approved');
                        setKycToast({ status: isApproved ? 'approved' : 'rejected', notification_id: kycNotif.notification_id });
                    }
                }
            } catch {}  finally {
                if (!kycLoadedRef.current) {
                    kycLoadedRef.current = true;
                    setKycLoading(false);
                }
            }
        };

        checkKyc();
        const interval = setInterval(checkKyc, 30000);
        return () => clearInterval(interval);
    }, [user?.user_id]);

    const dismissKycToast = async () => {
        if (kycToast?.notification_id) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            await fetch(`${apiUrl}/api/notifications/${kycToast.notification_id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
        }
        setKycToast(null);
    };

    const fetchDashboardData = useCallback(async () => {
        if (!user) {
            router.push('/');
            return;
        }
        if (kycStatusRef.current === 'rejected' || kycStatusRef.current === 'cancelled') return;
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
            // Network errors are expected when backend is temporarily unreachable — don't spam console
            if (err?.name !== 'TypeError') console.error('Dashboard data error:', err);
        }
    }, [user]);

    // Fetch latest conversation messages for Engagement panel
    const fetchLatestMessages = useCallback(async () => {
        if (!user) return;
        if (kycStatusRef.current === 'rejected' || kycStatusRef.current === 'cancelled') return;
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

    const handleCancelAccount = async () => {
        if (!user?.user_id) return;
        setCancelling(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}/cancel-account`, {
                method: 'POST',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            });
            const data = await res.json();
            if (data.deletion_date) setDeletedAt(data.deletion_date);
            setKycStatus('cancelled');
            setShowCancelConfirm(false);
            logout();
        } catch {
            alert('Something went wrong. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    // ── Shared KYC page styles ─────────────────────────────────────────────────
    const kycStyles = `
        .kycWrap {
            position: fixed;
            inset: 0;
            z-index: 9000;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1.25rem 1rem;
            overflow-y: auto;
        }
        .kycWrap--red {
            background: linear-gradient(160deg, #fff0f0 0%, #fff5f5 50%, #fffafa 100%);
        }
        .kycWrap--gray {
            background: linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #ffffff 100%);
        }
        /* Decorative blobs */
        .kycBlob1, .kycBlob2 {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.35;
            pointer-events: none;
        }
        .kycWrap--red .kycBlob1 { width: 260px; height: 260px; background: #fca5a5; top: -80px; right: -80px; }
        .kycWrap--red .kycBlob2 { width: 180px; height: 180px; background: #fda4af; bottom: -60px; left: -60px; }
        .kycWrap--gray .kycBlob1 { width: 260px; height: 260px; background: #c7d2fe; top: -80px; right: -80px; }
        .kycWrap--gray .kycBlob2 { width: 180px; height: 180px; background: #e0e7ff; bottom: -60px; left: -60px; }

        .kycCard {
            position: relative;
            width: 100%;
            max-width: 420px;
            margin: auto;
            background: white;
            border-radius: 24px;
            padding: 0;
            text-align: center;
            box-shadow: 0 8px 40px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
            overflow: hidden;
        }
        .kycCardAccent {
            height: 5px;
            width: 100%;
        }
        .kycCardAccent--red { background: linear-gradient(90deg, #cc2b41, #f87171, #cc2b41); }
        .kycCardAccent--gray { background: linear-gradient(90deg, #6366f1, #818cf8, #6366f1); }
        .kycCardBody { padding: 1.5rem 1.75rem 1.75rem; }

        .kycLogoWrap {
            display: flex;
            justify-content: center;
            margin-bottom: 0.875rem;
        }
        .kycDivider {
            width: 40px; height: 2px;
            background: #f1f5f9;
            border-radius: 2px;
            margin: 0 auto 0.875rem;
        }
        .kycIconRing {
            width: 64px; height: 64px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 0.875rem;
        }
        .kycIconRing--red {
            background: linear-gradient(135deg, #fef2f2, #ffe4e6);
            box-shadow: 0 0 0 8px rgba(204,43,65,0.06);
        }
        .kycIconRing--gray {
            background: linear-gradient(135deg, #eef2ff, #e0e7ff);
            box-shadow: 0 0 0 8px rgba(99,102,241,0.06);
        }

        .kycTitle {
            font-weight: 800;
            font-size: 1.25rem;
            line-height: 1.25;
            margin-bottom: 0.5rem;
        }
        .kycTitle--red { color: #be123c; }
        .kycTitle--dark { color: #1e293b; }

        .kycSubtitle {
            color: #64748b;
            font-size: 0.82rem;
            line-height: 1.6;
            margin-bottom: 0.375rem;
        }
        .kycInfoBox {
            background: #fff8f8;
            border: 1px solid #fecdd3;
            border-radius: 12px;
            padding: 0.75rem 0.875rem;
            margin: 0.75rem 0 1.25rem;
            font-size: 0.82rem;
            color: #9f1239;
            line-height: 1.6;
            text-align: left;
            display: flex;
            gap: 0.625rem;
            align-items: flex-start;
        }
        .kycInfoBox--gray {
            background: #f8fafc;
            border-color: #e2e8f0;
            color: #475569;
        }
        .kycInfoDot {
            width: 6px; height: 6px; border-radius: 50%;
            background: #cc2b41; flex-shrink: 0; margin-top: 5px;
        }
        .kycInfoDot--gray { background: #6366f1; }

        .kycActions { display: flex; flex-direction: column; gap: 0.625rem; }
        .kycBtn {
            width: 100%; border: none; border-radius: 12px;
            padding: 0.75rem 1rem; font-weight: 700;
            font-size: 0.88rem; cursor: pointer;
            transition: transform 0.1s, opacity 0.15s;
            letter-spacing: 0.01em;
        }
        .kycBtn:active { transform: scale(0.98); }
        .kycBtn:disabled { opacity: 0.6; cursor: not-allowed; }
        .kycBtn--primary {
            background: linear-gradient(135deg, #cc2b41, #e8455a);
            color: white;
            box-shadow: 0 4px 14px rgba(204,43,65,0.35);
        }
        .kycBtn--ghost {
            background: transparent; color: #94a3b8;
            border: 1.5px solid #e2e8f0; font-weight: 600;
            font-size: 0.83rem;
        }
        .kycBtn--muted { background: #f1f5f9; color: #475569; font-weight: 600; }

        /* Bottom sheet */
        .kycOverlay {
            position: fixed; inset: 0;
            background: rgba(15,23,42,0.6);
            z-index: 9999;
            display: flex; align-items: flex-end; justify-content: center;
            backdrop-filter: blur(2px);
        }
        .kycSheet {
            background: white; width: 100%; max-width: 480px;
            border-radius: 24px 24px 0 0;
            padding: 1.5rem 1.5rem 2.5rem;
            text-align: center;
            box-shadow: 0 -4px 32px rgba(0,0,0,0.14);
            animation: slideUp 0.25s ease;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .kycSheetHandle { width: 36px; height: 4px; background: #e2e8f0; border-radius: 2px; margin: 0 auto 1.25rem; }
        .kycSheetIcon { width: 56px; height: 56px; border-radius: 50%; background: #fff7ed; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.875rem; }
        .kycSheetTitle { font-weight: 800; font-size: 1.1rem; color: #1e293b; margin-bottom: 0.5rem; }
        .kycSheetBody { color: #64748b; font-size: 0.82rem; line-height: 1.75; margin-bottom: 1.25rem; }
        .kycSheetWarning { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 0.75rem 0.875rem; font-size: 0.78rem; color: #c2410c; line-height: 1.6; margin-bottom: 1.5rem; text-align: left; }
        .kycSheetActions { display: flex; gap: 0.625rem; }
        .kycSheetActions .kycBtn { font-size: 0.85rem; padding: 0.8rem; }

        @media (max-width: 480px) {
            .kycCard { border-radius: 20px; }
            .kycCardBody { padding: 1.25rem 1.25rem 1.5rem; }
            .kycTitle { font-size: 1.15rem; }
        }
        @media (max-width: 360px) {
            .kycCardBody { padding: 1rem 1rem 1.25rem; }
            .kycBtn { font-size: 0.83rem; padding: 0.7rem; }
            .kycSheetActions { flex-direction: column; }
            .kycSheet { padding: 1.25rem 1rem 2rem; }
            .kycLogoWrap { margin-bottom: 0.625rem; }
            .kycDivider { margin-bottom: 0.625rem; }
            .kycIconRing { width: 56px; height: 56px; margin-bottom: 0.625rem; }
            .kycInfoBox { margin: 0.5rem 0 1rem; padding: 0.625rem 0.75rem; }
        }
        @media (max-width: 320px) {
            .kycTitle { font-size: 1.05rem; }
            .kycSubtitle { font-size: 0.78rem; }
            .kycCardBody { padding: 0.875rem 0.875rem 1rem; }
            .kycIconRing { width: 50px; height: 50px; }
        }
        @media (max-height: 620px) {
            .kycCardBody { padding: 1rem 1.5rem 1.25rem; }
            .kycLogoWrap { margin-bottom: 0.5rem; }
            .kycDivider { margin-bottom: 0.5rem; }
            .kycIconRing { width: 54px; height: 54px; margin-bottom: 0.5rem; }
            .kycInfoBox { margin: 0.5rem 0 0.875rem; padding: 0.625rem 0.75rem; }
            .kycBtn { padding: 0.65rem 1rem; }
        }
    `;

    // ── Wait for first KYC check before rendering anything ────────────────────
    if (kycLoading) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 9999 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, border: '4px solid #f3f3f3', borderTop: '4px solid #e53e3e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ fontSize: '0.875rem', color: '#888', margin: 0 }}>Checking your account…</p>
                </div>
            </div>
        );
    }

    // ── Blocking page: verification pending ───────────────────────────────────
    if (kycStatus === 'pending') {
        return (
            <>
                <style>{kycStyles}</style>
                <div className="kycWrap kycWrap--gray">
                    <div className="kycBlob1" /><div className="kycBlob2" />
                    <div className="kycCard" style={{ margin: 'auto' }}>
                        <div className="kycCardBody">
                            <div className="kycLogoWrap"><Logo /></div>
                            <div className="kycDivider" />
                            <div className="kycIconRing kycIconRing--gray">
                                <span style={{ fontSize: '2rem' }}>⏳</span>
                            </div>
                            <h1 className="kycTitle">Verification<br />Under Review</h1>
                            <p className="kycSubtitle">Our admin team is reviewing your submitted ID. This usually takes 1–2 business days.</p>
                            <div className="kycInfoBox">
                                <div className="kycInfoDot" style={{ marginTop: '6px', background: '#6366f1' }} />
                                <span>You will be notified once your identity has been <strong>verified</strong>. You can re-submit if your ID was unclear.</span>
                            </div>
                            <div className="kycActions">
                                <button className="kycBtn kycBtn--primary" style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }} onClick={() => router.push('/seller/setup?resubmit=1')}>
                                    Re-submit ID →
                                </button>
                                <button className="kycBtn kycBtn--ghost" onClick={() => logout()}>
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── Blocking page: verification rejected ──────────────────────────────────
    if (kycStatus === 'rejected') {
        return (
            <>
                <style>{kycStyles}</style>
                <div className="kycWrap kycWrap--red">
                    <div className="kycBlob1" /><div className="kycBlob2" />
                    <div className="kycCard">
                        <div className="kycCardBody">
                            <div className="kycLogoWrap"><Logo /></div>
                            <div className="kycDivider" />
                            <div className="kycIconRing kycIconRing--red">
                                <ShieldX size={34} color="#cc2b41" strokeWidth={1.75} />
                            </div>
                            <h1 className="kycTitle kycTitle--red">Verification<br />Rejected</h1>
                            <p className="kycSubtitle">Your submitted ID was not accepted by our admin team.</p>
                            <div className="kycInfoBox">
                                <div className="kycInfoDot" style={{ marginTop: '6px' }} />
                                <span>To <strong>go live and sell</strong> on BIDPal, re-submit a clear, valid Philippine government-issued ID for review.</span>
                            </div>
                            <div className="kycActions">
                                <button className="kycBtn kycBtn--primary" onClick={() => router.push('/seller/setup?resubmit=1')}>
                                    Re-submit Verification →
                                </button>
                                <button className="kycBtn kycBtn--ghost" onClick={() => setShowCancelConfirm(true)}>
                                    Cancel my account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cancellation bottom-sheet */}
                {showCancelConfirm && (
                    <div className="kycOverlay" onClick={() => setShowCancelConfirm(false)}>
                        <div className="kycSheet" onClick={e => e.stopPropagation()}>
                            <div className="kycSheetHandle" />
                            <div className="kycSheetIcon">
                                <AlertTriangle size={26} color="#ea580c" strokeWidth={2} />
                            </div>
                            <h2 className="kycSheetTitle">Cancel your account?</h2>
                            <p className="kycSheetBody">
                                You are about to cancel your BIDPal seller account. Here's what will happen:
                            </p>
                            <div className="kycSheetWarning">
                                🗓 Your account and all data will be <strong>permanently deleted within 30 days</strong>.<br />
                                🔒 You'll be logged out immediately.<br />
                                ❌ This action <strong>cannot be undone</strong>.
                            </div>
                            <div className="kycSheetActions">
                                <button className="kycBtn kycBtn--muted" onClick={() => setShowCancelConfirm(false)}>Go Back</button>
                                <button className="kycBtn kycBtn--primary" onClick={handleCancelAccount} disabled={cancelling} style={{ background: 'linear-gradient(135deg,#be123c,#e11d48)' }}>
                                    {cancelling ? 'Processing…' : 'Yes, Cancel'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // ── Blocking page: account cancelled / scheduled for deletion ─────────────
    if (kycStatus === 'cancelled') {
        const deletionDateStr = deletedAt
            ? new Date(deletedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '30 days from now';
        return (
            <>
                <style>{kycStyles}</style>
                <div className="kycWrap kycWrap--gray">
                    <div className="kycBlob1" /><div className="kycBlob2" />
                    <div className="kycCard">
                        <div className="kycCardBody">
                            <div className="kycLogoWrap"><Logo /></div>
                            <div className="kycDivider" />
                            <div className="kycIconRing kycIconRing--gray">
                                <Trash2 size={32} color="#6366f1" strokeWidth={1.75} />
                            </div>
                            <h1 className="kycTitle kycTitle--dark">Account Scheduled<br />for Deletion</h1>
                            <p className="kycSubtitle">Your cancellation has been processed.</p>
                            <div className="kycInfoBox kycInfoBox--gray">
                                <div className="kycInfoDot kycInfoDot--gray" style={{ marginTop: '6px' }} />
                                <span>Your account and all data will be permanently deleted on <strong>{deletionDateStr}</strong>. You cannot access BIDPal during this period.</span>
                            </div>
                            <p className="kycSubtitle" style={{ marginBottom: '1.5rem' }}>
                                Think this is a mistake? Contact us at<br /><strong style={{ color: '#475569' }}>support@bidpal.ph</strong> before the deletion date.
                            </p>
                            <button className="kycBtn kycBtn--muted" onClick={logout}>Log Out</button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* KYC decision modal */}
            {kycToast && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '380px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>
                        {/* Gradient header */}
                        <div style={{
                            background: kycToast.status === 'approved'
                                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                                : 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
                            padding: '2rem 2rem 1.5rem',
                            textAlign: 'center',
                        }}>
                            <div style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.45)', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {kycToast.status === 'approved'
                                    ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                }
                            </div>
                            <h2 style={{ color: 'white', fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                                {kycToast.status === 'approved' ? "You're Verified!" : "Verification Rejected"}
                            </h2>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.75rem 2rem 2rem', textAlign: 'center' }}>
                            {kycToast.status === 'approved' ? (
                                <>
                                    <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1rem' }}>
                                        Your identity has been verified by an admin. You can now{' '}
                                        <strong style={{ color: '#15803d' }}>go live</strong>, list products, and start selling on BIDPal.
                                    </p>
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#166534', textAlign: 'left', lineHeight: 1.8 }}>
                                        ✅ Full seller access unlocked<br />
                                        ✅ Go Live button enabled<br />
                                        ✅ Products &amp; auctions available
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 1rem' }}>
                                        Your submitted ID was not accepted. Please re-submit a clear, valid Philippine government-issued ID.
                                    </p>
                                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#be123c', textAlign: 'left', lineHeight: 1.8 }}>
                                        💡 Make sure your ID is clear and not expired.<br />
                                        Go to Seller Hub → Re-submit Verification.
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                {kycToast.status === 'rejected' && (
                                    <button
                                        onClick={() => { dismissKycToast(); router.push('/seller/setup?resubmit=1'); }}
                                        style={{ flex: 1, background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.8rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                    >
                                        Re-submit ID →
                                    </button>
                                )}
                                <button
                                    onClick={dismissKycToast}
                                    style={{
                                        flex: 1,
                                        background: kycToast.status === 'approved' ? 'linear-gradient(135deg, #16a34a, #22c55e)' : '#f1f5f9',
                                        color: kycToast.status === 'approved' ? 'white' : '#334155',
                                        border: 'none', borderRadius: '10px', padding: '0.8rem',
                                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                    }}
                                >
                                    {kycToast.status === 'approved' ? 'Start Selling 🚀' : 'Dismiss'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



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
