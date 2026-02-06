'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { Clock, Eye, Heart, Video, Send, X, Star, Truck, Pencil, CheckCircle } from 'lucide-react';
import styles from './page.module.css';

// Mock Data
const initialBids = [
    { id: 1, user: 'FerreroChoco123', amount: '1,700', time: '3 seconds ago' },
    { id: 2, user: 'FerreroChoco123', amount: '1,500', time: '3 seconds ago' },
    { id: 3, user: 'FerreroChoco123', amount: '1,300', time: '3 seconds ago' },
    { id: 4, user: 'FerreroChoco123', amount: '1,000', time: '3 seconds ago' },
];

const initialComments = [
    { id: 1, user: 'FerreroChoco123', text: 'OMG SANA MAMINE' },
    { id: 2, user: 'ParuButterfly22', text: 'huhu sana sumakto' },
];

export default function LivePage() {
    const [bids, setBids] = useState(initialBids);
    const [comments, setComments] = useState(initialComments);
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
        amount: "1700"
    });

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
                        {/* Using a gradient background instead of actual video for demo */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(rgba(224, 195, 252, 0.5), rgba(142, 197, 252, 0.5)), url(https://placehold.co/1280x720/png?text=FLASH+SALE+LIVE) center/cover',
                            opacity: 0.8
                        }} />
                        <Video size={64} fill="black" stroke="none" style={{ zIndex: 1 }} />
                        <h2 style={{ zIndex: 1, marginTop: '1rem', fontWeight: 800, fontSize: '1.5rem' }}>Live Stream Video</h2>
                    </div>

                    <div className={styles.overlayTop}>
                        <div className={styles.timerBadge}>
                            <Clock size={16} />
                            <span>10:01</span>
                        </div>
                        <div className={styles.viewerBadge}>
                            <Eye size={16} />
                            <span>98</span>
                        </div>
                    </div>

                    <div className={styles.sellerOverlay}>
                        <div className={styles.sellerAvatar} style={{ backgroundImage: 'url(https://placehold.co/100x100)' }} />
                        <div className={styles.sellerInfo}>
                            <div className={styles.sellerName}>@seller321</div>
                            <div className={styles.sellerStats}>
                                <Heart size={10} fill="white" /> 7.8k
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
                                src="https://placehold.co/150x150"
                                alt="Product"
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
                                    Blackstride Classics
                                </h3>
                                <div className={styles.currentBidLabel}>Current Bid (5 Bids)</div>
                                <div className={styles.bidInfo}>
                                    <div>
                                        <div className={styles.countDown}>00h: 25m: 37s</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>₱ 1200</div>
                                        <div className={styles.price}>₱ 1700</div>
                                    </div>
                                </div>
                            </div>
                            <button className={styles.bidButton} onClick={() => setShowModal(true)}>Bid</button>
                        </div>

                        <div className={styles.bidTicker}>
                            {bids.map(bid => (
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
                            ))}
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
                            <span className={styles.bidLabel}>Current Bid ( 5 Bids)</span>
                            <span className={styles.bidValue}>₱ 1700</span>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Increase each bid by Php 100</label>
                            <div className={styles.currencyInputWrapper}>
                                <span className={styles.currencySymbol}>₱</span>
                                <input
                                    type="number"
                                    className={styles.bidInput}
                                    value={bidAmount}
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
                            <img src="https://placehold.co/400x400" alt="Product" className={styles.mainProductImg} />
                            <div className={styles.thumbnailRow}>
                                <img src="https://placehold.co/100x100" className={styles.thumbImg} alt="thumb" />
                                <img src="https://placehold.co/100x100" className={styles.thumbImg} alt="thumb" />
                                <img src="https://placehold.co/100x100" className={styles.thumbImg} alt="thumb" />
                                <img src="https://placehold.co/100x100" className={styles.thumbImg} alt="thumb" />
                            </div>

                            <div className={styles.productBasics}>
                                <div>
                                    <h2>Blackstride Classics</h2>
                                    <div className={styles.bidSummary}>
                                        <p>Current Bid (5 bids)</p>
                                        <p style={{ color: '#D32F2F' }}>06h: 25m: 37s</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>₱ 1200</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>₱ 1700</div>
                                </div>
                            </div>

                            <p className={styles.shortDesc}>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
                            </p>
                        </div>

                        {/* Right Side */}
                        <div className={styles.detailRight}>
                            <div className={styles.shippingInfo}>
                                <Truck size={24} color="#666" />
                                <div className={styles.shippingText}>
                                    <strong>Estimated between May 6 - 10</strong>
                                    Shipping fee: ₱ 125.00
                                </div>
                            </div>

                            <div className={styles.specSection}>
                                <h3>Item Specifications</h3>
                                <div className={styles.specText}>
                                    Vorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis diam sit amet lacinia. Aliquam in elementum tellus. Curabitur tempor quis eros tempus lacinia. Nam bibendum pellentesque quam a convallis. Sed ut vulputate nisl. Integer in felis sed leo vestibulum venenatis.
                                </div>
                            </div>

                            <div className={styles.sellerCard}>
                                <div className={styles.sellerHead}>
                                    <div className={styles.sellerAvatarLarge} />
                                    <div className={styles.sellerMeta}>
                                        <div className={styles.sellerNameBold}>USER SELLER</div>
                                        <div className={styles.ratingBadge}>
                                            <Star size={14} fill="#FBC02D" stroke="none" />
                                            <span>4.4</span>
                                        </div>
                                    </div>
                                    <button className={styles.visitBtn}>Visit</button>
                                </div>
                                <div className={styles.sellerStatsRow}>
                                    <span>151 products</span>
                                    <span>97% 24h response rate</span>
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
                                    src="https://placehold.co/400x400"
                                    alt="Product"
                                    className={styles.mainProductImg}
                                    style={{ border: '2px solid #00A3FF' }}
                                />
                                <div className={styles.thumbnailRow} style={{ marginTop: '1rem' }}>
                                    <img src="https://placehold.co/80x80" className={styles.thumbImg} alt="thumb" />
                                    <img src="https://placehold.co/80x80" className={styles.thumbImg} alt="thumb" />
                                    <img src="https://placehold.co/80x80" className={styles.thumbImg} alt="thumb" />
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Blackstride Classics</h3>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700 }}>₱ 1200</div>
                                        <div style={{ fontWeight: 700 }}>₱ 1700</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Currrent Bid (5 bids)</div>
                                <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>06h: 25m: 37s</div>
                                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem', lineHeight: 1.5 }}>
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
                                </p>
                            </div>
                        </div>

                        {/* Right Side: Checkout Details */}
                        <div className={styles.paymentRight}>
                            <h2>Payment</h2>

                            <div className={styles.infoBlock}>
                                <div className={styles.infoContent}>
                                    <h4>Shipping Address</h4>
                                    <p>Corem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit.</p>
                                </div>
                                <button className={styles.editBtn}><Pencil size={14} /></button>
                            </div>

                            <div className={styles.infoBlock}>
                                <div className={styles.infoContent}>
                                    <h4>Contact Information</h4>
                                    <p>+91987654321</p>
                                    <p>gmail@example.com</p>
                                </div>
                                <button className={styles.editBtn}><Pencil size={14} /></button>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontWeight: 700 }}>Shipping Options</h3>
                                    <div className={styles.discountBadge}>
                                        <span>5% Discount</span>
                                        <X size={14} style={{ marginLeft: '10px', cursor: 'pointer' }} />
                                    </div>
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
                                <p className={styles.deliveryNote}>Delivered on or before Thursday, 23 April 2020</p>
                            </div>

                            <div className={styles.paymentFooter}>
                                <div>
                                    <span className={styles.totalLabel}>Total</span>
                                    <span className={styles.totalAmount}>₱ 1700</span>
                                </div>
                                <button className={styles.finalPayBtn}>Pay</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
