'use client';

import Header from '@/components/layout/Header';
import Link from 'next/link';
import styles from './page.module.css';

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.hero}>
        <h1>About <span className={styles.red}>BIDPal</span></h1>
        <p>Your trusted live auction marketplace in the Philippines</p>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>What is BIDPal?</h2>
          <p>
            BIDPal is a live auction platform where verified sellers host real-time livestream
            auctions and buyers can bid, win, and shop with confidence. Every seller is vetted,
            every transaction is protected.
          </p>
        </section>

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🔴</div>
            <h3>Live Auctions</h3>
            <p>Watch and bid in real-time livestream auctions hosted by trusted sellers.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>✅</div>
            <h3>Verified Sellers</h3>
            <p>All sellers are KYC-verified so you can shop with peace of mind.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🛡️</div>
            <h3>Buyer Protection</h3>
            <p>Secure payments and dispute resolution protect every purchase you make.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📦</div>
            <h3>Fixed Price Items</h3>
            <p>Browse fixed-price listings from sellers for instant purchase anytime.</p>
          </div>
        </div>

        <section className={styles.cta}>
          <h2>Ready to start bidding?</h2>
          <div className={styles.ctaButtons}>
            <Link href="/" className={styles.primaryBtn}>Browse Auctions</Link>
            <Link href="/signup" className={styles.secondaryBtn}>Create Account</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
