'use client';

import Header from '@/components/layout/Header';
import Link from 'next/link';
import { BadgeCheck, CreditCard, ShieldCheck, LifeBuoy } from 'lucide-react';
import styles from './page.module.css';

const protections = [
  {
    icon: BadgeCheck,
    title: 'Verified Sellers',
    text: 'Seller accounts go through identity checks before they can host auctions or list products.',
  },
  {
    icon: CreditCard,
    title: 'Secure Checkout',
    text: 'Payments stay inside BIDPal checkout so orders can be tracked from winning bid to delivery.',
  },
  {
    icon: ShieldCheck,
    title: 'Auction Safeguards',
    text: 'Bid records, reminders, live session details, and order status are kept together for transparency.',
  },
  {
    icon: LifeBuoy,
    title: 'Dispute Support',
    text: 'If something goes wrong, buyers can raise a dispute and BIDPal keeps the transaction history available for review.',
  },
];

export default function BuyerProtectionPage() {
  return (
    <main className={styles.main}>
      <Header />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>Buyer Protection</p>
          <h1>Bid with confidence on every auction.</h1>
          <p>
            BIDPal combines verified sellers, secure payment flow, and order support so buyers can join live auctions with clearer expectations.
          </p>
          <div className={styles.actions}>
            <Link href="/auctions" className={styles.primaryBtn}>Browse Auctions</Link>
            <Link href="/live" className={styles.secondaryBtn}>See Live Auctions</Link>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.grid}>
          {protections.map(({ icon: Icon, title, text }) => (
            <article key={title} className={styles.card}>
              <div className={styles.iconWrap}><Icon size={22} /></div>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className={styles.note}>
          <h2>Before you bid</h2>
          <p>
            Review the product photos, seller profile, starting price, bid increment, and shipping details. When you win, complete checkout promptly so the seller can prepare your order.
          </p>
        </div>
      </section>
    </main>
  );
}
