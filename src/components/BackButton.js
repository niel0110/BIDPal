'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './BackButton.module.css';

export default function BackButton({ label = 'Back' }) {
    const router = useRouter();
    return (
        <button className={styles.backBtn} onClick={() => router.back()}>
            <span className={styles.iconWrap}>
                <ChevronLeft size={18} strokeWidth={2.5} />
            </span>
            <span className={styles.label}>{label}</span>
        </button>
    );
}
