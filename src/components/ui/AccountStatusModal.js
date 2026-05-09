'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ban, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import styles from './AccountStatusModal.module.css';

const TERMS = [
    { title: '1. Account Eligibility', body: 'BIDPal accounts are for personal, non-commercial use. You must be at least 18 years old and provide accurate registration information.' },
    { title: '2. Prohibited Conduct', body: 'Users may not engage in fraudulent bidding, shill bidding, harassment of other users, listing counterfeit or prohibited items, or any activity that disrupts the integrity of the platform.' },
    { title: '3. Strike System', body: 'Violations are tracked via a strike system. Accumulating strikes may result in warnings, temporary suspension, or permanent removal from the platform at BIDPal\'s discretion.' },
    { title: '4. Account Suspension & Banning', body: 'BIDPal reserves the right to suspend or permanently ban accounts found to be in violation of these terms. Banned accounts forfeit access to the platform and any active bids or listings.' },
    { title: '5. Disputes', body: 'If you believe your account was banned in error, contact BIDPal support with relevant evidence. Decisions are reviewed on a case-by-case basis but are final.' },
    { title: '6. Changes to Terms', body: 'BIDPal may update these terms at any time. Continued use of the platform constitutes acceptance of the revised terms.' },
];

export default function AccountStatusModal({ isOpen, message, onClose, email, status = 'banned' }) {
    const [termsOpen, setTermsOpen] = useState(false);

    if (!isOpen) return null;
    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrap}>
                    <Ban size={44} />
                </div>
                <h2>{status === 'suspended' ? 'Account Suspended' : 'Account Permanently Banned'}</h2>
                <p className={styles.message}>
                    {message || 'Your account has been permanently banned due to a violation of our terms.'}
                </p>

                {/* Terms & Conditions accordion */}
                <div className={styles.termsSection}>
                    <button className={styles.termsToggle} onClick={() => setTermsOpen(v => !v)}>
                        <span>View Terms &amp; Conditions</span>
                        {termsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {termsOpen && (
                        <div className={styles.termsList}>
                            {TERMS.map(t => (
                                <div key={t.title} className={styles.termItem}>
                                    <p className={styles.termTitle}>{t.title}</p>
                                    <p className={styles.termBody}>{t.body}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {status !== 'suspended' && (
                    <Link
                        href={`/reactivation${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                        className={styles.reactivateBtn}
                        onClick={onClose}
                    >
                        <RotateCcw size={15} />
                        Request Account Reactivation
                    </Link>
                )}
                <button className={styles.closeBtn} onClick={onClose}>
                    I Understand
                </button>
            </div>
        </div>
    );
}
