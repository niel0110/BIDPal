'use client';

import { useState } from 'react';
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Clock,
    Users,
    TrendingUp,
    Calendar,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

export default function MyAuctions() {
    const [activeTab, setActiveTab] = useState('active');


    const auctions = [];

    const filteredAuctions = activeTab === 'all'
        ? auctions
        : auctions.filter(a => a.status === activeTab);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>My Auctions</h1>
                    <p>Manage your live, scheduled, and past auctions.</p>
                </div>
                <Link href="/seller/auctions/create" className={styles.createBtn}>
                    <Plus size={20} />
                    Create Auction
                </Link>
            </header>

            <div className={styles.tabsContainer}>
                <div className={styles.tabs}>
                    {['all', 'active', 'scheduled', 'completed', 'drafts'].map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input type="text" placeholder="Search auctions..." />
                </div>
            </div>

            <div className={styles.auctionGrid}>
                {filteredAuctions.length > 0 ? filteredAuctions.map(auction => (
                    <div key={auction.id} className={styles.auctionCard}>
                        <div className={styles.cardHeader}>
                            <span className={`${styles.statusBadge} ${styles[auction.status]}`}>
                                {auction.status === 'active' && <TrendingUp size={12} />}
                                {auction.status === 'scheduled' && <Calendar size={12} />}
                                {auction.status === 'completed' && <CheckCircle2 size={12} />}
                                {auction.status.toUpperCase()}
                            </span>
                            <span className={styles.auctionId}>#{auction.id}</span>
                            <button className={styles.moreBtn}><MoreHorizontal size={18} /></button>
                        </div>

                        <div className={styles.cardBody}>
                            <img src={auction.image} alt={auction.title} className={styles.thumbnail} />
                            <div className={styles.info}>
                                <h3>{auction.title}</h3>
                                <div className={styles.meta}>
                                    <Clock size={14} />
                                    <span>{auction.startTime}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>
                                    {auction.status === 'completed' ? 'Final Price' : 'Current Bid'}
                                </span>
                                <span className={styles.metricValue}>₱ {auction.currentBid.toLocaleString()}</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Total Bids</span>
                                <span className={styles.metricValue}>
                                    <Users size={14} /> {auction.bidders}
                                </span>
                            </div>
                        </div>

                        <div className={styles.cardActions}>
                            <button className={styles.secondaryBtn}>Details</button>
                            {auction.status === 'scheduled' && <button className={styles.primaryBtn}>Promote</button>}
                            {auction.status === 'active' && <Link href="/seller" className={styles.primaryBtn}>Control Hub</Link>}
                            {auction.status === 'completed' && <button className={styles.primaryBtn}>Settlement</button>}
                        </div>
                    </div>
                )) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                        <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No auctions yet</p>
                        <p style={{ fontSize: '0.9rem' }}>Create your first auction to start selling.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
