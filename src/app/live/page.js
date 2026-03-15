'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Clock, Eye, Heart, Video, Send, X, Star, Truck, Pencil, CheckCircle, Loader2 } from 'lucide-react';
import styles from './page.module.css';

export default function LivePage() {
    const searchParams = useSearchParams();
    const auctionId = searchParams.get('id');

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

    // Winner Modal State
    const [winnerModal, setWinnerModal] = useState({
        show: false,
        title: "You won the auction!",
        subtitle: "You're the highest bidder",
        amount: "0"
    });

    useEffect(() => {
        const fetchAuctionDetails = async () => {
            if (!auctionId) {
                setLoading(false);
                return;
            }

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                
                // Fetch auction details
                const res = await fetch(`${apiUrl}/api/auctions/${auctionId}`);
                const data = await res.json();

                if (res.ok) {
                    setAuction(data);
                    // Update bids from existing data if possible, or fetch separately
                    // For now let's fetch bids separately to match the ticker
                    fetchBids();
                } else {
                    setError(data.error || 'Failed to fetch auction details');
                }
            } catch (err) {
                setError('An error occurred while fetching auction details');
            } finally {
                setLoading(false);
            }
        };

        const fetchBids = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/bids`);
                const data = await res.json();
                if (res.ok) {
                    // map to view format
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

        fetchAuctionDetails();
        // Set up interval for bids
        const interval = setInterval(fetchBids, 5000);
        return () => clearInterval(interval);
    }, [auctionId]);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;
        const newComment = {
            id: Date.now(),
            user: 'You',
            text: inputValue
        };
        setComments([...comments, newComment]);
        setInputValue('');
    };

    const handlePlaceBid = () => {
        if (!bidAmount) return;

        // Add new bid to top
        const newBid = {
            id: Date.now(),
            user: 'You',
            amount: bidAmount,
            time: 'Just now'
        };
        setBids([newBid, ...bids]);
        setShowModal(false);
        setBidAmount('');
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
            {/* Simulation Controls (Secretly for demo) */}
            <div className={styles.simControls}>
                <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 700 }}>SIMULATION</span>
                <button className={styles.simBtn} onClick={simulateWin}>Win Auction</button>
                <button className={styles.simBtn} onClick={simulateBackupWin}>Backup Win</button>
                <button className={styles.simBtn} onClick={() => setShowPaymentModal(true)}>Open Payment</button>
            </div>

            <div className={styles.container}>

                {/* VIDEO SECTION */}
                <section className={styles.videoWrapper}>
                    <div className={styles.videoPlaceholder}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${product?.images?.[0]?.image_url || 'https://placehold.co/1280x720'}) center/cover`,
                            opacity: 0.8,
                            filter: 'blur(10px)'
                        }} />
                        <Video size={64} fill="white" stroke="none" style={{ zIndex: 1, opacity: 0.5 }} />
                        <h2 style={{ zIndex: 1, marginTop: '1rem', fontWeight: 800, fontSize: '1.5rem', color: 'white' }}>LIVE STREAM</h2>
                    </div>

                    <div className={styles.overlayTop}>
                        <div className={styles.timerBadge}>
                            <Clock size={16} />
                            <span>{auction.status === 'active' ? 'LIVE' : 'Scheduled'}</span>
                        </div>
                        <div className={styles.viewerBadge}>
                            <Eye size={16} />
                            <span>{Math.floor(Math.random() * 50) + 50}</span>
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
                                        <div className={styles.price}>₱ {auction.current_price || auction.reserve_price}</div>
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
                        <h3 className={styles.chatHeader}>Comments</h3>
                        <div className={styles.messagesList}>
                            {comments.map(msg => (
                                <div key={msg.id} className={styles.messageItem}>
                                    <div className={styles.chatAvatar} />
                                    <div>
                                        <div className={styles.messageAuthor}>{msg.user}</div>
                                        <div className={styles.messageText}>{msg.text}</div>
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && (
                                <div style={{ padding: '20px', color: '#999', textAlign: 'center' }}>
                                    Welcome to the live stream!
                                </div>
                            )}
                        </div>
                        <div className={styles.inputArea}>
                            <input
                                type="text"
                                placeholder="Type..."
                                className={styles.chatInput}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button className={styles.sendBtn} onClick={handleSendMessage}>
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
                            <span className={styles.bidValue}>₱ {auction.current_price || auction.reserve_price}</span>
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
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>₱ {auction.current_price || auction.reserve_price}</div>
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
                                        <div style={{ fontWeight: 700 }}>₱ {auction.current_price || auction.reserve_price}</div>
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
                                    <span className={styles.totalAmount}>₱ {auction.current_price || auction.reserve_price}</span>
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
