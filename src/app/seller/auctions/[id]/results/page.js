'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Trophy, Eye, Heart, Share2, Clock, User, TrendingUp, DollarSign, Package, Truck } from 'lucide-react';
import styles from './page.module.css';

export default function AuctionResultsPage() {
    const params = useParams();
    const router = useRouter();
    const auctionId = params.id;

    const [loading, setLoading] = useState(true);
    const [auctionData, setAuctionData] = useState(null);
    const [winner, setWinner] = useState(null);
    const [topBidders, setTopBidders] = useState([]);
    const [allBidders, setAllBidders] = useState([]);
    const [stats, setStats] = useState({ viewers: 0, likes: 0, shares: 0 });
    const [updatingOrder, setUpdatingOrder] = useState(false);

    useEffect(() => {
        const fetchAuctionResults = async () => {
            if (!auctionId) return;

            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

                // Fetch auction data
                const auctionRes = await fetch(`${apiUrl}/api/auctions/${auctionId}`);
                const auction = await auctionRes.json();
                setAuctionData(auction);

                // Fetch winner data
                const winnerRes = await fetch(`${apiUrl}/api/auctions/${auctionId}/winner`);
                if (winnerRes.ok) {
                    const winnerData = await winnerRes.json();
                    setWinner(winnerData);
                }

                // Fetch stats
                const statsRes = await fetch(`${apiUrl}/api/auctions/${auctionId}/stats`);
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData.stats);
                }

                // Fetch all bidders
                const bidsRes = await fetch(`${apiUrl}/api/auctions/${auctionId}/bids`);
                if (bidsRes.ok) {
                    const bids = await bidsRes.json();
                    // Group bids by user and get highest bid for each
                    const bidsByUser = {};
                    bids.forEach(bid => {
                        if (!bidsByUser[bid.user_id] || bid.bid_amount > bidsByUser[bid.user_id].bid_amount) {
                            bidsByUser[bid.user_id] = bid;
                        }
                    });
                    const sortedBidders = Object.values(bidsByUser)
                        .sort((a, b) => b.bid_amount - a.bid_amount);

                    setTopBidders(sortedBidders.slice(0, 3));
                    setAllBidders(sortedBidders);
                }

            } catch (err) {
                console.error('Failed to fetch auction results:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAuctionResults();
    }, [auctionId]);

    const updateOrderStatus = async (orderId, newStatus) => {
        if (!orderId) return;

        setUpdatingOrder(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                // Refetch winner data to get updated order status
                const winnerRes = await fetch(`${apiUrl}/api/auctions/${auctionId}/winner`);
                if (winnerRes.ok) {
                    const winnerData = await winnerRes.json();
                    setWinner(winnerData);
                }
                alert(`Order status updated to: ${newStatus}`);
            } else {
                alert('Failed to update order status');
            }
        } catch (err) {
            console.error('Error updating order:', err);
            alert('Error updating order status');
        } finally {
            setUpdatingOrder(false);
        }
    };

    const getNextOrderStatus = (currentStatus) => {
        const statusFlow = {
            'pending_payment': 'processing',
            'processing': 'shipped',
            'shipped': 'completed'
        };
        return statusFlow[currentStatus] || null;
    };

    const getStatusLabel = (status) => {
        const labels = {
            'pending_payment': 'Pending Payment',
            'processing': 'Processing',
            'shipped': 'Shipped',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading auction results...</div>
            </div>
        );
    }

    if (!auctionData) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>Auction not found</div>
            </div>
        );
    }

    const { product } = auctionData;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => router.back()}>
                    <ChevronLeft size={20} />
                    Back
                </button>
                <h1 className={styles.title}>Auction Results</h1>
            </div>

            {/* Product Info */}
            <div className={styles.productSection}>
                <img
                    src={product?.images?.[0]?.image_url || 'https://placehold.co/300x300?text=No+Image'}
                    alt={product?.name}
                    className={styles.productImage}
                />
                <div className={styles.productInfo}>
                    <h2>{product?.name || 'Unknown Product'}</h2>
                    <p className={styles.productDesc}>{product?.description}</p>
                    <div className={styles.auctionMeta}>
                        <span><Clock size={16} /> Ended: {new Date(auctionData.live_ended_at || auctionData.end_time).toLocaleString()}</span>
                        <span>Duration: {auctionData.start_time ?
                            Math.floor((new Date(auctionData.live_ended_at) - new Date(auctionData.start_time)) / 60000) + ' minutes'
                            : 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <Eye size={24} />
                    <div className={styles.statValue}>{stats.viewers || 0}</div>
                    <div className={styles.statLabel}>Total Views</div>
                </div>
                <div className={styles.statCard}>
                    <Heart size={24} />
                    <div className={styles.statValue}>{stats.likes || 0}</div>
                    <div className={styles.statLabel}>Likes</div>
                </div>
                <div className={styles.statCard}>
                    <Share2 size={24} />
                    <div className={styles.statValue}>{stats.shares || 0}</div>
                    <div className={styles.statLabel}>Shares</div>
                </div>
                <div className={styles.statCard}>
                    <TrendingUp size={24} />
                    <div className={styles.statValue}>{topBidders.length}</div>
                    <div className={styles.statLabel}>Total Bidders</div>
                </div>
            </div>

            {/* Winner Section */}
            {winner && winner.has_winner ? (
                <div className={styles.winnerSection}>
                    <div className={styles.sectionHeader}>
                        <Trophy size={24} color="#f59e0b" />
                        <h3>Auction Winner</h3>
                    </div>
                    <div className={styles.winnerCard}>
                        <div className={styles.winnerAvatar}>
                            {winner.winner.avatar ? (
                                <img src={winner.winner.avatar} alt={winner.winner.name} />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div className={styles.winnerInfo}>
                            <h4>{winner.winner.name}</h4>
                            <p>Won on {new Date(winner.winning_bid.placed_at).toLocaleString()}</p>
                        </div>
                        <div className={styles.winnerPrice}>
                            <DollarSign size={20} />
                            <span>₱{winner.winning_bid.amount.toLocaleString('en-PH')}</span>
                        </div>
                    </div>

                    {winner.order && (
                        <div className={styles.orderManagement}>
                            <div className={styles.orderStatusSection}>
                                <div className={styles.statusBadgeContainer}>
                                    <span className={styles.statusLabel}>Order Status:</span>
                                    <span className={`${styles.statusBadge} ${styles[winner.order.status]}`}>
                                        {getStatusLabel(winner.order.status)}
                                    </span>
                                </div>
                                <div className={styles.orderDetails}>
                                    <span>Order ID: {winner.order.order_id.slice(0, 8)}...</span>
                                </div>
                            </div>

                            {winner.order.status !== 'completed' && winner.order.status !== 'cancelled' && (
                                <div className={styles.orderActions}>
                                    {getNextOrderStatus(winner.order.status) && (
                                        <button
                                            className={styles.updateStatusBtn}
                                            onClick={() => updateOrderStatus(winner.order.order_id, getNextOrderStatus(winner.order.status))}
                                            disabled={updatingOrder}
                                        >
                                            {updatingOrder ? (
                                                'Updating...'
                                            ) : (
                                                <>
                                                    {getNextOrderStatus(winner.order.status) === 'processing' && <Package size={18} />}
                                                    {getNextOrderStatus(winner.order.status) === 'shipped' && <Truck size={18} />}
                                                    Mark as {getStatusLabel(getNextOrderStatus(winner.order.status))}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.noWinnerSection}>
                    <Trophy size={48} color="#ccc" />
                    <h3>No Winner</h3>
                    <p>This auction ended without any bids or the reserve price was not met.</p>
                </div>
            )}

            {/* Top 3 Winning Bidders */}
            {topBidders.length > 0 && (
                <div className={styles.biddersSection}>
                    <div className={styles.sectionHeader}>
                        <TrendingUp size={24} />
                        <h3>Top 3 Winning Bidders</h3>
                    </div>
                    <p className={styles.sectionNote}>
                        Winner priority order. If #1 cancels, #2 becomes the winner, then #3.
                    </p>
                    <div className={styles.biddersList}>
                        {topBidders.map((bid, index) => {
                            const isTopThree = index < 3;
                            return (
                                <div key={bid.bid_id} className={`${styles.bidderCard} ${isTopThree ? styles.topBidder : ''}`}>
                                    <div className={styles.bidderRank}>#{index + 1}</div>
                                    <div className={styles.bidderAvatar}>
                                        {bid.bidder?.Avatar ? (
                                            <img src={bid.bidder.Avatar} alt={bid.bidder.Fname} />
                                        ) : (
                                            <User size={24} />
                                        )}
                                    </div>
                                    <div className={styles.bidderInfo}>
                                        <h5>
                                            {bid.bidder ? `${bid.bidder.Fname || ''} ${bid.bidder.Lname || ''}`.trim() : 'Anonymous'}
                                            {index === 0 && <span className={styles.currentWinner}>Current Winner</span>}
                                            {index === 1 && <span className={styles.backupWinner}>Backup Winner</span>}
                                            {index === 2 && <span className={styles.thirdPlace}>3rd Place</span>}
                                        </h5>
                                        <p>{new Date(bid.placed_at).toLocaleString()}</p>
                                    </div>
                                    <div className={styles.bidderAmount}>
                                        ₱{bid.bid_amount.toLocaleString('en-PH')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* All Bidders Transaction History */}
            {allBidders.length > 0 && (
                <div className={styles.transactionHistory}>
                    <div className={styles.sectionHeader}>
                        <Clock size={24} />
                        <h3>Complete Bidding History</h3>
                    </div>
                    <p className={styles.sectionSubtitle}>
                        All participants who placed bids on this auction ({allBidders.length} total bidders)
                    </p>
                    <div className={styles.historyTable}>
                        <div className={styles.tableHeader}>
                            <div className={styles.colRank}>Rank</div>
                            <div className={styles.colBidder}>Bidder</div>
                            <div className={styles.colAmount}>Highest Bid</div>
                            <div className={styles.colDate}>Date & Time</div>
                        </div>
                        {allBidders.map((bid, index) => {
                            const isTopThree = index < 3;
                            const bidderName = bid.bidder
                                ? `${bid.bidder.Fname || ''} ${bid.bidder.Lname || ''}`.trim()
                                : 'Anonymous';

                            return (
                                <div
                                    key={bid.bid_id}
                                    className={`${styles.tableRow} ${isTopThree ? styles.highlightRow : ''}`}
                                >
                                    <div className={styles.colRank}>
                                        <div className={`${styles.rankBadge} ${isTopThree ? styles.topRank : ''}`}>
                                            #{index + 1}
                                        </div>
                                    </div>
                                    <div className={styles.colBidder}>
                                        <div className={styles.bidderCell}>
                                            <div className={styles.smallAvatar}>
                                                {bid.bidder?.Avatar ? (
                                                    <img src={bid.bidder.Avatar} alt={bidderName} />
                                                ) : (
                                                    <User size={16} />
                                                )}
                                            </div>
                                            <div>
                                                <div className={styles.bidderName}>
                                                    {bidderName}
                                                    {index === 0 && <span className={styles.winnerBadge}>Winner</span>}
                                                </div>
                                                <div className={styles.bidderId}>ID: {bid.user_id?.slice(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.colAmount}>
                                        <div className={`${styles.amountCell} ${isTopThree ? styles.topAmount : ''}`}>
                                            ₱{bid.bid_amount.toLocaleString('en-PH')}
                                        </div>
                                    </div>
                                    <div className={styles.colDate}>
                                        <div className={styles.dateCell}>
                                            {new Date(bid.placed_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                            <span className={styles.timeCell}>
                                                {new Date(bid.placed_at).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
