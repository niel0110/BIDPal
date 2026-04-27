'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, User, Trophy, Shield, ShieldAlert, ShieldX, ShieldCheck, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';

const STANDING_CFG = {
    clean:      { label: 'Good Standing',         short: 'Good',        color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', Icon: ShieldCheck },
    warned:     { label: 'Strike 1 — Warned',     short: 'Strike 1',    color: '#b45309', bg: '#fffbeb', border: '#fde68a', Icon: Shield },
    restricted: { label: 'Strike 2 — Restricted', short: 'Strike 2',    color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', Icon: ShieldAlert },
    suspended:  { label: 'Strike 3 — Suspended',  short: 'Suspended',   color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: ShieldX },
    flagged_bogus: { label: 'Flagged — Bogus Buyer', short: 'Bogus',    color: '#7c2d12', bg: '#fff1f2', border: '#fecdd3', Icon: AlertTriangle },
};

function StandingBadge({ status }) {
    const cfg = STANDING_CFG[status] || STANDING_CFG.clean;
    const { Icon } = cfg;
    const isAlert = status && status !== 'clean';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 20, padding: '2px 8px',
            fontSize: '0.68rem', fontWeight: 700, color: cfg.color,
            whiteSpace: 'nowrap',
            boxShadow: isAlert ? `0 0 0 2px ${cfg.border}` : 'none',
        }}>
            <Icon size={11} color={cfg.color} />
            {cfg.short}
        </span>
    );
}

export default function AuctionBiddersPage() {
    const params = useParams();
    const auctionId = params.id;

    const [loading, setLoading] = useState(true);
    const [auctionData, setAuctionData] = useState(null);
    const [allBidders, setAllBidders] = useState([]);
    const [standingMap, setStandingMap] = useState({});

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

                    // Batch-fetch violation records for all unique bidders
                    const uniqueIds = [...new Set(sorted.map(b => b.user_id).filter(Boolean))];
                    const records = await Promise.all(
                        uniqueIds.map(uid =>
                            fetch(`${apiUrl}/api/violations/user/${uid}/record`)
                                .then(r => r.ok ? r.json() : null)
                                .catch(() => null)
                        )
                    );
                    const map = {};
                    uniqueIds.forEach((uid, i) => {
                        map[uid] = records[i]?.account_status || 'clean';
                    });
                    setStandingMap(map);
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

    const alertCount = allBidders.filter(b => standingMap[b.user_id] && standingMap[b.user_id] !== 'clean').length;

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

            {/* Alert banner if any bidder has a non-clean standing */}
            {alertCount > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fff7ed', border: '1.5px solid #fed7aa',
                    borderRadius: 10, padding: '10px 16px', marginBottom: 16,
                    fontSize: '0.82rem', color: '#c2410c', fontWeight: 600,
                }}>
                    <AlertTriangle size={16} color="#c2410c" style={{ flexShrink: 0 }} />
                    {alertCount} bidder{alertCount !== 1 ? 's have' : ' has'} a flagged account standing. Review carefully before proceeding.
                </div>
            )}

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
                        <div className={styles.tableHeader}>
                            <div className={styles.colRank}>Rank</div>
                            <div className={styles.colBidder}>Bidder</div>
                            <div className={styles.colAmount}>Highest Bid</div>
                            <div className={styles.colDate}>Date & Time</div>
                        </div>

                        {allBidders.map((bid, index) => {
                            const isTopThree = index < 3;
                            const bidderName = bid.bidder
                                ? `${bid.bidder.Fname || ''} ${bid.bidder.Lname || ''}`.trim() || 'Anonymous'
                                : 'Anonymous';
                            const standing = standingMap[bid.user_id] || 'clean';
                            const isAlert = standing !== 'clean';

                            return (
                                <div
                                    key={bid.bid_id}
                                    className={`${styles.tableRow} ${isTopThree ? styles.highlightRow : ''}`}
                                    style={isAlert ? { borderLeft: `3px solid ${STANDING_CFG[standing]?.border || '#fed7aa'}` } : {}}
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
                                                <div className={styles.bidderName} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    {bidderName}
                                                    {index === 0 && <span className={styles.winnerBadge}>Winner</span>}
                                                    <StandingBadge status={standing} />
                                                </div>
                                                <div className={styles.bidderId}>ID: {bid.user_id?.slice(0, 8)}…</div>
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
