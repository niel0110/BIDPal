'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Clock, Eye, Heart, Send, X, Star, Truck, Pencil, CheckCircle, Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react';
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
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [shippingOption, setShippingOption] = useState('standard');
    const [bidAmount, setBidAmount] = useState('');
    const [viewerCount, setViewerCount] = useState(0);
    const [streamReady, setStreamReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [streamEnded, setStreamEnded] = useState(false);
    const [rtmConnected, setRtmConnected] = useState(false);

    // Permission and Stream State
    const [permissionStatus, setPermissionStatus] = useState('idle'); // idle, requesting, granted, denied
    const [hasStarted, setHasStarted] = useState(false);

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
    const rtmClientRef = useRef(null);
    const rtmChannelRef = useRef(null);
    const socketRef = useRef(null);
    const commentsEndRef = useRef(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

    // Determine if the current user is the seller (host)
    const isHost = auction && user && String(auction.seller_info?.seller_id) === String(user.seller_id || user.id);

    // ── Socket.IO setup ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!auctionId) return;

        const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-auction', auctionId);
        });

        socket.on('bid-update', (bid) => {
            setBids(prev => [bid, ...prev]);
        });

        return () => {
            socket.disconnect();
        };
    }, [auctionId, apiUrl]);

    // ── Agora RTM (chat) setup ───────────────────────────────────────────────
    useEffect(() => {
        if (!auctionId || !user || !process.env.NEXT_PUBLIC_AGORA_APP_ID) return;

        let rtmClient = null;
        let rtmChannel = null;

        const startRtm = async () => {
            try {
                const AgoraRTM = (await import('agora-rtm-sdk')).default;

                rtmClient = AgoraRTM.createInstance(process.env.NEXT_PUBLIC_AGORA_APP_ID);
                rtmClientRef.current = rtmClient;

                // Fetch RTM token from backend
                const authToken = localStorage.getItem('bidpal_token');
                const rtmUid = String(user.id || user.user_id || 'guest');
                const tokenRes = await fetch(
                    `${apiUrl}/api/agora/rtm-token?uid=${encodeURIComponent(rtmUid)}`,
                    { headers: { Authorization: `Bearer ${authToken}` } }
                );
                const tokenData = await tokenRes.json();
                if (!tokenRes.ok) throw new Error(tokenData.error || 'RTM token fetch failed');

                await rtmClient.login({ uid: rtmUid, token: tokenData.token });

                rtmChannel = rtmClient.createChannel(String(auctionId));
                rtmChannelRef.current = rtmChannel;

                // Listen for incoming chat messages
                rtmChannel.on('ChannelMessage', (message, senderId) => {
                    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    try {
                        const parsed = JSON.parse(message.text);
                        setComments(prev => [...prev, {
                            id: Date.now() + Math.random(),
                            user: parsed.user || senderId,
                            text: parsed.text,
                            time
                        }]);
                    } catch {
                        setComments(prev => [...prev, {
                            id: Date.now() + Math.random(),
                            user: senderId,
                            text: message.text,
                            time
                        }]);
                    }
                });

                await rtmChannel.join();
                setRtmConnected(true);
                console.log('✅ Joined Agora RTM channel for chat');
            } catch (err) {
                console.error('Agora RTM init error:', err);
            }
        };

        startRtm();

        return () => {
            setRtmConnected(false);
            if (rtmChannel) rtmChannel.leave().catch(() => {});
            if (rtmClient) rtmClient.logout().catch(() => {});
        };
    }, [auctionId, user, apiUrl]);

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
                    const formattedBids = data.map(bid => ({
                        id: bid.bid_id,
                        user: bid.bidder ? `${bid.bidder.Fname} ${bid.bidder.Lname[0]}.` : 'Unknown',
                        amount: bid.amount.toLocaleString(),
                        time: new Date(bid.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }));
                    setBids(formattedBids);
                }
            } catch (err) {
                console.error('Failed to fetch bids:', err);
            }
        };

        const fetchAuctionDetails = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}`);
                const data = await res.json();
                if (res.ok) {
                    setAuction(data);
                    await fetchBids();
                } else {
                    setError(data.error || 'Failed to fetch auction details');
                }
            } catch (err) {
                setError('An error occurred while fetching auction details');
            } finally {
                setLoading(false);
            }
        };

        fetchAuctionDetails();
    }, [auctionId, apiUrl]);

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
                AgoraRTC = module.default;
                AgoraRTC.setLogLevel(4); // suppress verbose logs

                const agoraToken = await fetchAgoraToken();
                if (!agoraToken || cancelled) return;

                const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
                agoraClientRef.current = client;

                const role = isHost ? 'host' : 'audience';
                await client.setClientRole(role);

                // ── Set up ALL event listeners BEFORE joining the channel ────────────
                // This ensures we don't miss user-published if host is already streaming.
                client.on('user-published', async (remoteUser, mediaType) => {
                    if (isHost) return; // host does not subscribe to other hosts
                    console.log(`📺 Host published ${mediaType}, subscribing...`);
                    await client.subscribe(remoteUser, mediaType);
                    if (mediaType === 'video') {
                        remoteUser.videoTrack.play('agora-remote-video');
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
                    videoTrack.play('agora-local-video');
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
                console.error('Agora initialization error:', error);
                setPermissionStatus('denied');
            }
        };

        startAgora();

        return () => {
            cancelled = true;
            const { audio, video } = localTracksRef.current;
            if (audio) audio.close();
            if (video) video.close();
            if (agoraClientRef.current) {
                agoraClientRef.current.leave().catch(() => {});
            }
        };
    }, [auction, auctionId, isHost, hasStarted]);

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

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !rtmConnected) return;

        const displayName = user ? (user.Fname || user.email?.split('@')[0] || 'Guest') : 'Guest';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messagePayload = JSON.stringify({ user: displayName, text: inputValue.trim() });

        // Add locally for immediate feedback (with timestamp)
        setComments(prev => [...prev, { id: Date.now(), user: displayName, text: inputValue.trim(), time }]);
        setInputValue('');

        // Send via Agora RTM — reaches all channel members without going through our server
        if (rtmChannelRef.current) {
            try {
                await rtmChannelRef.current.sendMessage({ text: messagePayload });
            } catch (err) {
                console.error('RTM send error:', err);
            }
        }
    };

    const handlePlaceBid = async () => {
        if (!bidAmount) return;

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

            const newBid = {
                id: data.bid_id || Date.now(),
                user: user ? `${user.Fname} ${user.Lname?.[0]}.` : 'You',
                amount: Number(bidAmount).toLocaleString(),
                time: 'Just now'
            };

            // Emit to all viewers in the room via socket
            if (socketRef.current) {
                socketRef.current.emit('new-bid', { auctionId, bid: newBid });
            }
            setBids(prev => [newBid, ...prev]);
        } catch (err) {
            // Optimistic update even if API call fails (for demo)
            const newBid = {
                id: Date.now(),
                user: 'You',
                amount: Number(bidAmount).toLocaleString(),
                time: 'Just now'
            };
            if (socketRef.current) {
                socketRef.current.emit('new-bid', { auctionId, bid: newBid });
            }
            setBids(prev => [newBid, ...prev]);
        }

        setShowModal(false);
        setBidAmount('');
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
        if (audio) { audio.close(); localTracksRef.current.audio = null; }
        if (video) { video.close(); localTracksRef.current.video = null; }

        if (agoraClientRef.current) {
            try { await agoraClientRef.current.leave(); } catch (e) { console.error(e); }
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

    if (loading) {
        return (
            <main>
                <Header />
                <div className={styles.loaderContainer}>
                    <Loader2 className={styles.spinner} size={48} />
                    <p>Loading live stream...</p>
                </div>
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

    return (
        <main>
            <Header />
            {/* Simulation Controls (for demo) */}
            <div className={styles.simControls}>
                <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 700 }}>SIMULATION</span>
                <button className={styles.simBtn} onClick={simulateWin}>Win Auction</button>
                <button className={styles.simBtn} onClick={simulateBackupWin}>Backup Win</button>
                <button className={styles.simBtn} onClick={() => setShowPaymentModal(true)}>Open Payment</button>
            </div>

            <div className={styles.container}>

                {/* VIDEO SECTION */}
                <section className={styles.videoWrapper}>
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
                                                <h2 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.5rem' }}>Ready to Go Live?</h2>
                                                <p style={{ color: '#ddd', marginBottom: '1.5rem' }}>Start your live auction for {product?.name}</p>
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
                                ) : (
                                    <>
                                        <Loader2 size={40} color="white" className={styles.spinner} />
                                        <p style={{ color: 'white', marginTop: '1rem', fontWeight: 600 }}>Waiting for host to go live...</p>
                                    </>
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

                {/* BOTTOM CONTENT */}
                <div className={styles.bottomSection}>

                    {/* LEFT: AUCTION & BIDS */}
                    <div className={styles.auctionControl}>
                        <div className={styles.productRow}>
                            <img
                                src={product?.images?.[0]?.image_url || "https://placehold.co/150x150"}
                                alt={product?.name}
                                className={styles.productThumb}
                                onClick={() => setShowProductModal(true)}
                                style={{ cursor: 'pointer' }}
                            />
                            <div className={styles.productDetails}>
                                <h3
                                    className={styles.productTitle}
                                    onClick={() => setShowProductModal(true)}
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
                            <button className={styles.bidButton} onClick={() => setShowModal(true)}>Bid</button>
                        </div>

                        <div className={styles.bidTicker}>
                            {bids.length > 0 ? bids.map(bid => (
                                <div key={bid.id} className={styles.bidItem}>
                                    <div className={styles.bidderInfo}>
                                        <div className={styles.bidderAvatar} />
                                        <span className={styles.bidderName}>{bid.user}</span>
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
                        {/* Chat header with live connection status */}
                        <div className={styles.chatHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>Live Chat</h3>
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.75rem',
                                color: rtmConnected ? '#4CAF50' : '#999',
                                fontWeight: 600
                            }}>
                                <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: rtmConnected ? '#4CAF50' : '#bbb',
                                    display: 'inline-block'
                                }} />
                                {rtmConnected ? 'Connected' : 'Connecting...'}
                            </span>
                        </div>

                        {/* Messages list — auto-scrolls via commentsEndRef */}
                        <div className={styles.messagesList}>
                            {comments.length === 0 && (
                                <div style={{ padding: '20px', color: '#999', textAlign: 'center', fontSize: '0.85rem' }}>
                                    {rtmConnected ? 'Be the first to say something!' : 'Joining chat...'}
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
                            {/* Invisible anchor — scrolled into view on new messages */}
                            <div ref={commentsEndRef} />
                        </div>

                        {/* Input area — disabled until RTM is connected */}
                        <div className={styles.inputArea}>
                            <input
                                type="text"
                                placeholder={rtmConnected ? 'Say something...' : 'Connecting to chat...'}
                                className={styles.chatInput}
                                value={inputValue}
                                disabled={!rtmConnected}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                style={{ opacity: rtmConnected ? 1 : 0.5 }}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={handleSendMessage}
                                disabled={!rtmConnected || !inputValue.trim()}
                                style={{ opacity: (rtmConnected && inputValue.trim()) ? 1 : 0.4 }}
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
                                Minimum increment: Php {auction.incremental_bid_step || 100}
                            </label>
                            <div className={styles.currencyInputWrapper}>
                                <span className={styles.currencySymbol}>₱</span>
                                <input
                                    type="number"
                                    className={styles.bidInput}
                                    value={bidAmount}
                                    placeholder={(auction.current_price || auction.reserve_price) + (auction.incremental_bid_step || 100)}
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
                            <img src={product?.images?.[0]?.image_url || "https://placehold.co/400x400"} alt={product?.name} className={styles.mainProductImg} />
                            <div className={styles.thumbnailRow}>
                                {product?.images?.map((img, idx) => (
                                    <img key={idx} src={img.image_url} className={styles.thumbImg} alt={`thumb ${idx}`} />
                                ))}
                            </div>

                            <div className={styles.productBasics}>
                                <div>
                                    <h2>{product?.name}</h2>
                                    <div className={styles.bidSummary}>
                                        <p>Current Bid ({bids.length} bids)</p>
                                        <p style={{ color: '#D32F2F' }}>{auction.status === 'active' ? 'LIVE' : 'Starts Soon'}</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#999', textDecoration: 'line-through' }}>₱ {auction.reserve_price}</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>₱ {bids[0]?.amount || auction.current_price || auction.reserve_price}</div>
                                </div>
                            </div>

                            <p className={styles.shortDesc}>
                                {product?.description}
                            </p>
                        </div>

                        {/* Right Side */}
                        <div className={styles.detailRight}>
                            <div className={styles.shippingInfo}>
                                <Truck size={24} color="#666" />
                                <div className={styles.shippingText}>
                                    <strong>Estimated Shipping</strong>
                                    Shipping fee: ₱ 125.00
                                </div>
                            </div>

                            <div className={styles.specSection}>
                                <h3>Item Specifications</h3>
                                <div className={styles.specText}>
                                    {product?.specifications || 'No detailed specifications provided for this product.'}
                                </div>
                            </div>

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

                            <div className={styles.actionRow}>
                                <button
                                    className={styles.mainBidBtn}
                                    onClick={() => {
                                        setShowProductModal(false);
                                        setShowModal(true);
                                    }}
                                >
                                    Bid Now
                                </button>
                                <button className={styles.wishlistBtn}>
                                    <Heart size={24} />
                                </button>
                            </div>
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
