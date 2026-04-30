'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import AuctionCard from '@/components/card/AuctionCard';
import CategoryNav from '@/components/home/CategoryNav';
import BIDPalLoader from '@/components/BIDPalLoader';
import styles from './page.module.css';

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'live' | 'scheduled'

  const fetchAuctions = async (category = 'all') => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const catParam = category !== 'all' ? `&category=${encodeURIComponent(category)}` : '';
      const res = await fetch(`${apiUrl}/api/auctions?limit=100${catParam}`);
      if (res.ok) {
        const json = await res.json();
        // Only bid auctions
        setAuctions((json.data || []).filter(a => a.sale_type !== 'sale'));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions(selectedCategory);
  }, []);

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    fetchAuctions(cat);
  };

  const liveAuctions = auctions.filter(a => a.status === 'active');
  const scheduledAuctions = auctions.filter(a => a.status === 'scheduled');

  const displayed =
    activeTab === 'live' ? liveAuctions :
    activeTab === 'scheduled' ? scheduledAuctions :
    auctions;

  return (
    <main className={styles.main}>
      <Header />
      <CategoryNav activeId={selectedCategory} onSelect={handleCategorySelect} />

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Browse <span className={styles.red}>Auctions</span>
        </h1>
        <p className={styles.pageDesc}>Live and upcoming auctions from verified sellers</p>
        <div className={styles.tabs}>
          {[
            { id: 'all', label: `All (${auctions.length})` },
            { id: 'live', label: `Live (${liveAuctions.length})` },
            { id: 'scheduled', label: `Upcoming (${scheduledAuctions.length})` },
          ].map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><BIDPalLoader size="section" /></div>
      ) : displayed.length === 0 ? (
        <div className={styles.empty}>
          <p>No {activeTab === 'all' ? '' : activeTab} auctions found{selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {displayed.map(item => <AuctionCard key={item.id} data={item} />)}
        </div>
      )}
    </main>
  );
}
