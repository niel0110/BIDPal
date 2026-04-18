'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, User, Trophy, Clock } from 'lucide-react';
import styles from './page.module.css';

export default function AuctionBiddersPage() {
    const params = useParams();
    const auctionId = params.id;

    const [loading, setLoading] = useState(true);
    const [auctionData, setAuctionData] = useState(null);
    const [allBidders, setAllBidders] = useState([]);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        if (!auctionId) return;
        const fetchData = async () => {
            try {
                const [auctionRes, bidsRes] = await Promise.all([
                    fetch(`${apiUrl}/api/auctions/${auctionId}`),
                    fetch(`${apiUrl}/api/auctions/${auctionId}/bids`),
                ]);

                if (auctionRes.ok) setAuctionData(await auctionRes.json());

                if (bidsRes.ok) {
                    const bids = await bidsRes.json();
                    const bidsByUser = {};
                    bids.forEach(bid => {
                        if (!bidsByUser[bid.user_id] || bid.bid_amount > bidsByUser[bid.user_id].bid_amount) {
                            bidsByUser[bid.user_id] = bid;
                        }
                    });
                    const sorted = Object.values(bidsByUser).sort((a, b) => b.bid_amount - a.bid_amount);
                    setAllBidders(sorted);
                }
            } catch (err) {
                console.error('Failed to fetch bidders:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [auctionId]);

    if (loading) return <BIDPalLoader />;

    const productName = auctionData?.product?.name || 'Auction';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Link href={`/seller/auctions/${auctionId}/results`} className={styles.backLink}>
                    <span className={styles.backLinkIcon}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                    <span>Results</span>
                </Link>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Bidding History</h1>
                    <p className={styles.subtitle}>{productName}</p>
                </div>
            </div>

            {allBidders.length === 0 ? (
                <div className={styles.emptyState}>
                    <Trophy size={48} color="#ccc" />
                    <h3>No Bids Recorded</h3>
                    <p>No one placed a bid on this auction.</p>
                </div>
            ) : (
                <>
                    <div className={styles.summaryBar}>
                        <span className={styles.summaryCount}>{allBidders.length} bidder{allBidders.length !== 1 ? 's' : ''}</span>
                        <span className={styles.summarySub}>sorted by highest bid</span>
                    </div>

                    <div className={styles.table}>
                        {/* Table header */}
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
                                            <div className={styles.avatar}>
                                                {bid.bidder?.Avatar
                                                    ? <img src={bid.bidder.Avatar} alt={bidderName} />
                                                    : <User size={16} />}
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
                                            {new Date(bid.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            <span className={styles.timeCell}>
                                                {new Date(bid.placed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
