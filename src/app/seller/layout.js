'use client';

import Sidebar from '@/components/seller/Sidebar';
import Header from '@/components/layout/Header';
import styles from './layout.module.css';

export default function SellerLayout({ children }) {
    return (
        <div className={styles.sellerContainer}>
            <Header />
            <div className={styles.mainWrapper}>
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    );
}
