'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Clock, Eye, Heart, Send, X, Star, Truck, Pencil, CheckCircle, Loader2, Mic, MicOff, Video, VideoOff, Share2, Users } from 'lucide-react';
import styles from './page.module.css';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

// Dynamically import Agora to avoid SSR issues
let AgoraRTC = null;

export default function LivePage() {
    const searchParams = useSearchParams();
    const auctionId = searchParams.get('id');
    const { user } = useAuth();

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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    // Determine if the current user is the seller (host)
    const isHost = auction && user && String(auction.seller_info?.seller_id) === String(user.seller_id || user.id);

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

                return [formattedBid, ...prev];
            });
        });

        socket.on('new-comment', (comment) => {
            const time = comment.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setComments(prev => [...prev, { id: comment.id, user: comment.user, text: comment.text, time }]);
        });

        // Listen for live viewer count updates (active sockets)
        socket.on('viewer-count', (count) => {
            setViewerCount(count);
        });

        // Listen for persistent total views updates
        socket.on('total-views-update', (count) => {
            setStats(prev => ({ ...prev, viewers: Math.max((prev.viewers || 0), count) }));
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
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
                }
            } catch (err) {
                console.error('Failed to fetch bids:', err);
            }
        };

        const fetchStats = async () => {
            try {
                const userIdParam = user?.user_id || user?.id ? `?user_id=${user.user_id || user.id}` : '';
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/stats${userIdParam}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.stats) {
                        setStats(data.stats);
                        setViewerCount(data.stats.liveViewers || 0);
                        if (typeof data.isLiked !== 'undefined') setIsLiked(data.isLiked);
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
                    
                    // Initialize minimum bid requirement
                    const currentPrice = Number(data.current_price || data.reserve_price || 0);
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

        // If auction is already active (seller navigated here from dashboard), auto-start
        if (isHost && auction.status === 'active' && !hasStarted) {
            setHasStarted(true);
            setPermissionStatus('granted');
        }

        if (isHost && !hasStarted) return;

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

                client.on('user-unpublished', (remoteUser, mediaType) => {
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
                agoraClientRef.current = null; // Prevent multiple leave calls
            }
        };
    }, [auctionId, isHost]);

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
            const res = await fetch(
                `${apiUrl}/api/agora/token?channelName=${auctionId}&role=${role}&uid=0`,
                { headers: { Authorization: `Bearer ${token}` } }
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

    const handleSendMessage = () => {
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
        if (!bidAmount) return;

        if (!auctionId) {
            console.error('❌ No auction ID available');
            alert('Invalid auction - please check the URL');
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
                alert(`❌ ${errMsg}`);
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
            setBids(prev => [newBid, ...prev]);

            // Close modal and reset only on success
            setShowModal(false);
            setBidAmount('');
        } catch (err) {
            console.error('❌ Bid network error:', err);
            alert(`❌ Network error: ${err.message}`);
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

    const simulateWin = () => {
        setWinnerModal({
            show: true,
            title: "You won the auction!",
            subtitle: "You're the highest bidder",
            amount: "1700"
        });
    };

    const simulateBackupWin = () => {
        setWinnerModal({
            show: true,
            title: "Winning bidder cancelled",
            subtitle: "You're now the highest bidder",
            amount: "1600"
        });
    };

    const handleOpenPayment = () => {
        setWinnerModal({ ...winnerModal, show: false });
        setShowPaymentModal(true);
    };

    const handleLike = async () => {
        if (!user) return;
        try {
            const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id || user.id })
            });
            if (res.ok) {
                const data = await res.json();
                setIsLiked(data.liked);
                setStats(prev => ({ ...prev, likes: data.likeCount }));
            }
        } catch (err) {
            console.error('Failed to like auction:', err);
        }
    };

    // Track view/join event when a non-host viewer loads the page
    useEffect(() => {
        if (!auctionId || isHost) return; // Only track buyer views
        const session_id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user?.user_id || user?.id || null, session_id })
        }).catch(() => {}); // Fire-and-forget — non-critical
    }, [auctionId, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleShare = async () => {
        try {
            // Share using Web Share API if available
            if (navigator.share) {
                await navigator.share({
                    title: product?.name || 'Live Auction',
                    text: `Check out this live auction: ${product?.name}`,
                    url: window.location.href
                });
            } else {
                // Fallback: copy link to clipboard
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
            }

            // Track share in backend
            await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user?.user_id || user?.id || null })
            });

            // Update share count
            setStats(prev => ({ ...prev, shares: prev.shares + 1 }));
        } catch (err) {
            console.error('Failed to share:', err);
        }
    };

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

    return (
        <main>
            <Header />

            <div className={styles.container}>

                {/* VIDEO + SCHEDULED PANEL LAYOUT WRAPPER */}
                <div className={isScheduledBuyer ? styles.scheduledLayout : undefined}>

                {/* VIDEO SECTION */}
                <section className={`${styles.videoWrapper}${isScheduledBuyer ? ' ' + styles.videoWrapperSmall : ''}`}>
                    <div className={styles.videoPlaceholder} style={{ position: 'relative', background: '#000' }}>
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
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${product?.images?.[0]?.image_url || 'https://placehold.co/1280x720'}) center/cover`,
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
                                    <div style={{ textAlign: 'center', padding: '0 2rem', maxWidth: '480px' }}>
                                        <div style={{ marginBottom: '1.2rem' }}>
                                            <Loader2 size={44} color="white" className={styles.spinner} />
                                        </div>
                                        <h2 style={{ color: 'white', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                            Host hasn&apos;t gone live yet
                                        </h2>
                                        <p style={{ color: '#ddd', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
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
                                                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '12px 18px', display: 'inline-block' }}>
                                                        <p style={{ color: '#ccc', fontSize: '0.75rem', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Was scheduled</p>
                                                        <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                                                            {new Date(auction.start_time).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                            {' · '}
                                                            {new Date(auction.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        <p style={{ color: '#FFB74D', fontSize: '0.8rem', marginTop: '4px', margin: '4px 0 0' }}>Started {waitLabel}</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '12px 18px', display: 'inline-block' }}>
                                                    <p style={{ color: '#ccc', fontSize: '0.75rem', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled start</p>
                                                    <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
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
                            backgroundColor: '#ccc',
                            backgroundSize: 'cover'
                        }} />
                        <div className={styles.sellerInfo}>
                            <div className={styles.sellerName}>{seller_info.store_name}</div>
                            <div className={styles.sellerStats}>
                                <Heart size={10} fill="white" /> {Math.floor(Math.random() * 5000) + 1000}
                            </div>
                        </div>
                        <button className={styles.followBtn}>+ Follow</button>
                    </div>
                </section>

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

                </div>{/* end scheduledLayout wrapper */}

                {/* BOTTOM CONTENT */}
                <div className={styles.bottomSection} style={{ display: isScheduledBuyer ? 'none' : undefined }}>

                    {/* LEFT: AUCTION & BIDS */}
                    <div className={styles.auctionControl}>
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
                            <button className={styles.bidButton} onClick={() => {
                                // Pre-fill bid amount with minimum required
                                if (minBid) setBidAmount(minBid);
                                setShowModal(true);
                            }}>Bid</button>
                        </div>

                        {/* Stats Section */}
                        <div className={styles.statsRow}>
                            <button className={`${styles.statButton} ${isLiked ? styles.statButtonActive : ''}`} onClick={handleLike}>
                                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                                <span>{stats.likes}</span>
                            </button>
                            <button className={styles.statButton} onClick={handleShare}>
                                <Share2 size={18} />
                                <span>{stats.shares}</span>
                            </button>
                            <div className={styles.statDisplay}>
                                <Eye size={18} />
                                <span>{stats.viewers}</span>
                            </div>
                        </div>

                        <div className={styles.bidTicker}>
                            {bids.length > 0 ? bids.map((bid, index) => (
                                <div key={bid.id ? `bid-${bid.id}-${index}` : `bid-${index}`} className={styles.bidItem}>
                                    <div className={styles.bidderInfo}>
                                        <div className={styles.bidderAvatar} />
                                        <span className={styles.bidderName}>
                                            {user && (bid.user_id === (user?.user_id || user?.id)) ? 'You' : bid.user}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <span className={styles.bidTime}>{bid.time}</span>
                                        <span className={styles.bidAmount}>₱ {bid.amount}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className={styles.emptyBids}>No bids yet. Be the first!</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: CHAT */}
                    <div className={styles.chatSection}>
                        <h3 className={styles.chatHeader}>Live Chat</h3>

                        <div className={styles.messagesList}>
                            {comments.length === 0 && (
                                <div style={{ padding: '20px', color: '#999', textAlign: 'center' }}>
                                    Welcome to the live stream!
                                </div>
                            )}
                            {comments.map(msg => (
                                <div key={msg.id} className={styles.messageItem}>
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

                </div>
            </div>

            {/* BID MODAL */}
            {showModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Place your bid</h2>
                            <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className={styles.bidInfoRow}>
                            <span className={styles.bidLabel}>Current Bid ({bids.length} Bids)</span>
                            <span className={styles.bidValue}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</span>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                Minimum bid: <strong>₱ {(minBid || ((auction.current_price || auction.reserve_price) + (auction.incremental_bid_step || 100))).toLocaleString('en-PH')}</strong>
                            </label>
                            <div className={styles.currencyInputWrapper}>
                                <span className={styles.currencySymbol}>₱</span>
                                <input
                                    type="number"
                                    className={styles.bidInput}
                                    value={bidAmount}
                                    placeholder={minBid || ((auction.current_price || auction.reserve_price) + (auction.incremental_bid_step || 100))}
                                    min={minBid || ((auction.current_price || auction.reserve_price) + (auction.incremental_bid_step || 100))}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

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
                                            setShowModal(true);
                                        }}
                                    >
                                        Join Bid
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
                    <div className={styles.winnerModalContent}>
                        <div className={styles.modalCloseWrapper}>
                            <button className={styles.closeBtn} onClick={() => setWinnerModal({ ...winnerModal, show: false })}>
                                <X size={16} />
                            </button>
                        </div>

                        <h2 className={styles.winnerTitle}>{winnerModal.title}</h2>
                        <div className={styles.winnerDivider} />

                        <p className={styles.winnerSubTitle}>{winnerModal.subtitle}</p>
                        <div className={styles.winnerAmount}>₱ {winnerModal.amount}</div>

                        <div className={styles.winnerActionRow}>
                            <button className={styles.payNowBtn} onClick={handleOpenPayment}>Pay Now</button>
                            <button
                                className={styles.cancelWinnerBtn}
                                onClick={() => setWinnerModal({ ...winnerModal, show: false })}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {showPaymentModal && (
                <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
                    <div className={styles.paymentModalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalCloseWrapper}>
                            <button className={styles.closeBtn} onClick={() => setShowPaymentModal(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Left Side: Product Summary */}
                        <div className={styles.paymentLeft}>
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={product?.images?.[0]?.image_url || "https://placehold.co/400x400"}
                                    alt={product?.name}
                                    className={styles.mainProductImg}
                                    style={{ border: '2px solid #00A3FF' }}
                                />
                                <div className={styles.thumbnailRow} style={{ marginTop: '1rem' }}>
                                    {product?.images?.slice(0, 3).map((img, idx) => (
                                        <img key={idx} src={img.image_url} className={styles.thumbImg} alt="thumb" />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{product?.name}</h3>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700 }}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Winning Bid</div>
                                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem', lineHeight: 1.5 }}>
                                    {product?.description}
                                </p>
                            </div>
                        </div>

                        {/* Right Side: Checkout Details */}
                        <div className={styles.paymentRight}>
                            <h2>Payment</h2>

                            <div className={styles.infoBlock}>
                                <div className={styles.infoContent}>
                                    <h4>Shipping Address</h4>
                                    <p>Select your preferred shipping address in checkout.</p>
                                </div>
                                <button className={styles.editBtn}><Pencil size={14} /></button>
                            </div>

                            <div className={styles.infoBlock}>
                                <div className={styles.infoContent}>
                                    <h4>Contact Information</h4>
                                    <p>Your verified account contact info will be used.</p>
                                </div>
                                <button className={styles.editBtn}><Pencil size={14} /></button>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontWeight: 700 }}>Shipping Options</h3>
                                </div>

                                <div className={styles.shippingOptions}>
                                    <div
                                        className={`${styles.shipOption} ${shippingOption === 'standard' ? styles.selected : ''}`}
                                        onClick={() => setShippingOption('standard')}
                                    >
                                        <CheckCircle size={20} color={shippingOption === 'standard' ? "#D32F2F" : "#ccc"} />
                                        <span className={styles.optionLabel}>Standard</span>
                                        <span className={styles.deliveryTime}>5-7 days</span>
                                        <span className={styles.optionPrice}>FREE</span>
                                    </div>

                                    <div
                                        className={`${styles.shipOption} ${shippingOption === 'express' ? styles.selected : ''}`}
                                        onClick={() => setShippingOption('express')}
                                    >
                                        {shippingOption === 'express' ? (
                                            <CheckCircle size={20} color="#D32F2F" />
                                        ) : (
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #ccc' }} />
                                        )}
                                        <span className={styles.optionLabel}>Express</span>
                                        <span className={styles.deliveryTime}>1-2 days</span>
                                        <span className={styles.optionPrice}>₱ 125</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.paymentFooter}>
                                <div>
                                    <span className={styles.totalLabel}>Total</span>
                                    <span className={styles.totalAmount}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</span>
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
