'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import styles from './layout.module.css';

export default function SellerLayout({ children }) {
    const pathname = usePathname();
    const isHeaderless = pathname?.startsWith('/seller/setup');

    if (isHeaderless) {
        // Render setup pages with no header — standalone onboarding experience
        return <>{children}</>;
    }

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
