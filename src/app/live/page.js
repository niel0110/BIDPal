'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import AuctionCard from '@/components/card/AuctionCard';
import { Clock, Eye, Heart, Send, X, Truck, Pencil, CheckCircle, Loader2, Mic, MicOff, Video, VideoOff, Share2, Users, Lock } from 'lucide-react';
import styles from './page.module.css';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

// Dynamically import Agora to avoid SSR issues
let AgoraRTC = null;

function LivePageInner() {
    const searchParams = useSearchParams();
    const auctionId = searchParams.get('id');
    const { user, loading: authLoading } = useAuth();

    const [auction, setAuction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bids, setBids] = useState([]);
    const [comments, setComments] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [activeModalImg, setActiveModalImg] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [shippingOption, setShippingOption] = useState('standard');
    const [bidAmount, setBidAmount] = useState('');
    const [bidNotice, setBidNotice] = useState(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [streamReady, setStreamReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [streamEnded, setStreamEnded] = useState(false);
    const [stats, setStats] = useState({ likes: 0, shares: 0, viewers: 0 });
    const [isLiked, setIsLiked] = useState(false);
    const [minBid, setMinBid] = useState(null); // The minimum required next bid amount
    const [countdown, setCountdown] = useState(null); // { days, hours, minutes, seconds } or null
    const [reminderSet, setReminderSet] = useState(false);
    const [reminderLoading, setReminderLoading] = useState(false);
    const [reminderError, setReminderError] = useState(null);
    const [reminderCount, setReminderCount] = useState(0);
    const [copied, setCopied] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [currentBidAmount, setCurrentBidAmount] = useState(0);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
    const [blockedFromAuction, setBlockedFromAuction] = useState(false);
    const [blockedUserIds, setBlockedUserIds] = useState(new Set());
    const [standingMap, setStandingMap] = useState({});
    const [biddingEligibility, setBiddingEligibility] = useState(null); // { canBid, requiresPreAuthorization }
    const [myStanding, setMyStanding] = useState('clean');
    const [showPreAuthModal, setShowPreAuthModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success
    const [liveAuctions, setLiveAuctions] = useState([]);
    const [scheduledAuctions, setScheduledAuctions] = useState([]);
    const [liveLandingLoading, setLiveLandingLoading] = useState(false);
    const [forceMobileLive, setForceMobileLive] = useState(false);

    // Permission and Stream State
    const [permissionStatus, setPermissionStatus] = useState('idle'); // idle, requesting, granted, denied
    const [hasStarted, setHasStarted] = useState(false);
    const remoteVideoTrackRef = useRef(null);

    // Winner Modal State
    const [winnerModal, setWinnerModal] = useState({
        show: false,
        title: "You won the auction!",
        subtitle: "You're the highest bidder",
        amount: "0"
    });

    // Refs for Agora RTC (video/audio) and RTM (chat)
    const agoraClientRef = useRef(null);
    const localTracksRef = useRef({ audio: null, video: null });
    const socketRef = useRef(null);
    const commentsEndRef = useRef(null);
    const mobileChatScrollRef = useRef(null);
    const desktopChatScrollRef = useRef(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const userIsVerified = Boolean(user?.is_verified) || user?.kyc_status === 'approved';
    const userNeedsVerification = Boolean(user) && !authLoading && !userIsVerified;
    const bidStep = Number(auction?.incremental_bid_step || 100);
    const bidLimit = Number(auction?.reserve_price || 0);
    const currentAuctionPrice = Number(
        (bids[0]?.amount ?? auction?.current_price ?? auction?.reserve_price ?? 0).toString().replace(/,/g, '')
    );
    const nextBidAmount = Math.max(Number(minBid || 0), currentAuctionPrice + bidStep);

    useEffect(() => {
        const query = '(max-width: 768px), (pointer: coarse)';
        const media = window.matchMedia(query);
        const syncMobileMode = () => setForceMobileLive(media.matches || window.innerWidth <= 768);

        syncMobileMode();
        media.addEventListener?.('change', syncMobileMode);
        window.addEventListener('resize', syncMobileMode);

        return () => {
            media.removeEventListener?.('change', syncMobileMode);
            window.removeEventListener('resize', syncMobileMode);
        };
    }, []);

    useEffect(() => {
        if (auctionId) return;

        const fetchLiveLanding = async () => {
            setLiveLandingLoading(true);
            try {
                const [liveRes, scheduledRes] = await Promise.all([
                    fetch(`${apiUrl}/api/auctions?status=active&limit=40`),
                    fetch(`${apiUrl}/api/auctions?status=scheduled&limit=20`),
                ]);
                const [liveJson, scheduledJson] = await Promise.all([
                    liveRes.ok ? liveRes.json() : { data: [] },
                    scheduledRes.ok ? scheduledRes.json() : { data: [] },
                ]);

                setLiveAuctions((liveJson.data || []).filter(item => item.sale_type !== 'sale'));
                setScheduledAuctions((scheduledJson.data || []).filter(item => item.sale_type !== 'sale'));
            } catch (err) {
                console.error('Failed to fetch live auctions:', err);
            } finally {
                setLiveLandingLoading(false);
            }
        };

        fetchLiveLanding();
    }, [auctionId, apiUrl]);

    // Determine if the current user is the seller (host)
    const isHost = auction && user && String(auction.seller_info?.seller_id) === String(user.seller_id || user.id);

    // ── Fetch own bidding eligibility + standing when user is known ──────────
    useEffect(() => {
        if (!user) return;
        const userId = user.user_id || user.id;
        if (!userId) return;
        Promise.all([
            fetch(`${apiUrl}/api/violations/user/${userId}/bidding-eligibility`)
                .then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${apiUrl}/api/violations/user/${userId}/record`)
                .then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([eligibility, record]) => {
            if (eligibility) setBiddingEligibility(eligibility);
            if (record?.account_status) setMyStanding(record.account_status);
        });
    }, [user?.user_id, user?.id, apiUrl]);

    // ── Fetch existing comments from DB on mount ─────────────────────────────
    useEffect(() => {
        if (!auctionId) return;
        const fetchComments = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/comments`);
                if (res.ok) {
                    const data = await res.json();
                    // Map DB shape → UI shape
                    setComments(data.map(c => ({
                        id: c.comment_id,
                        user: c.username,
                        text: c.text
                    })));
                }
            } catch (err) {
                console.error('Failed to fetch comments:', err);
            }
        };
        fetchComments();
    }, [auctionId, apiUrl]);

    // ── Socket.IO setup ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!auctionId) return;

        const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-auction', auctionId);
        });

        socket.on('bid-update', (bid) => {
            if (bid.amount) setCurrentBidAmount(prev => Math.max(prev, Number(bid.amount)));
            setBids(prev => {
                // Check if bid already exists to prevent duplicates
                const bidExists = prev.some(b => b.id === (bid.id || bid.bid_id) || (b.user === bid.user && b.amount === bid.amount && b.time === bid.time));
                if (bidExists) return prev;

                // Format the bid to match the expected structure
                const formattedBid = {
                    id: bid.id || bid.bid_id || Date.now(),
                    user_id: bid.user_id,
                    user: (bid.user && bid.user.trim() !== 'null null' ? bid.user : null) || (bid.bidder_name && bid.bidder_name.trim() !== 'null null' ? bid.bidder_name : 'Anonymous'),
                    amount: bid.amount?.toLocaleString ? bid.amount.toLocaleString() : bid.amount,
                    time: bid.time || bid.timeAgo || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                // Fetch standing for new bidder user_ids
                if (bid.user_id) {
                    setStandingMap(prev => {
                        if (prev[bid.user_id] !== undefined) return prev;
                        fetch(`${apiUrl}/api/violations/user/${bid.user_id}/record`)
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                setStandingMap(m => ({ ...m, [bid.user_id]: data?.account_status || 'clean' }));
                            })
                            .catch(() => {});
                        return { ...prev, [bid.user_id]: 'loading' };
                    });
                }

                return [formattedBid, ...prev];
            });
        });

        socket.on('new-comment', (comment) => {
            const time = comment.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setComments(prev => [...prev, { id: comment.id, user_id: comment.user_id, user: comment.user, text: comment.text, time }]);
        });

        socket.on('you-are-blocked', () => {
            setBlockedFromAuction(true);
        });

        socket.on('buyer-blocked', ({ userId }) => {
            setBlockedUserIds(prev => new Set([...prev, String(userId)]));
            setComments(prev => prev.filter(c => String(c.user_id) !== String(userId)));
            setBids(prev => prev.filter(b => String(b.user_id) !== String(userId)));
        });

        // Live concurrent viewer count — goes up and down as people join/leave
        socket.on('viewer-count', (count) => {
            setViewerCount(count);
            setStats(prev => ({ ...prev, viewers: count }));
        });

        // Listen for like and share updates
        socket.on('like-update', (count) => {
            setStats(prev => ({ ...prev, likes: count }));
        });

        socket.on('share-update', (count) => {
            setStats(prev => ({ ...prev, shares: count }));
        });

        // Listen for reminder count updates (buyer clicked notify)
        socket.on('reminder-count-update', ({ count }) => {
            setReminderCount(count); // always relevant since we're in this auction's room
        });

        // Listen for auction-ended event
        socket.on('auction-ended', (data) => {
            console.log('🏁 Auction ended:', data);
            setStreamEnded(true);

            // Check if current user is the winner
            if (data.has_winner && data.winner && user) {
                const userId = user.user_id || user.id;
                if (data.winner.user_id === userId) {
                    // Current user won!
                    setWinnerModal({
                        show: true,
                        title: "🎉 Congratulations!",
                        subtitle: "You won the auction!",
                        amount: `₱${data.winner.bid_amount?.toLocaleString('en-PH') || '0'}`
                    });
                }
            }

            // Show auction ended message to everyone
            if (data.has_winner && data.winner) {
                setComments(prev => [...prev, {
                    id: Date.now(),
                    user: 'System',
                    text: `🏆 Auction ended! Winner: ${data.winner.bidder_name} with ₱${data.winner.bid_amount?.toLocaleString('en-PH')}`,
                    time: 'Just now'
                }]);
            } else {
                setComments(prev => [...prev, {
                    id: Date.now(),
                    user: 'System',
                    text: '🏁 Auction ended. No bids were placed.',
                    time: 'Just now'
                }]);
            }
        });

        return () => {
            socket.emit('leave-auction', auctionId);
            socket.disconnect();
        };
    }, [auctionId, apiUrl, user]);

    // ── Auto-scroll chat to the latest message ───────────────────────────────
    useEffect(() => {
        requestAnimationFrame(() => {
            if (mobileChatScrollRef.current) {
                mobileChatScrollRef.current.scrollTop = mobileChatScrollRef.current.scrollHeight;
            }
            if (desktopChatScrollRef.current) {
                desktopChatScrollRef.current.scrollTop = desktopChatScrollRef.current.scrollHeight;
            }
        });
    }, [comments]);

    // ── Fetch auction data + initial bids ────────────────────────────────────
    useEffect(() => {
        if (!auctionId) {
            setLoading(false);
            return;
        }

        const fetchBids = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/bids`);
                const data = await res.json();
                if (res.ok) {
                    const bidsArray = data.bids || data;
                    const formattedBids = Array.isArray(bidsArray) ? bidsArray.map(bid => {
                        const resolvedUser = (bid.bidder_name && bid.bidder_name.trim() !== 'null null') ? bid.bidder_name : (bid.bidder?.Fname ? `${bid.bidder.Fname} ${bid.bidder.Lname?.[0] || ''}.` : 'Anonymous');
                        
                        return {
                            id: bid.bid_id,
                            user_id: bid.user_id,
                            user: resolvedUser,
                            amount: (bid.amount || bid.bid_amount).toLocaleString(),
                            time: bid.timeAgo || new Date(bid.placed_at || bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                    }) : [];
                    setBids(formattedBids);
                    if (formattedBids.length > 0) {
                        const raw = data.bids?.[0]?.bid_amount || data.bids?.[0]?.amount;
                        if (raw) setCurrentBidAmount(Number(raw));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch bids:', err);
            }
        };

        const fetchStats = async () => {
            try {
                // Don't include user_id here — liked status is handled by its own dedicated effect
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/stats`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.stats) {
                        setStats(data.stats);
                        setViewerCount(data.stats.liveViewers || 0);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };

        const fetchAuctionDetails = async () => {
            try {
                console.log('🔍 Fetching auction:', auctionId);
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}`);
                const data = await res.json();
                if (res.ok) {
                    console.log('✅ Auction loaded:', { auction_id: data.auction_id, status: data.status });
                    setAuction(data);

                    // Initialize current bid amount
                    const currentPrice = Number(data.current_price || data.reserve_price || 0);
                    setCurrentBidAmount(currentPrice);

                    // Initialize minimum bid requirement
                    const step = Number(data.incremental_bid_step || 100);
                    setMinBid(currentPrice + step);

                    await Promise.all([fetchBids(), fetchStats()]);
                } else {
                    console.error('❌ Failed to load auction:', data.error);
                    setError(data.error || 'Failed to fetch auction details');
                }
            } catch (err) {
                console.error('❌ Error fetching auction:', err);
                setError('An error occurred while fetching auction details');
            } finally {
                setLoading(false);
            }
        };

        fetchAuctionDetails();

        // Poll every 30s while auction is active but stream hasn't started
        const poll = setInterval(async () => {
            if (streamReady || hasStarted) return;
            try {
                const r = await fetch(`${apiUrl}/api/auctions/${auctionId}`);
                const d = await r.json();
                if (d.auction_id) setAuction(d);
            } catch {}
        }, 30000);

        return () => clearInterval(poll);
    }, [auctionId, apiUrl]);

    // ── Fetch initial reminder count (for seller) + check buyer's own reminder ─
    useEffect(() => {
        if (!auction || auction.status !== 'scheduled') return;

        // Always fetch the count (visible to the seller)
        fetch(`${apiUrl}/api/auctions/${auctionId}/reminder-count`)
            .then(r => r.json())
            .then(d => { if (typeof d.count === 'number') setReminderCount(d.count); })
            .catch(() => {});

        // Check if the current buyer already set a reminder
        if (!user) return;
        const token = localStorage.getItem('bidpal_token');
        if (!token) return;
        fetch(`${apiUrl}/api/auctions/${auctionId}/remind`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(d => { if (d.reminder_set) setReminderSet(true); })
            .catch(() => {});
    }, [auction?.auction_id, user?.user_id, user?.id]);

    // ── Countdown timer for scheduled auctions ────────────────────────────────
    useEffect(() => {
        if (!auction || auction.status !== 'scheduled' || !auction.start_time) {
            setCountdown(null);
            return;
        }

        const tick = () => {
            const diff = new Date(auction.start_time) - new Date();
            if (diff <= 0) {
                setCountdown(null);
                // Refetch to pick up the auto-transition to active
                fetch(`${apiUrl}/api/auctions/${auctionId}`)
                    .then(r => r.json())
                    .then(data => { if (data.auction_id) setAuction(data); })
                    .catch(() => {});
                return;
            }
            const days    = Math.floor(diff / 86400000);
            const hours   = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setCountdown({ days, hours, minutes, seconds });
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [auction?.status, auction?.start_time]);

    // ── Agora setup (runs after auction is loaded so isHost is known) ─────────
    useEffect(() => {
        if (!auction || !auctionId || !process.env.NEXT_PUBLIC_AGORA_APP_ID) return;

        // Only connect when auction is active
        if (auction.status !== 'active') return;

        // If auction is already active (seller navigated here from dashboard), auto-start
        if (isHost && !hasStarted) {
            setHasStarted(true);
            setPermissionStatus('granted');
        }

        if (isHost && !hasStarted) return;

        // Buyer: don't start a second Agora connection if one is already running
        if (!isHost && agoraClientRef.current) return;

        let cancelled = false;

        const startAgora = async () => {
            try {
                // Dynamic import to avoid SSR errors
                const module = await import('agora-rtc-sdk-ng');
                if (cancelled) return;
                AgoraRTC = module.default;
                AgoraRTC.setLogLevel(4); // suppress verbose logs

                const agoraToken = await fetchAgoraToken();
                if (!agoraToken || cancelled) return;

                const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
                agoraClientRef.current = client;

                const role = isHost ? 'host' : 'audience';
                if (cancelled) return;
                await client.setClientRole(role);
                if (cancelled) return;

                // ── Set up ALL event listeners BEFORE joining the channel ────────────
                // This ensures we don't miss user-published if host is already streaming.
                client.on('user-published', async (remoteUser, mediaType) => {
                    if (isHost) return; // host does not subscribe to other hosts
                    console.log(`📺 Host published ${mediaType}, subscribing...`);
                    await client.subscribe(remoteUser, mediaType);
                    if (mediaType === 'video') {
                        remoteVideoTrackRef.current = remoteUser.videoTrack;
                        setStreamReady(true);
                    }
                    if (mediaType === 'audio') {
                        remoteUser.audioTrack.play();
                    }
                });

                client.on('user-unpublished', (_remoteUser, mediaType) => {
                    if (mediaType === 'video') setStreamReady(false);
                });

                client.on('user-joined', () => setViewerCount(c => c + 1));
                client.on('user-left', () => setViewerCount(c => Math.max(0, c - 1)));

                // ── Join using uid=0 (must match what token was generated with) ────────
                await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID, String(auctionId), agoraToken, 0);

                if (isHost) {
                    console.log('🎥 Starting camera and microphone...');
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                        { AEC: true, ANS: true },
                        {
                            encoderConfig: {
                                width: 1280,
                                height: 720,
                                frameRate: 30,
                                bitrateMin: 600,
                                bitrateMax: 1000,
                            },
                        }
                    );
                    if (cancelled) {
                        audioTrack.close();
                        videoTrack.close();
                        return;
                    }

                    localTracksRef.current = { audio: audioTrack, video: videoTrack };
                    
                    // Video playback will be handled by useEffect to avoid race conditions
                    setStreamReady(true);

                    await client.publish([audioTrack, videoTrack]);
                    console.log('✅ Published to channel successfully');

                    // Notify backend to mark auction as active (if still scheduled)
                    if (auction.status === 'scheduled') {
                        const authToken = localStorage.getItem('bidpal_token');
                        try {
                            await fetch(`${apiUrl}/api/auctions/${auctionId}/start`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${authToken}` }
                            });
                        } catch (e) {
                            console.error('Failed to start auction on backend:', e);
                        }
                    }
                } else {
                    console.log('✅ Buyer joined — waiting for host to publish...');
                }
            } catch (error) {
                if (cancelled || error?.code === 'OPERATION_ABORTED' || error?.message?.includes('cancel token canceled')) {
                    console.log('Agora initialization cancelled (expected during unmount)');
                    return;
                }
                console.error('Agora initialization error:', error);
                setPermissionStatus('denied');
            }
        };

        startAgora();

        return () => {
            cancelled = true;
            const { audio, video } = localTracksRef.current;
            if (audio) {
                audio.stop();
                audio.close();
                localTracksRef.current.audio = null;
            }
            if (video) {
                video.stop();
                video.close();
                localTracksRef.current.video = null;
            }

            if (agoraClientRef.current) {
                const client = agoraClientRef.current;

                // Only leave if we are connected or connecting
                if (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING' || client.connectionState === 'RECONNECTING') {
                    client.leave().catch(err => {
                        if (err.code !== 'OPERATION_ABORTED' && err.code !== 'WS_ABORT' && !err.message?.includes('LEAVE')) {
                            console.warn('Non-critical leave error during unmount cleanup:', err);
                        }
                    });
                }
                agoraClientRef.current = null;
            }
        };
    }, [auctionId, auction?.auction_id, auction?.status, isHost]);

    // Handle video playback once DOM container is ready
    useEffect(() => {
        // Local Host Video
        if (hasStarted && isHost && localTracksRef.current.video) {
            console.log('▶️ Playing host video locally...');
            try {
                localTracksRef.current.video.play('agora-local-video');
            } catch (e) {
                console.warn('Host video playback failed:', e);
            }
        }
        
        // Remote Host Video (for buyers)
        if (!isHost && streamReady && remoteVideoTrackRef.current) {
            console.log('▶️ Playing remote video...');
            try {
                remoteVideoTrackRef.current.play('agora-remote-video');
            } catch (e) {
                console.warn('Remote video playback failed:', e);
            }
        }
    }, [hasStarted, streamReady, isHost]);

    const fetchAgoraToken = async () => {
        try {
            const token = localStorage.getItem('bidpal_token');
            const role = isHost ? 'host' : 'audience';
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(
                `${apiUrl}/api/agora/token?channelName=${auctionId}&role=${role}&uid=0`,
                { headers }
            );
            const data = await res.json();
            return res.ok ? data.token : null;
        } catch {
            return null;
        }
    };

    const requestPermissionsAndStart = async () => {
        if (!isHost) return;
        setPermissionStatus('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // User granted permission, stop the tracks right away just to free them up,
            // Agora will request them again or we can let Agora handle it.
            stream.getTracks().forEach(track => track.stop());
            setPermissionStatus('granted');
            setHasStarted(true);
        } catch (err) {
            console.error('Permission denied or error:', err);
            setPermissionStatus('denied');
        }
    };

    const handleBlockBuyer = (userId, userName) => {
        if (!socketRef.current || !auctionId) return;
        if (!window.confirm(`Block ${userName} from this auction?`)) return;
        socketRef.current.emit('block-buyer', { auctionId, userId });
    };

    const handleBidButtonClick = () => {
        if (!user) { setShowLoginPrompt(true); return; }
        if (authLoading) return;
        if (!userIsVerified) { setShowVerifyPrompt(true); return; }
        if (biddingEligibility && !biddingEligibility.canBid) return; // suspended — button is disabled
        if (biddingEligibility?.requiresPreAuthorization) {
            setShowPreAuthModal(true);
            return;
        }
        setBidAmount(nextBidAmount);
        setBidNotice(null);
        setShowModal(true);
    };

    const closeBidModal = () => {
        setShowModal(false);
        setBidNotice(null);
    };

    const handleSendMessage = () => {
        if (!user) { setShowLoginPrompt(true); return; }
        if (!inputValue.trim()) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newComment = {
            id: Date.now(),
            user_id: user?.user_id || user?.id || null,
            user: user ? `${user.Fname || 'Guest'}` : 'Guest',
            text: inputValue,
            time
        };
        // Emit via socket — server broadcasts to all clients AND persists to DB
        if (socketRef.current) {
            socketRef.current.emit('send-comment', { auctionId, comment: newComment });
        }
        setInputValue('');
    };

    const handlePlaceBid = async () => {
        if (!user) { setShowLoginPrompt(true); return; }
        if (authLoading) return;
        if (!userIsVerified) { setShowVerifyPrompt(true); return; }
        if (!bidAmount) return;

        const numericBidAmount = parseFloat(bidAmount);
        if (bidLimit > 0 && numericBidAmount > bidLimit) {
            setBidNotice({
                title: 'Bid limit reached',
                message: `Bid cannot exceed the seller reserve price limit of ₱${bidLimit.toLocaleString('en-PH')}.`,
            });
            return;
        }

        const overMinimumBy = numericBidAmount - currentAuctionPrice;
        const remainder = bidStep > 0 ? overMinimumBy % bidStep : 0;
        const followsSellerIncrement = Math.abs(remainder) < 0.0001 || Math.abs(remainder - bidStep) < 0.0001;
        if (numericBidAmount < nextBidAmount || !followsSellerIncrement) {
            setBidNotice({
                title: 'Invalid bid amount',
                message: `Bid must be at least ₱${nextBidAmount.toLocaleString('en-PH')} and follow the seller's ₱${bidStep.toLocaleString('en-PH')} increment.`,
            });
            return;
        }

        if (biddingEligibility && !biddingEligibility.canBid) {
            setBidNotice({
                title: 'Bidding unavailable',
                message: 'Your bidding privileges are suspended. You cannot place bids at this time.',
            });
            return;
        }

        if (!auctionId) {
            console.error('❌ No auction ID available');
            setBidNotice({
                title: 'Invalid auction',
                message: 'Invalid auction - please check the URL.',
            });
            return;
        }

        console.log('🎯 Placing bid:', { auctionId, amount: bidAmount, url: `${apiUrl}/api/auctions/${auctionId}/bids` });

        const token = localStorage.getItem('bidpal_token');
        try {
            const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/bids`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ amount: Number(bidAmount) })
            });
            const data = await res.json();

            console.log('📥 Bid API response:', { status: res.status, ok: res.ok, data });

            // Check for API errors — show meaningful message to user
            if (!res.ok || data.error) {
                const errMsg = data.error || 'Failed to place bid';
                console.error('❌ Bid API error:', { status: res.status, error: errMsg, data });
                // Update the minimum bid if the server tells us
                if (data.minBid) setMinBid(data.minBid);
                setBidNotice({
                    title: 'Bid not placed',
                    message: errMsg,
                });
                return; // Don't close modal — let user correct the amount
            }

            console.log('✅ Bid placed successfully:', data);

            // Update minBid for the next attempt
            if (data.minNextBid) setMinBid(data.minNextBid);

            // Create bid object for local display
            const newBid = {
                id: data.bid_id || Date.now(),
                user_id: user?.user_id || user?.id,
                user: user?.Fname ? `${user.Fname} ${user.Lname?.[0] || ''}.` : (user?.email ? user.email.split('@')[0] : 'Anonymous'),
                amount: Number(bidAmount).toLocaleString(),
                time: 'Just now'
            };

            // Create bid object for Socket.IO broadcast (with full bidder info)
            const broadcastBid = {
                bid_id: data.bid_id,
                user_id: user?.user_id || user?.id,
                bidder_name: data.bidder_name || 'Anonymous',
                bidder_avatar: data.bidder_avatar,
                amount: Number(bidAmount),
                timeAgo: 'Just now',
                timestamp: data.placed_at
            };

            // Emit to all viewers in the room via socket
            if (socketRef.current) {
                socketRef.current.emit('new-bid', { auctionId, bid: broadcastBid });
            }
            setCurrentBidAmount(Number(bidAmount));
            setBids(prev => [newBid, ...prev]);

            // Close modal and reset only on success
            setShowModal(false);
            setBidNotice(null);
            setBidAmount('');
        } catch (err) {
            console.error('❌ Bid network error:', err);
            setBidNotice({
                title: 'Connection problem',
                message: `Network error: ${err.message}`,
            });
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

    const endStream = async () => {
        const { audio, video } = localTracksRef.current;
        if (audio) { 
            audio.stop();
            audio.close(); 
            localTracksRef.current.audio = null; 
        }
        if (video) { 
            video.stop();
            video.close(); 
            localTracksRef.current.video = null; 
        }

        if (agoraClientRef.current) {
            const client = agoraClientRef.current;
            
            if (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING' || client.connectionState === 'RECONNECTING') {
                try { 
                    // Silently handle leave during cleanup
                    await client.leave().catch(e => {
                        if (e.code !== 'OPERATION_ABORTED' && e.code !== 'WS_ABORT' && !e.message?.includes('LEAVE')) {
                            console.warn('Non-critical leave error during endStream:', e);
                        }
                    });
                } catch (e) { 
                    // Fail silently for any unexpected cleanup errors
                }
            }
            agoraClientRef.current = null;
        }

        const authToken = localStorage.getItem('bidpal_token');
        try {
            await fetch(`${apiUrl}/api/auctions/${auctionId}/end`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });
        } catch (e) {
            console.error('Failed to end auction on backend:', e);
        }

        setStreamReady(false);
        setStreamEnded(true);
    };

    const handleOpenPayment = () => {
        setWinnerModal({ ...winnerModal, show: false });
        setShowPaymentModal(true);
    };

    const handlePayNow = () => {
        setPaymentStatus('processing');
        
        // Step 1: Simulate bank/network delay
        setTimeout(() => {
            setPaymentStatus('success');
            
            // Step 2: Finalize simulation after showing success checkmark
            setTimeout(() => {
                setShowPaymentModal(false);
                setPaymentStatus('idle');
                // Redirect to orders or show a receipt summary
                alert('🎉 Payment Successful! Your order is being processed.');
                window.location.href = '/buyer/orders';
            }, 2500);
        }, 3000);
    };

    const handleLike = async () => {
        if (!user) { setShowLoginPrompt(true); return; }
        // Optimistic toggle so UI feels instant
        setIsLiked(prev => !prev);
        try {
            const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id || user.id })
            });
            if (res.ok) {
                const data = await res.json();
                setIsLiked(data.liked);
                // Socket `like-update` will broadcast exact count to all viewers
            } else {
                setIsLiked(prev => !prev); // revert on error
            }
        } catch (err) {
            setIsLiked(prev => !prev); // revert on error
            console.error('Failed to like auction:', err);
        }
    };

    // Re-check liked status once user auth resolves (initial stats fetch may run before user loads)
    useEffect(() => {
        const userId = user?.user_id || user?.id;
        if (!auctionId || !userId) return;
        fetch(`${apiUrl}/api/auctions/${auctionId}/stats?user_id=${userId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.isLiked !== undefined) setIsLiked(data.isLiked); })
            .catch(() => {});
    }, [auctionId, apiUrl, user]);

    // Fetch follow status + follower count when seller is known
    useEffect(() => {
        if (!auction?.seller_info?.seller_id) return;
        const sellerId = auction.seller_info.seller_id;

        fetch(`${apiUrl}/api/follows/followers/${sellerId}`)
            .then(r => r.json())
            .then(d => { if (typeof d.count === 'number') setFollowerCount(d.count); else if (Array.isArray(d)) setFollowerCount(d.length); })
            .catch(() => {});

        if (!user) return;
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/follows/check/${sellerId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { if (d.is_following !== undefined) setIsFollowing(d.is_following); })
            .catch(() => {});
    }, [auction?.seller_info?.seller_id, user?.user_id]);

    const handleFollow = async () => {
        if (!user) { setShowLoginPrompt(true); return; }
        const token = localStorage.getItem('bidpal_token');
        const sellerId = auction?.seller_info?.seller_id;
        if (!sellerId) return;
        try {
            const endpoint = isFollowing ? '/api/follows/unfollow' : '/api/follows/follow';
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ followed_seller_id: sellerId })
            });
            if (res.ok) {
                setIsFollowing(f => !f);
                setFollowerCount(c => isFollowing ? Math.max(0, c - 1) : c + 1);
            }
        } catch (err) {
            console.error('Follow error:', err);
        }
    };

    // Track view/join event — only for logged-in, non-host viewers
    useEffect(() => {
        if (!auctionId || isHost || !user) return;
        const session_id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user?.user_id || user?.id || null, session_id })
        }).catch(() => {}); // Fire-and-forget — non-critical
    }, [auctionId, isHost, user]); // re-runs when user auth resolves

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: product?.name || 'Live Auction',
                    text: `Check out this live auction: ${product?.name}`,
                    url: window.location.href
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            // User cancelled — do nothing
            if (err?.name === 'AbortError') return;
            console.error('Share failed:', err);
            return;
        }

        // Only track if user actually shared (not cancelled)
        try {
            const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user?.user_id || user?.id || null })
            });
            // Socket `share-update` broadcasts the exact count to all viewers in real-time
            if (res.ok) {
                const data = await res.json();
                setStats(prev => ({ ...prev, shares: data.shareCount ?? prev.shares + 1 }));
            }
        } catch (err) {
            console.error('Failed to track share:', err);
        }
    };

    if (!auctionId) {
        return (
            <main className={styles.liveLanding}>
                <Header />

                <section className={styles.liveHero}>
                    <div>
                        <span className={styles.liveEyebrow}>Live Auctions</span>
                        <h1>Join a live auction in progress.</h1>
                        <p>Watch verified sellers present items in real time, place bids, and follow upcoming sessions you do not want to miss.</p>
                    </div>
                </section>

                {liveLandingLoading ? (
                    <div className={styles.liveLandingLoader}><BIDPalLoader size="section" /></div>
                ) : (
                    <>
                        <section className={styles.liveLandingSection}>
                            <div className={styles.liveLandingHeader}>
                                <h2>Live Now</h2>
                                <span>{liveAuctions.length} active</span>
                            </div>

                            {liveAuctions.length > 0 ? (
                                <div className={styles.liveGrid}>
                                    {liveAuctions.map(item => <AuctionCard key={item.id} data={item} />)}
                                </div>
                            ) : (
                                <div className={styles.liveEmpty}>
                                    <h3>No live auctions right now</h3>
                                    <p>Check the upcoming schedule below or browse all auctions.</p>
                                    <button onClick={() => window.location.href = '/auctions'}>Browse Auctions</button>
                                </div>
                            )}
                        </section>

                        <section className={styles.liveLandingSection}>
                            <div className={styles.liveLandingHeader}>
                                <h2>Upcoming Sessions</h2>
                                <span>{scheduledAuctions.length} scheduled</span>
                            </div>

                            {scheduledAuctions.length > 0 ? (
                                <div className={styles.liveGrid}>
                                    {scheduledAuctions.map(item => <AuctionCard key={item.id} data={item} />)}
                                </div>
                            ) : (
                                <div className={styles.liveEmpty}>
                                    <h3>No scheduled auctions yet</h3>
                                    <p>New sessions appear here as sellers schedule their next live events.</p>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        );
    }

    if (loading) {
        return (
            <main>
                <Header />
                <BIDPalLoader />
            </main>
        );
    }

    if (error || !auction) {
        return (
            <main>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>{error || 'Auction not found'}</h2>
                    <button onClick={() => window.location.href = '/'} className={styles.backBtn}>
                        Go Back Home
                    </button>
                </div>
            </main>
        );
    }

    const { product, seller_info } = auction;
    const isScheduledBuyer = auction.status === 'scheduled' && !isHost;
    const isAuctionEnded =
        auction.status === 'ended' ||
        auction.status === 'completed' ||
        streamEnded ||
        (auction.status === 'active' && auction?.end_time && new Date(auction.end_time) <= new Date());
    const useMobileBuyerLive = forceMobileLive && !isHost && !isScheduledBuyer;

    // ── AUCTION ENDED: show recap page instead of live layout ────────
    if (isAuctionEnded) {
        const finalBid = bids[0];
        const rawFinal = finalBid?.amount ?? auction.current_price ?? auction.reserve_price;
        const finalNum = typeof rawFinal === 'string'
            ? Number(rawFinal.replace(/,/g, ''))
            : Number(rawFinal || 0);

        const mainImg = activeModalImg || product?.images?.[0]?.image_url || 'https://placehold.co/600x600';
        const thumbs = product?.images || [];

        return (
            <main style={{ background: '#f8f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Header />

                {/* top bar */}
                <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 1.5rem', height: 44, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={() => window.history.back()}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, padding: '4px 0' }}
                    >
                        ← Back
                    </button>
                    <span style={{ color: '#e2e8f0' }}>|</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Live Session Recap</span>
                    <span style={{ fontSize: '0.68rem', background: '#0f172a', color: 'white', borderRadius: 20, padding: '2px 10px', fontWeight: 700, letterSpacing: '0.04em', marginLeft: 2 }}>
                        Ended
                    </span>
                </div>

                {/* main content */}
                <div style={{ maxWidth: 1000, width: '100%', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>

                    {/* ── LEFT: image gallery ── */}
                    <div style={{ width: 340, flexShrink: 0 }}>
                        <img
                            src={mainImg}
                            alt={product?.name}
                            style={{ width: '100%', borderRadius: 16, display: 'block', objectFit: 'contain', maxHeight: 380, background: '#f1f5f9' }}
                        />
                        {thumbs.length > 1 && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                {thumbs.slice(0, 5).map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img.image_url}
                                        alt=""
                                        onClick={() => setActiveModalImg(img.image_url)}
                                        style={{
                                            width: 58, height: 58, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                                            border: `2px solid ${mainImg === img.image_url ? '#D32F2F' : '#e2e8f0'}`,
                                            transition: 'border-color 0.15s'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT: product info ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem', lineHeight: 1.25 }}>{product?.name}</h1>

                        {product?.description && (
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.5rem', lineHeight: 1.7 }}>
                                {product.description}
                            </p>
                        )}

                        {/* stats */}
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Final Price</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#D32F2F', lineHeight: 1 }}>₱{finalNum.toLocaleString('en-PH')}</div>
                            </div>
                            <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
                            <div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Total Bids</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{bids.length}</div>
                            </div>
                            <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
                            <div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Reserve Price</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>₱{Number(auction.reserve_price || 0).toLocaleString('en-PH')}</div>
                            </div>
                        </div>

                        {/* divider */}
                        <div style={{ height: 1, background: '#f1f5f9', marginBottom: '1.25rem' }} />

                        {/* seller row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                backgroundImage: seller_info?.avatar ? `url(${seller_info.avatar})` : 'none',
                                backgroundColor: '#e2e8f0', backgroundSize: 'cover', backgroundPosition: 'center',
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{seller_info?.store_name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{seller_info?.full_name}</div>
                            </div>
                            <button
                                onClick={() => window.location.href = `/store/${seller_info?.seller_id}`}
                                style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D32F2F', background: '#fff1f2', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', flexShrink: 0 }}
                            >
                                Visit Store
                            </button>
                        </div>
                    </div>
                </div>

                {/* Winner modal — reused from live session */}
                {winnerModal.show && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.winnerModalContent}>
                            <div className={styles.modalCloseWrapper}>
                                <button className={styles.closeBtn} onClick={() => setWinnerModal({ ...winnerModal, show: false })}><X size={16} /></button>
                            </div>
                            <h2 className={styles.winnerTitle}>{winnerModal.title}</h2>
                            <div className={styles.winnerDivider} />
                            <p className={styles.winnerSubTitle}>{winnerModal.subtitle}</p>
                            <div className={styles.winnerAmount}>₱ {winnerModal.amount}</div>
                            <div className={styles.winnerActionRow}>
                                <button className={styles.payNowBtn} onClick={handleOpenPayment}>Pay Now</button>
                                <button className={styles.cancelWinnerBtn} onClick={() => setWinnerModal({ ...winnerModal, show: false })}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment modal */}
                {showPaymentModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
                        <div className={styles.paymentModalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalCloseWrapper}>
                                <button className={styles.closeBtn} onClick={() => setShowPaymentModal(false)}><X size={16} /></button>
                            </div>
                            <div className={styles.paymentLeft}>
                                <img src={product?.images?.[0]?.image_url || 'https://placehold.co/400x400'} alt={product?.name} className={styles.mainProductImg} style={{ border: '2px solid #00A3FF' }} />
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{product?.name}</h3>
                                    <div style={{ fontWeight: 700, marginTop: '0.4rem' }}>Winning Bid</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#D32F2F' }}>₱{finalNum.toLocaleString('en-PH')}</div>
                                </div>
                            </div>
                            <div className={styles.paymentRight}>
                                <h2>Payment</h2>
                                <div className={styles.shippingOptions} style={{ marginTop: '1rem' }}>
                                    <div className={`${styles.shipOption} ${shippingOption === 'standard' ? styles.selected : ''}`} onClick={() => setShippingOption('standard')}>
                                        <CheckCircle size={20} color={shippingOption === 'standard' ? '#D32F2F' : '#ccc'} />
                                        <span className={styles.optionLabel}>Standard</span>
                                        <span className={styles.deliveryTime}>5-7 days</span>
                                        <span className={styles.optionPrice}>FREE</span>
                                    </div>
                                    <div className={`${styles.shipOption} ${shippingOption === 'express' ? styles.selected : ''}`} onClick={() => setShippingOption('express')}>
                                        {shippingOption === 'express' ? <CheckCircle size={20} color="#D32F2F" /> : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #ccc' }} />}
                                        <span className={styles.optionLabel}>Express</span>
                                        <span className={styles.deliveryTime}>1-2 days</span>
                                        <span className={styles.optionPrice}>₱ 125</span>
                                    </div>
                                </div>
                                <div className={styles.paymentFooter}>
                                    <div>
                                        <span className={styles.totalLabel}>Total</span>
                                        <span className={styles.totalAmount}>₱{finalNum.toLocaleString('en-PH')}</span>
                                    </div>
                                    <button className={styles.finalPayBtn}>Pay Now</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        );
    }

    return (
        <main>
            <Header />

            {useMobileBuyerLive ? (
                <section className={styles.mobileBuyerLivePage}>
                    <div className={styles.mobileBuyerVideoStage}>
                        <div
                            id="agora-remote-video"
                            className={styles.mobileBuyerRemoteVideo}
                            style={{ display: streamReady ? 'block' : 'none' }}
                        />

                        {!streamReady && (
                            <div
                                className={styles.mobileBuyerPoster}
                                style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.62)), url(${product?.images?.[0]?.image_url || 'https://placehold.co/800x1200?text=Live+Auction'})` }}
                            >
                                <Loader2 size={34} className={styles.spinner} />
                                <h2>Waiting for host</h2>
                                <p>The seller has not published the live video yet.</p>
                            </div>
                        )}

                        <div className={styles.mobileBuyerTopBar}>
                            <div className={styles.mobileStoreInfo}>
                                <div className={styles.mobileStoreAvatar} style={{
                                    backgroundImage: seller_info.avatar ? `url(${seller_info.avatar})` : 'none',
                                    backgroundColor: '#888',
                                    backgroundSize: 'cover'
                                }} />
                                <div className={styles.mobileStoreText}>
                                    <span className={styles.mobileStoreName}>{seller_info.store_name || seller_info.full_name || 'Seller'}</span>
                                    <span className={styles.mobileStoreFollowers}>
                                        <Heart size={9} fill="white" /> {stats.likes.toLocaleString()}
                                    </span>
                                </div>
                                <button
                                    className={`${styles.mobileFollowBtn} ${isFollowing ? styles.mobileFollowBtnActive : ''}`}
                                    onClick={handleFollow}
                                >
                                    {isFollowing ? 'Following' : '+ Follow'}
                                </button>
                            </div>
                            <div className={styles.mobileViewerCount}>
                                <Eye size={13} />
                                <span>{viewerCount}</span>
                            </div>
                        </div>

                        <div className={styles.mobileBuyerMessages}>
                            <div className={styles.mobileChatMessages} ref={mobileChatScrollRef}>
                                {comments.map(msg => (
                                    <div key={msg.id} className={styles.mobileChatMsg}>
                                        <span className={styles.mobileChatUser}>{msg.user}</span>
                                        <span className={styles.mobileChatText}>{msg.text}</span>
                                    </div>
                                ))}
                                <div ref={commentsEndRef} />
                            </div>
                        </div>

                        <div className={styles.mobileBuyerBottom}>
                            <div className={styles.mobileProductCard}>
                                <img
                                    src={product?.images?.[0]?.image_url || 'https://placehold.co/56x56'}
                                    alt={product?.name}
                                    className={styles.mobileProductThumb}
                                />
                                <div className={styles.mobileProductInfo}>
                                    <span className={styles.mobileProductName}>{product?.name}</span>
                                    <span className={styles.mobileProductBidLabel}>Current Bid ({bids.length} Bid{bids.length !== 1 ? 's' : ''})</span>
                                    <div className={styles.mobileProductPriceRow}>
                                        <span className={styles.mobileProductPrice}>₱{currentBidAmount.toLocaleString('en-PH')}</span>
                                    </div>
                                </div>
                                <button
                                    className={styles.mobileBidBtn}
                                    onClick={handleBidButtonClick}
                                    disabled={biddingEligibility && !biddingEligibility.canBid}
                                    style={biddingEligibility && !biddingEligibility.canBid ? { background: '#9ca3af', cursor: 'not-allowed' } : (userNeedsVerification ? { background: '#ea580c' } : undefined)}
                                >
                                    {biddingEligibility && !biddingEligibility.canBid ? 'Blocked' : (userNeedsVerification ? 'Verify' : 'Bid')}
                                </button>
                            </div>

                            <div className={styles.mobileChatRow}>
                                <div className={styles.mobileChatInput}>
                                    <input
                                        type="text"
                                        placeholder={user ? 'Say something...' : 'Login to comment...'}
                                        value={inputValue}
                                        readOnly={!user}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onFocus={() => { if (!user) setShowLoginPrompt(true); }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim()}
                                        style={{ opacity: inputValue.trim() ? 1 : 0.4 }}
                                    >
                                        <Send size={15} color="white" />
                                    </button>
                                </div>
                                <div className={styles.mobileChatActions}>
                                    <button
                                        className={`${styles.mobileChatActionBtn} ${isLiked ? styles.mobileChatActionBtnLiked : ''}`}
                                        onClick={handleLike}
                                    >
                                        <Heart size={19} fill={isLiked ? 'currentColor' : 'none'} />
                                    </button>
                                    <button className={styles.mobileChatActionBtn} onClick={handleShare}>
                                        <Share2 size={19} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
            <div className={`${styles.container} ${forceMobileLive ? styles.mobileContainer : ''}`}>
                <div className={`${isScheduledBuyer ? styles.scheduledLayout : styles.liveLayout} ${forceMobileLive ? styles.mobileLiveLayout : ''}`}>

                {/* LEFT: VIDEO */}
                <div className={`${styles.liveLeft} ${forceMobileLive ? styles.mobileLiveLeft : ''}`}>
                <section className={`${styles.videoWrapper}${isScheduledBuyer ? ' ' + styles.videoWrapperSmall : ''} ${forceMobileLive ? styles.mobileLiveMode : ''}`}>
                    <div className={styles.videoPlaceholder} style={{ position: 'relative', background: 'white' }}>
                        {/* Agora video containers */}
                        <div
                            id="agora-local-video"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: isHost ? 'block' : 'none',
                                position: 'absolute',
                                inset: 0,
                                zIndex: 0,
                                overflow: 'hidden'
                            }}
                        />
                        <div
                            id="agora-remote-video"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: !isHost ? 'block' : 'none',
                                position: 'absolute',
                                inset: 0,
                                zIndex: 0,
                                overflow: 'hidden'
                            }}
                        />

                        {/* Fallback overlay when stream not yet active */}
                        {!streamReady && (
                            <div className={styles.notLiveOverlay} style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.35)), url(${product?.images?.[0]?.image_url || 'https://placehold.co/1280x720'}) center/cover`,
                                zIndex: 1
                            }}>
                                {isHost ? (
                                    <>
                                        {!hasStarted && permissionStatus === 'idle' && (
                                            <div style={{ textAlign: 'center' }}>
                                                <h2 style={{ color: 'white', marginBottom: '0.75rem', fontSize: '1.5rem' }}>Ready to Go Live?</h2>
                                                <p style={{ color: '#ddd', marginBottom: '1rem' }}>Start your live auction for {product?.name}</p>
                                                {auction.status === 'scheduled' && (
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                                                        background: 'rgba(255,255,255,0.1)', borderRadius: '50px',
                                                        padding: '0.5rem 1.2rem', marginBottom: '1.5rem',
                                                        border: '1px solid rgba(255,255,255,0.2)'
                                                    }}>
                                                        <Users size={16} color="#fbbf24" strokeWidth={2} />
                                                        <span style={{ color: 'white', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1 }}>{reminderCount}</span>
                                                    </div>
                                                )}
                                                <br />
                                                <button
                                                    onClick={requestPermissionsAndStart}
                                                    style={{
                                                        padding: '14px 32px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 600,
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        background: '#D32F2F',
                                                        color: 'white',
                                                        border: 'none',
                                                        boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.target.style.background = '#B71C1C'}
                                                    onMouseOut={(e) => e.target.style.background = '#D32F2F'}
                                                >
                                                    Start Live Stream
                                                </button>
                                            </div>
                                        )}
                                        {permissionStatus === 'requesting' && (
                                            <>
                                                <Loader2 size={40} color="white" className={styles.spinner} />
                                                <p style={{ color: 'white', marginTop: '1rem', fontWeight: 600 }}>Requesting camera/mic access...</p>
                                            </>
                                        )}
                                        {permissionStatus === 'denied' && (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ color: '#FF5252', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}>Camera/Microphone access denied</p>
                                                <p style={{ color: 'white', fontSize: '0.9rem', marginBottom: '1rem' }}>Please allow permissions in your browser settings to go live.</p>
                                                <button
                                                    onClick={requestPermissionsAndStart}
                                                    style={{ marginTop: '1rem', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: 'white', border: '2px solid white', fontWeight: 600 }}
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        )}
                                        {hasStarted && permissionStatus === 'granted' && (
                                            <>
                                                <Loader2 size={40} color="white" className={styles.spinner} />
                                                <p style={{ color: 'white', marginTop: '1rem', fontWeight: 600 }}>Starting your stream...</p>
                                            </>
                                        )}
                                    </>
                                ) : auction?.status === 'scheduled' ? (
                                    <div style={{ textAlign: 'center', padding: '0 2rem' }}>
                                        <Clock size={48} color="white" style={{ marginBottom: '1rem', opacity: 0.85 }} />
                                        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Auction Starting Soon</h2>
                                        <p style={{ color: '#ddd', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                                            {new Date(auction.start_time).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            {' at '}
                                            {new Date(auction.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {countdown && (
                                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                                {[
                                                    { label: 'Days',    value: countdown.days },
                                                    { label: 'Hours',   value: countdown.hours },
                                                    { label: 'Minutes', value: countdown.minutes },
                                                    { label: 'Seconds', value: countdown.seconds },
                                                ].map(({ label, value }) => (
                                                    <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 18px', minWidth: '64px' }}>
                                                        <div style={{ color: 'white', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{String(value).padStart(2, '0')}</div>
                                                        <div style={{ color: '#ccc', fontSize: '0.7rem', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (auction?.status === 'ended' || auction?.status === 'completed') ||
                                    (auction?.status === 'active' && auction?.end_time && new Date(auction.end_time) <= new Date()) ? (
                                    <div style={{ textAlign: 'center', padding: '0 2rem' }}>
                                        <CheckCircle size={48} color="white" style={{ marginBottom: '1rem', opacity: 0.85 }} />
                                        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Auction Has Ended</h2>
                                        <p style={{ color: '#ddd', fontSize: '0.95rem' }}>This auction is no longer available.</p>
                                    </div>
                                ) : (
                                    <div className={styles.notLiveContent} style={{ textAlign: 'center', padding: '0 1.5rem', maxWidth: '400px' }}>
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <Loader2 size={32} color="white" className={styles.spinner} />
                                        </div>
                                        <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                            Host hasn&apos;t gone live yet
                                        </h2>
                                        <p style={{ color: '#ddd', fontSize: '0.75rem', marginBottom: '0.85rem' }}>
                                            The seller will start the stream shortly. This page updates automatically.
                                        </p>
                                        {(() => {
                                            const startMs = new Date(auction.start_time).getTime();
                                            const now = Date.now();
                                            const isPast = startMs < now;
                                            if (isPast) {
                                                const diffMs = now - startMs;
                                                const diffMins = Math.floor(diffMs / 60000);
                                                const diffHrs  = Math.floor(diffMs / 3600000);
                                                const diffDays = Math.floor(diffMs / 86400000);
                                                const waitLabel = diffDays >= 1
                                                    ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
                                                    : diffHrs >= 1
                                                    ? `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`
                                                    : `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
                                                return (
                                                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', display: 'inline-block' }}>
                                                        <p style={{ color: '#ccc', fontSize: '0.62rem', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Was scheduled</p>
                                                        <p style={{ color: 'white', fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>
                                                            {new Date(auction.start_time).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                            {' · '}
                                                            {new Date(auction.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        <p style={{ color: '#FFB74D', fontSize: '0.68rem', margin: '3px 0 0' }}>Started {waitLabel}</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', display: 'inline-block' }}>
                                                    <p style={{ color: '#ccc', fontSize: '0.62rem', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled start</p>
                                                    <p style={{ color: 'white', fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>
                                                        {new Date(auction.start_time).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                        {' · '}
                                                        {new Date(auction.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Host mic/video/end controls */}
                        {isHost && streamReady && !streamEnded && (
                            <div style={{
                                position: 'absolute',
                                bottom: '1rem',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                gap: '1rem',
                                zIndex: 10,
                                alignItems: 'center'
                            }}>
                                <button
                                    onClick={toggleMic}
                                    title={isMuted ? 'Unmute' : 'Mute'}
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
                                    title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
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
                                <button
                                    onClick={endStream}
                                    title="End Live Stream"
                                    style={{
                                        background: '#D32F2F',
                                        border: 'none',
                                        borderRadius: '20px',
                                        padding: '0 18px',
                                        height: 44,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        gap: '6px',
                                        backdropFilter: 'blur(4px)',
                                        boxShadow: '0 2px 8px rgba(211,47,47,0.5)'
                                    }}
                                >
                                    <X size={16} color="white" /> End Stream
                                </button>
                            </div>
                        )}

                        {/* Stream ended overlay for host */}
                        {isHost && streamEnded && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.8)',
                                zIndex: 10
                            }}>
                                <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>Stream Ended</h2>
                                <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Your live auction has been closed.</p>
                                <button
                                    onClick={() => window.location.href = '/seller/auctions'}
                                    style={{
                                        padding: '12px 28px',
                                        borderRadius: '8px',
                                        background: '#D32F2F',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Back to Auctions
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.overlayTop}>
                        <div className={styles.timerBadge}>
                            <Clock size={16} />
                            <span>{auction.status === 'active' ? 'LIVE' : 'Scheduled'}</span>
                        </div>
                        <div className={styles.viewerBadge}>
                            <Eye size={16} />
                            <span>{viewerCount}</span>
                        </div>
                    </div>

                    <div className={styles.sellerOverlay}>
                        <div className={styles.sellerAvatar} style={{
                            backgroundImage: seller_info.avatar ? `url(${seller_info.avatar})` : 'none',
                            backgroundColor: seller_info.avatar ? 'transparent' : '#D32F2F',
                            backgroundSize: 'cover',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '1rem',
                        }}>
                            {!seller_info.avatar && (seller_info.store_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div className={styles.sellerInfo}>
                            <div className={styles.sellerName}>{seller_info.store_name || seller_info.full_name}</div>
                            <div className={styles.sellerStats}>
                                <Heart size={10} fill="white" /> {followerCount.toLocaleString()}
                            </div>
                        </div>
                        <button className={`${styles.followBtn} ${isFollowing ? styles.followBtnActive : ''}`} onClick={handleFollow}>
                            {isFollowing ? '✓ Following' : '+ Follow'}
                        </button>
                    </div>

                    {/* Stats overlay — bottom-right of video: heart + share only */}
                    <div className={styles.videoStatsOverlay}>
                        <button className={`${styles.videoStatBtn} ${isLiked ? styles.videoStatBtnLiked : ''}`} onClick={handleLike}>
                            <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                            <span>{stats.likes}</span>
                        </button>
                        <button className={styles.videoStatBtn} onClick={handleShare}>
                            <Share2 size={16} />
                            <span>{stats.shares}</span>
                        </button>
                    </div>

                    {/* Mobile-only: TikTok/IG-Live style overlay */}
                    <div className={styles.mobileChatOverlay}>

                        {/* TOP BAR: seller left + viewers right */}
                        <div className={styles.mobileOverlayTop}>
                            <div className={styles.mobileStoreInfo}>
                                <div className={styles.mobileStoreAvatar} style={{
                                    backgroundImage: seller_info.avatar ? `url(${seller_info.avatar})` : 'none',
                                    backgroundColor: '#888',
                                    backgroundSize: 'cover'
                                }} />
                                <div className={styles.mobileStoreText}>
                                    <span className={styles.mobileStoreName}>{seller_info.store_name}</span>
                                    <span className={styles.mobileStoreFollowers}>
                                        <Heart size={9} fill="white" /> {stats.likes.toLocaleString()}
                                    </span>
                                </div>
                                <button
                                    className={`${styles.mobileFollowBtn} ${isFollowing ? styles.mobileFollowBtnActive : ''}`}
                                    onClick={handleFollow}
                                >
                                    {isFollowing ? 'Following' : '+ Follow'}
                                </button>
                            </div>
                            <div className={styles.mobileViewerCount}>
                                <Eye size={13} />
                                <span>{viewerCount}</span>
                            </div>
                        </div>

                        {/* MIDDLE: chat messages */}
                        <div className={styles.mobileOverlayMiddle}>
                            <div className={styles.mobileChatMessages} ref={mobileChatScrollRef}>
                                {comments.map(msg => (
                                    <div key={msg.id} className={styles.mobileChatMsg}>
                                        <span className={styles.mobileChatUser}>{msg.user}</span>
                                        <span className={styles.mobileChatText}>{msg.text}</span>
                                    </div>
                                ))}
                                <div ref={commentsEndRef} />
                            </div>
                        </div>

                        {/* BOTTOM: product card + chat row */}
                        <div className={styles.mobileOverlayBottom}>
                            {/* Product card */}
                            <div className={styles.mobileProductCard}>
                                <img
                                    src={product?.images?.[0]?.image_url || 'https://placehold.co/56x56'}
                                    alt={product?.name}
                                    className={styles.mobileProductThumb}
                                />
                                <div className={styles.mobileProductInfo}>
                                    <span className={styles.mobileProductName}>{product?.name}</span>
                                    <span className={styles.mobileProductBidLabel}>Current Bid ({bids.length} Bid{bids.length !== 1 ? 's' : ''})</span>
                                    <div className={styles.mobileProductPriceRow}>
                                        <span className={styles.mobileProductPrice}>₱{currentBidAmount.toLocaleString('en-PH')}</span>
                                    </div>
                                    {countdown && (
                                        <span className={styles.mobileCountdown}>
                                            {String(countdown.hours).padStart(2,'0')}h: {String(countdown.minutes).padStart(2,'0')}m: {String(countdown.seconds).padStart(2,'0')}s
                                        </span>
                                    )}
                                </div>
                                <button
                                    className={styles.mobileBidBtn}
                                    onClick={handleBidButtonClick}
                                    disabled={!isHost && biddingEligibility && !biddingEligibility.canBid}
                                    style={!isHost && biddingEligibility && !biddingEligibility.canBid ? { background: '#9ca3af', cursor: 'not-allowed' } : (!isHost && userNeedsVerification ? { background: '#ea580c' } : undefined)}
                                >
                                    {!isHost && biddingEligibility && !biddingEligibility.canBid ? '🚫' : (!isHost && userNeedsVerification ? '🔒 Verify to Bid' : 'Bid')}
                                </button>
                            </div>

                            {/* Chat row: input + like + share */}
                            <div className={styles.mobileChatRow}>
                                <div className={styles.mobileChatInput}>
                                    <input
                                        type="text"
                                        placeholder={user ? 'Say something...' : 'Login to comment...'}
                                        value={inputValue}
                                        readOnly={!user}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onFocus={() => { if (!user) setShowLoginPrompt(true); }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim()}
                                        style={{ opacity: inputValue.trim() ? 1 : 0.4 }}
                                    >
                                        <Send size={15} color="white" />
                                    </button>
                                </div>
                                <div className={styles.mobileChatActions}>
                                    <button
                                        className={`${styles.mobileChatActionBtn} ${isLiked ? styles.mobileChatActionBtnLiked : ''}`}
                                        onClick={handleLike}
                                    >
                                        <Heart size={19} fill={isLiked ? 'currentColor' : 'none'} />
                                    </button>
                                    <button className={styles.mobileChatActionBtn} onClick={handleShare}>
                                        <Share2 size={19} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                </div>{/* end liveLeft */}

                {/* ── SCHEDULED BUYER: info + reminder panel (right column) ── */}
                {isScheduledBuyer && (
                    <div className={styles.scheduledPanel}>
                        <div className={styles.scheduledLeft}>
                            <div className={styles.scheduledProductRow}>
                                <img
                                    src={product?.images?.[0]?.image_url || 'https://placehold.co/80x80'}
                                    alt={product?.name}
                                    className={styles.scheduledThumb}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => { setActiveModalImg(product?.images?.[0]?.image_url || null); setShowProductModal(true); }}
                                />
                                <div>
                                    <h3
                                        className={styles.scheduledProductName}
                                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#ccc' }}
                                        onClick={() => { setActiveModalImg(product?.images?.[0]?.image_url || null); setShowProductModal(true); }}
                                    >{product?.name}</h3>
                                    <p className={styles.scheduledMeta}>Starting bid: <strong>₱{Number(auction.reserve_price || 0).toLocaleString('en-PH')}</strong></p>
                                    <p className={styles.scheduledMeta}>Sold by <strong>{auction.seller_info?.store_name || 'Seller'}</strong></p>
                                </div>
                            </div>

                            <div className={styles.scheduledInfoBox}>
                                <div className={styles.scheduledInfoItem}>
                                    <span className={styles.scheduledInfoLabel}>Date</span>
                                    <span className={styles.scheduledInfoValue}>
                                        {new Date(auction.start_time).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className={styles.scheduledInfoItem}>
                                    <span className={styles.scheduledInfoLabel}>Time</span>
                                    <span className={styles.scheduledInfoValue}>
                                        {new Date(auction.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className={styles.scheduledInfoItem}>
                                    <span className={styles.scheduledInfoLabel}>Bidding</span>
                                    <span className={styles.scheduledInfoValue}>Live auction — highest bid wins</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.scheduledRight}>
                            <h4 className={styles.scheduledReminderTitle}>Don't miss this auction</h4>
                            <p className={styles.scheduledReminderDesc}>
                                Set a reminder and we'll notify you when this auction is about to start.
                            </p>
                            {reminderError && (
                                <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '0.6rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#c62828', fontWeight: 600 }}>
                                    ⚠ {reminderError}
                                </div>
                            )}
                            {reminderSet ? (
                                <div className={styles.scheduledReminderDone}>
                                    <span style={{ fontSize: '1.5rem' }}>🔔</span>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, color: '#2e7d32' }}>Reminder set!</p>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#555' }}>We'll notify you before the auction starts.</p>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className={styles.scheduledReminderBtn}
                                    disabled={reminderLoading || !user}
                                    onClick={async () => {
                                        if (!user) return;
                                        setReminderLoading(true);
                                        try {
                                            setReminderError(null);
                                            const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/remind`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('bidpal_token')}` },
                                                body: JSON.stringify({})
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setReminderSet(true);
                                                if (typeof data.reminderCount === 'number') setReminderCount(data.reminderCount);
                                            } else {
                                                setReminderError(data.error || `Error ${res.status}`);
                                            }
                                        } catch (err) {
                                            setReminderError(err.message || 'Network error');
                                        }
                                        setReminderLoading(false);
                                    }}
                                >
                                    {reminderLoading ? 'Setting...' : '🔔 Notify Me When It Starts'}
                                </button>
                            )}
                            {!user && <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.5rem' }}>Log in to set a reminder.</p>}

                            <div className={styles.scheduledShareRow}>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>Share this auction</p>
                                <button
                                    className={styles.scheduledShareBtn}
                                    style={copied ? { background: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32' } : undefined}
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    <Share2 size={14} /> {copied ? 'Copied!' : 'Copy Link'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT: bids + chat stacked */}
                <div className={styles.bottomSection} style={{ display: isScheduledBuyer ? 'none' : undefined }}>

                    {/* LEFT: AUCTION & BIDS */}
                    <div className={styles.auctionControl}>
                        {/* Strike 1 warning — buyer only */}
                        {!isHost && myStanding === 'warned' && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: '0.5rem', fontSize: '0.79rem', color: '#92400e', fontWeight: 600 }}>
                                ⚠ Strike 1: This is a warning. Further violations will restrict your bidding privileges.
                            </div>
                        )}
                        {/* Strike 2 notice — buyer only */}
                        {!isHost && myStanding === 'restricted' && (
                            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', marginBottom: '0.5rem', fontSize: '0.79rem', color: '#c2410c', fontWeight: 600 }}>
                                ⚠ Strike 2: Payment pre-authorization is required before each bid.
                            </div>
                        )}
                        <div className={styles.productRow}>
                            <img
                                src={product?.images?.[0]?.image_url || "https://placehold.co/150x150"}
                                alt={product?.name}
                                className={styles.productThumb}
                                onClick={() => { setActiveModalImg(product?.images?.[0]?.image_url || null); setShowProductModal(true); }}
                                style={{ cursor: 'pointer' }}
                            />
                            <div className={styles.productDetails}>
                                <h3
                                    className={styles.productTitle}
                                    onClick={() => { setActiveModalImg(product?.images?.[0]?.image_url || null); setShowProductModal(true); }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {product?.name}
                                </h3>
                                <div className={styles.currentBidLabel}>Current Bid ({bids.length} Bids)</div>
                                <div className={styles.bidInfo}>
                                    <div>
                                        <div className={styles.countDown}>
                                            {auction.status === 'active' ? 'Ends soon' : new Date(auction.start_time).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>₱ {auction.reserve_price}</div>
                                        <div className={styles.price}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</div>
                                    </div>
                                </div>
                            </div>
                            <button
                                className={styles.bidButton}
                                onClick={handleBidButtonClick}
                                disabled={!isHost && biddingEligibility && !biddingEligibility.canBid}
                                style={!isHost && biddingEligibility && !biddingEligibility.canBid ? { background: '#9ca3af', cursor: 'not-allowed', opacity: 0.7 } : (!isHost && userNeedsVerification ? { background: '#ea580c' } : undefined)}
                            >
                                {!isHost && biddingEligibility && !biddingEligibility.canBid ? '🚫 Suspended' : (!isHost && userNeedsVerification ? '🔒 Verify to Bid' : 'Bid')}
                            </button>
                        </div>

                        {/* Stats Section */}
                        <div className={styles.bidTicker}>
                            {bids.length > 0 ? bids.map((bid, index) => {
                                const standing = standingMap[bid.user_id];
                                const isAlert = standing && standing !== 'clean' && standing !== 'loading';
                                const LIVE_STANDING = {
                                    warned:     { label: 'Strike 1', color: '#b45309', bg: '#fffbeb' },
                                    restricted: { label: 'Strike 2', color: '#c2410c', bg: '#fff7ed' },
                                    suspended:  { label: 'Suspended', color: '#b91c1c', bg: '#fef2f2' },
                                    flagged_bogus: { label: 'Bogus', color: '#7c2d12', bg: '#fff1f2' },
                                };
                                const scfg = LIVE_STANDING[standing];
                                return (
                                    <div key={bid.id ? `bid-${bid.id}-${index}` : `bid-${index}`} className={styles.bidItem}
                                        style={isAlert ? { background: 'rgba(254,242,242,0.5)', borderRadius: 6 } : {}}>
                                        <div className={styles.bidderInfo}>
                                            <div className={styles.bidderAvatar} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span className={styles.bidderName}>
                                                    {user && (bid.user_id === (user?.user_id || user?.id)) ? 'You' : bid.user}
                                                </span>
                                                {isHost && isAlert && scfg && (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        color: scfg.color, background: scfg.bg,
                                                        padding: '1px 6px', borderRadius: 10,
                                                        display: 'inline-block', width: 'fit-content',
                                                    }}>
                                                        ⚠ {scfg.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <span className={styles.bidTime}>{bid.time}</span>
                                            <span className={styles.bidAmount}>₱ {bid.amount}</span>
                                            {isHost && bid.user_id && String(bid.user_id) !== String(user?.user_id || user?.id) && !blockedUserIds.has(String(bid.user_id)) && (
                                                <button
                                                    onClick={() => handleBlockBuyer(bid.user_id, bid.user)}
                                                    title="Block this bidder"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: '0.8rem', lineHeight: 1, color: '#ef4444', opacity: 0.7 }}
                                                    onMouseOver={e => e.currentTarget.style.opacity = 1}
                                                    onMouseOut={e => e.currentTarget.style.opacity = 0.7}
                                                >
                                                    🚫
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className={styles.emptyBids}>No bids yet. Be the first!</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: CHAT */}
                    <div className={styles.chatSection}>
                        <h3 className={styles.chatHeader}>Live Chat</h3>

                        <div className={styles.messagesList} ref={desktopChatScrollRef}>
                            {comments.length === 0 && (
                                <div style={{ padding: '20px', color: '#999', textAlign: 'center' }}>
                                    Welcome to the live stream!
                                </div>
                            )}
                            {comments.map(msg => (
                                <div key={msg.id} className={styles.messageItem} style={{ alignItems: 'flex-start' }}>
                                    <div className={styles.chatAvatar} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                            <span className={styles.messageAuthor}>{msg.user}</span>
                                            {msg.time && (
                                                <span style={{ fontSize: '0.65rem', color: '#aaa' }}>{msg.time}</span>
                                            )}
                                        </div>
                                        <div className={styles.messageText}>{msg.text}</div>
                                    </div>
                                    {isHost && msg.user_id && String(msg.user_id) !== String(user?.user_id || user?.id) && !blockedUserIds.has(String(msg.user_id)) && (
                                        <button
                                            onClick={() => handleBlockBuyer(msg.user_id, msg.user)}
                                            title="Block this user"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: '0.8rem', lineHeight: 1, color: '#ef4444', opacity: 0.6, flexShrink: 0, marginTop: '2px' }}
                                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                                            onMouseOut={e => e.currentTarget.style.opacity = 0.6}
                                        >
                                            🚫
                                        </button>
                                    )}
                                </div>
                            ))}
                            {/* Anchor — auto-scrolled into view on each new message */}
                            <div ref={commentsEndRef} />
                        </div>

                        <div className={styles.inputArea}>
                            <input
                                type="text"
                                placeholder="Say something..."
                                className={styles.chatInput}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim()}
                                style={{ opacity: inputValue.trim() ? 1 : 0.4 }}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>

                </div>{/* end bottomSection / right panel */}
                </div>{/* end liveLayout */}
            </div>
            )}

            {/* BID MODAL */}
            {showModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Place your bid</h2>
                            <button className={styles.closeBtn} onClick={closeBidModal}>
                                <X size={12} />
                            </button>
                        </div>

                        {myStanding === 'warned' && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '7px 12px', marginBottom: '0.6rem', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                                ⚠ Strike 1 active — this is your warning. Win and pay to avoid further strikes.
                            </div>
                        )}

                        <div className={styles.bidInfoRow}>
                            <span className={styles.bidLabel}>Current Bid ({bids.length} Bids)</span>
                            <span className={styles.bidValue}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</span>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                Minimum bid: <strong>₱ {nextBidAmount.toLocaleString('en-PH')}</strong>
                            </label>
                            <div style={{ fontSize: '0.73rem', color: '#999', marginTop: '2px' }}>
                                Bid increment: <strong style={{ color: '#666' }}>₱{bidStep.toLocaleString('en-PH')}</strong>
                            </div>
                            {bidLimit > 0 && (
                                <div style={{ fontSize: '0.73rem', color: '#999', marginTop: '2px' }}>
                                    Bid limit: <strong style={{ color: '#666' }}>₱{bidLimit.toLocaleString('en-PH')}</strong>
                                </div>
                            )}
                            <div className={styles.currencyInputWrapper}>
                                <span className={styles.currencySymbol}>₱</span>
                                <input
                                    type="number"
                                    className={styles.bidInput}
                                    value={bidAmount}
                                    placeholder={nextBidAmount}
                                    min={nextBidAmount}
                                    max={bidLimit || undefined}
                                    step={bidStep}
                                    onChange={(e) => {
                                        setBidAmount(e.target.value);
                                        if (bidNotice) setBidNotice(null);
                                    }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {bidNotice && (
                            <div className={styles.bidNotice} role="alert" aria-live="polite">
                                <div className={styles.bidNoticeIcon}>!</div>
                                <div className={styles.bidNoticeText}>
                                    <strong>{bidNotice.title}</strong>
                                    <span>{bidNotice.message}</span>
                                </div>
                            </div>
                        )}

                        <button className={styles.placeBidBtn} onClick={handlePlaceBid}>
                            Place bid
                        </button>
                    </div>
                </div>
            )}

            {/* PRODUCT DETAIL MODAL */}
            {showProductModal && (
                <div className={styles.modalOverlay} onClick={() => setShowProductModal(false)}>
                    <div className={styles.productModalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalCloseWrapper}>
                            <button className={styles.closeBtn} onClick={() => setShowProductModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Left Side */}
                        <div className={styles.detailLeft}>
                            <img
                                src={activeModalImg || product?.images?.[0]?.image_url || 'https://placehold.co/400x400?text=No+Image'}
                                alt={product?.name}
                                className={styles.mainProductImg}
                            />
                            {product?.images?.length > 0 && (
                                <div className={styles.thumbnailRow}>
                                    {product.images.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img.image_url}
                                            className={`${styles.thumbImg} ${(activeModalImg || product.images[0]?.image_url) === img.image_url ? styles.thumbImgActive : ''}`}
                                            alt={`Photo ${idx + 1}`}
                                            onClick={() => setActiveModalImg(img.image_url)}
                                        />
                                    ))}
                                </div>
                            )}

                        </div>

                        {/* Right Side */}
                        <div className={styles.detailRight}>
                            {/* Product header — name, status badge, then price below */}
                            <div className={styles.modalProductHeader}>
                                <h2 className={styles.modalProductName}>{product?.name}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
                                    <span className={styles.modalStatusBadge} style={{
                                        background: auction.status === 'active' ? '#ffebee' : '#fff8e1',
                                        color: auction.status === 'active' ? '#D32F2F' : '#f57c00',
                                        border: `1px solid ${auction.status === 'active' ? '#ffcdd2' : '#ffe0b2'}`,
                                    }}>
                                        {auction.status === 'active' ? '🔴 LIVE' : '🕐 Starts Soon'}
                                    </span>
                                    {bids.length > 0 && (
                                        <span style={{ fontSize: '0.78rem', color: '#888' }}>{bids.length} bid{bids.length !== 1 ? 's' : ''}</span>
                                    )}
                                </div>
                                <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                    {bids.length > 0 && bids[0]?.amount > auction.reserve_price && (
                                        <span style={{ fontSize: '0.85rem', color: '#bbb', textDecoration: 'line-through' }}>
                                            ₱{Number(auction.reserve_price).toLocaleString('en-PH')}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D32F2F' }}>
                                        ₱{Number(bids[0]?.amount || auction.current_price || auction.reserve_price).toLocaleString('en-PH')}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                        {auction.status === 'scheduled' ? 'starting bid' : 'current bid'}
                                    </span>
                                </div>
                            </div>
                            {auction.status !== 'scheduled' && (
                                <div className={styles.shippingInfo}>
                                    <Truck size={24} color="#666" />
                                    <div className={styles.shippingText}>
                                        <strong>Estimated Shipping</strong>
                                        Shipping fee: ₱ 125.00
                                    </div>
                                </div>
                            )}

                            <div className={styles.specSection}>
                                <h3>Item Specifications</h3>
                                <div className={styles.specText}>
                                    {product?.specifications || 'No detailed specifications provided for this product.'}
                                </div>
                            </div>

                            {product?.description && (
                                <div className={styles.specSection}>
                                    <h3>Description</h3>
                                    <div className={styles.specText}>{product.description}</div>
                                </div>
                            )}

                            <div className={styles.sellerCard}>
                                <div className={styles.sellerHead}>
                                    <div className={styles.sellerAvatarLarge} style={{
                                        backgroundImage: seller_info.avatar ? `url(${seller_info.avatar})` : 'none',
                                        backgroundColor: '#ccc',
                                        backgroundSize: 'cover'
                                    }} />
                                    <div className={styles.sellerMeta}>
                                        <div className={styles.sellerNameBold}>{seller_info.store_name}</div>
                                        <div className={styles.ratingBadge}>
                                            <span style={{ color: '#666', fontSize: '0.8rem' }}>{seller_info.full_name}</span>
                                        </div>
                                    </div>
                                    <button className={styles.visitBtn} onClick={() => window.location.href = `/store/${seller_info.seller_id}`}>
                                        Visit
                                    </button>
                                </div>
                                <div className={styles.sellerStatsRow}>
                                    <span>Verified Seller</span>
                                    <span>High Response Rate</span>
                                </div>
                            </div>

                            {auction.status !== 'scheduled' && (
                                <div className={styles.actionRow}>
                                    <button
                                        className={styles.mainBidBtn}
                                        onClick={() => {
                                            setShowProductModal(false);
                                            handleBidButtonClick();
                                        }}
                                        disabled={!isHost && biddingEligibility && !biddingEligibility.canBid}
                                        style={!isHost && biddingEligibility && !biddingEligibility.canBid ? { background: '#9ca3af', cursor: 'not-allowed' } : (!isHost && userNeedsVerification ? { background: '#ea580c' } : undefined)}
                                    >
                                        {!isHost && biddingEligibility && !biddingEligibility.canBid ? '🚫 Bidding Suspended' : (!isHost && userNeedsVerification ? '🔒 Verify to Bid' : 'Join Bid')}
                                    </button>
                                    <button className={styles.wishlistBtn}>
                                        <Heart size={24} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* WINNER MODAL */}
            {winnerModal.show && (
                <div className={styles.modalOverlay}>
                    <div className={styles.premiumWinnerModal}>
                        <div className={styles.winnerConfetti}></div>
                        <div className={styles.winnerIconWrapper}>
                            <div className={styles.winnerEmoji}>🏆</div>
                        </div>
                        
                        <h2 className={styles.premiumWinnerTitle}>{winnerModal.title}</h2>
                        <p className={styles.premiumWinnerSub}>{winnerModal.subtitle}</p>
                        
                        <div className={styles.winnerPricingCard}>
                            <span className={styles.winnerPricingLabel}>Winning Bid</span>
                            <span className={styles.winnerPricingValue}>{winnerModal.amount}</span>
                        </div>

                        <div className={styles.premiumWinnerActions}>
                            <button className={styles.premiumPayBtn} onClick={handleOpenPayment}>
                                Secure Checkout
                            </button>
                            <button
                                className={styles.premiumCancelBtn}
                                onClick={() => setWinnerModal({ ...winnerModal, show: false })}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {showPaymentModal && (
                <div className={styles.modalOverlay} onClick={paymentStatus === 'idle' ? () => setShowPaymentModal(false) : undefined}>
                    <div className={styles.premiumPaymentModal} onClick={e => e.stopPropagation()}>
                        {paymentStatus === 'idle' ? (
                            <>
                                <div className={styles.paymentModalHeader}>
                                    <div className={styles.paymentHeaderInfo}>
                                        <h2 className={styles.paymentMainTitle}>Checkout</h2>
                                        <p className={styles.paymentSubTitle}>Complete your order for <strong>{product?.name}</strong></p>
                                    </div>
                                    <button className={styles.paymentCloseBtn} onClick={() => setShowPaymentModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className={styles.paymentMainBody}>
                                    {/* Summary Section */}
                                    <div className={styles.checkoutSummaryCard}>
                                        <div className={styles.summaryProductInfo}>
                                            <div className={styles.summaryImgWrapper}>
                                                <img src={product?.images?.[0]?.image_url || "https://placehold.co/100x100"} alt="Product" />
                                            </div>
                                            <div className={styles.summaryText}>
                                                <h4>{product?.name}</h4>
                                                <span>Condition: Brand New</span>
                                            </div>
                                        </div>
                                        <div className={styles.summaryPrice}>
                                            <span className={styles.priceLabel}>Winning Amount</span>
                                            <span className={styles.priceValue}>₱{bids[0]?.amount || auction.current_price || auction.reserve_price}</span>
                                        </div>
                                    </div>

                                    {/* Checkout Grid */}
                                    <div className={styles.checkoutDetailsGrid}>
                                        <div className={styles.checkoutSection}>
                                            <div className={styles.sectionHeader}>
                                                <Truck size={18} color="#D32F2F" />
                                                <h3>Shipping Details</h3>
                                            </div>
                                            <div className={styles.addressBox}>
                                                <div className={styles.addressInfo}>
                                                    <p className={styles.addressName}>{user?.Fname} {user?.Lname}</p>
                                                    <p className={styles.addressText}>Select your preferred delivery address</p>
                                                </div>
                                                <button className={styles.addressEditBtn}><Pencil size={14} /></button>
                                            </div>
                                        </div>

                                        <div className={styles.checkoutSection}>
                                            <div className={styles.sectionHeader}>
                                                <div style={{ color: '#D32F2F' }}>₱</div>
                                                <h3>Shipping Method</h3>
                                            </div>
                                            <div className={styles.shippingOptionsList}>
                                                <div
                                                    className={`${styles.shippingOptionCard} ${shippingOption === 'standard' ? styles.shippingOptionSelected : ''}`}
                                                    onClick={() => setShippingOption('standard')}
                                                >
                                                    <div className={styles.optionRadio}>
                                                        {shippingOption === 'standard' && <div className={styles.radioInner} />}
                                                    </div>
                                                    <div className={styles.optionText}>
                                                        <span className={styles.optionName}>Standard Delivery</span>
                                                        <span className={styles.optionMeta}>Estimated 5-7 business days</span>
                                                    </div>
                                                    <span className={styles.optionCost}>FREE</span>
                                                </div>

                                                <div
                                                    className={`${styles.shippingOptionCard} ${shippingOption === 'express' ? styles.shippingOptionSelected : ''}`}
                                                    onClick={() => setShippingOption('express')}
                                                >
                                                    <div className={styles.optionRadio}>
                                                        {shippingOption === 'express' && <div className={styles.radioInner} />}
                                                    </div>
                                                    <div className={styles.optionText}>
                                                        <span className={styles.optionName}>Express Shipping</span>
                                                        <span className={styles.optionMeta}>Estimated 1-2 business days</span>
                                                    </div>
                                                    <span className={styles.optionCost}>₱125</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.paymentModalFooter}>
                                    <div className={styles.totalBreakdown}>
                                        <div className={styles.breakdownRow}>
                                            <span>Subtotal</span>
                                            <span>₱{bids[0]?.amount || auction.current_price || auction.reserve_price}</span>
                                        </div>
                                        <div className={styles.breakdownRow}>
                                            <span>Shipping</span>
                                            <span>{shippingOption === 'express' ? '₱125' : 'FREE'}</span>
                                        </div>
                                        <div className={`${styles.breakdownRow} ${styles.finalTotalRow}`}>
                                            <span>Order Total</span>
                                            <span>₱{(Number((bids[0]?.amount || auction.current_price || auction.reserve_price).toString().replace(/,/g, '')) + (shippingOption === 'express' ? 125 : 0)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <button className={styles.premiumFinalPayBtn} onClick={handlePayNow}>
                                        Complete Payment
                                    </button>
                                    <p className={styles.paymentSecureNote}>
                                        <Lock size={12} /> Secure encrypted checkout
                                    </p>
                                </div>
                            </>
                        ) : paymentStatus === 'processing' ? (
                            <div className={styles.processingState}>
                                <div className={styles.spinnerWrapper}>
                                    <div className={styles.loadingSpinner}></div>
                                    <Loader2 className={styles.spinnerIcon} size={40} />
                                </div>
                                <h2 className={styles.processingTitle}>Processing Payment</h2>
                                <p className={styles.processingSub}>Verifying your transaction with the bank. Please do not close this window.</p>
                            </div>
                        ) : (
                            <div className={styles.successState}>
                                <div className={styles.successIconWrapper}>
                                    <div className={styles.successRing}></div>
                                    <CheckCircle size={80} color="#10b981" strokeWidth={1.5} />
                                </div>
                                <h2 className={styles.successTitle}>Payment Successful!</h2>
                                <p className={styles.successSub}>Thank you for your purchase. We've notified the seller to prepare your order.</p>
                                <div className={styles.successDetails}>
                                    <div className={styles.successRow}>
                                        <span>Order Number</span>
                                        <strong>#BP-{Math.floor(Math.random() * 1000000)}</strong>
                                    </div>
                                    <div className={styles.successRow}>
                                        <span>Amount Paid</span>
                                        <strong>₱{(Number((bids[0]?.amount || auction.current_price || auction.reserve_price).toString().replace(/,/g, '')) + (shippingOption === 'express' ? 125 : 0)).toLocaleString()}</strong>
                                    </div>
                                </div>
                                <div className={styles.successRedirect}>Redirecting to your orders...</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PRE-AUTHORIZATION MODAL (Strike 2) */}
            {showPreAuthModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Pre-Authorization Required</h2>
                            <button className={styles.closeBtn} onClick={() => setShowPreAuthModal(false)}>
                                <X size={12} />
                            </button>
                        </div>
                        <div style={{ padding: '0.25rem 0 0.75rem' }}>
                            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 8, padding: '12px 14px', marginBottom: '1rem' }}>
                                <p style={{ color: '#c2410c', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 6px' }}>
                                    ⚠ Strike 2 — Payment Pre-Authorization
                                </p>
                                <p style={{ color: '#78350f', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                                    Your account is on Strike 2. By proceeding, you confirm that your payment method will be held as pre-authorization for any winning bid. Failure to pay if you win will result in immediate suspension.
                                </p>
                            </div>
                            <button
                                style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#D32F2F', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                                onClick={() => {
                                    setShowPreAuthModal(false);
                                    if (minBid) setBidAmount(minBid);
                                    setShowModal(true);
                                }}
                            >
                                I Understand — Proceed to Bid
                            </button>
                            <button
                                style={{ width: '100%', padding: '10px', marginTop: '0.5rem', borderRadius: 8, background: 'transparent', color: '#666', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.85rem' }}
                                onClick={() => setShowPreAuthModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VERIFY ID PROMPT MODAL */}
            {showVerifyPrompt && (
                <div className={styles.modalOverlay} onClick={() => setShowVerifyPrompt(false)}>
                    <div className={styles.loginPromptContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeBtn} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }} onClick={() => setShowVerifyPrompt(false)}>
                            <X size={12} />
                        </button>
                        <div className={styles.loginPromptIcon} style={{ background: '#fff7ed', color: '#ea580c' }}>
                            <Lock size={28} strokeWidth={2.5} />
                        </div>
                        <h2 className={styles.loginPromptTitle}>ID Verification Required</h2>
                        <p className={styles.loginPromptDesc}>
                            You need to verify your identity before you can place bids. Submit a valid Philippine government-issued ID to get started.
                        </p>
                        <button
                            className={styles.loginPromptBtn}
                            onClick={() => window.location.href = '/buyer/setup'}
                        >
                            Verify My ID
                        </button>
                        <button
                            className={styles.loginPromptSecondary}
                            onClick={() => setShowVerifyPrompt(false)}
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            )}

            {/* BLOCKED FROM AUCTION MODAL */}
            {blockedFromAuction && (
                <div className={styles.modalOverlay}>
                    <div className={styles.loginPromptContent}>
                        <div className={styles.loginPromptIcon} style={{ background: '#fef2f2', color: '#dc2626', fontSize: '1.8rem', lineHeight: 1 }}>
                            🚫
                        </div>
                        <h2 className={styles.loginPromptTitle}>You've Been Removed</h2>
                        <p className={styles.loginPromptDesc}>
                            The seller has blocked you from this live auction. You can no longer comment or place bids in this session.
                        </p>
                        <button
                            className={styles.loginPromptBtn}
                            onClick={() => window.location.href = '/'}
                        >
                            Go Back Home
                        </button>
                        <button
                            className={styles.loginPromptSecondary}
                            onClick={() => setBlockedFromAuction(false)}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* LOGIN PROMPT MODAL */}
            {showLoginPrompt && (
                <div className={styles.modalOverlay} onClick={() => setShowLoginPrompt(false)}>
                    <div className={styles.loginPromptContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeBtn} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }} onClick={() => setShowLoginPrompt(false)}>
                            <X size={12} />
                        </button>
                        <div className={styles.loginPromptIcon}>
                            <Lock size={28} strokeWidth={2.5} />
                        </div>
                        <h2 className={styles.loginPromptTitle}>Login Required</h2>
                        <p className={styles.loginPromptDesc}>
                            You need to be logged in to like, follow, comment, and bid on live auctions.
                        </p>
                        <button
                            className={styles.loginPromptBtn}
                            onClick={() => window.location.href = '/signin'}
                        >
                            Log In
                        </button>
                        <button
                            className={styles.loginPromptSecondary}
                            onClick={() => window.location.href = '/signup'}
                        >
                            Create an Account
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}


export default function LivePage() {
    return (
        <Suspense fallback={<BIDPalLoader />}>
            <LivePageInner />
        </Suspense>
    );
}
