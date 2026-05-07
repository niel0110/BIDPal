'use client';

import { Ban } from 'lucide-react';
import styles from './AccountStatusModal.module.css';

export default function AccountStatusModal({ isOpen, message, onClose }) {
    if (!isOpen) return null;
    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrap}>
                    <Ban size={44} />
                </div>
                <h2>Account Permanently Banned</h2>
                <p className={styles.message}>
                    {message || 'Your account has been permanently banned due to a violation of our terms.'}
                </p>
                <button className={styles.closeBtn} onClick={onClose}>
                    I Understand
                </button>
            </div>
        </div>
    );
}
