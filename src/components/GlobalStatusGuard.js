'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Clock, ShieldAlert } from 'lucide-react';
import styles from './GlobalStatusGuard.module.css';

export default function GlobalStatusGuard() {
    const { user } = useAuth();
    const [showSuspendedModal, setShowSuspendedModal] = useState(false);

    useEffect(() => {
        if (user?.accountStatus?.status === 'suspended') {
            const key = `suspend_shown_${user.user_id}`;
            if (!sessionStorage.getItem(key)) {
                setShowSuspendedModal(true);
                sessionStorage.setItem(key, '1');
            }
        }
    }, [user?.user_id, user?.accountStatus?.status]);

    if (!user?.accountStatus) return null;

    const { status, daysRemaining, expiresAt, reason } = user.accountStatus;

    return (
        <>
            {status === 'probation' && (
                <div className={styles.probationBanner}>
                    <ShieldAlert size={16} className={styles.bannerIcon} />
                    <span>
                        <strong>Probation Status:</strong> Your account is under probation.
                        Continued violations may result in suspension.
                    </span>
                </div>
            )}

            {showSuspendedModal && status === 'suspended' && (
                <div className={styles.overlay}>
                    <div className={styles.suspendModal}>
                        <div className={styles.suspendIcon}>
                            <Clock size={40} />
                        </div>
                        <h2>Account Suspended</h2>
                        <p className={styles.subText}>Your account is currently suspended.</p>

                        {daysRemaining != null && (
                            <div className={styles.countdown}>
                                <span className={styles.countdownDays}>{daysRemaining}</span>
                                <span className={styles.countdownLabel}>
                                    day{daysRemaining !== 1 ? 's' : ''} remaining
                                </span>
                                {expiresAt && (
                                    <span className={styles.countdownDate}>
                                        Until {new Date(expiresAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        )}

                        <p className={styles.limitedText}>
                            Your interaction with the app is currently limited.
                        </p>

                        {reason && (
                            <p className={styles.reasonText}>Reason: {reason}</p>
                        )}

                        <button
                            className={styles.dismissBtn}
                            onClick={() => setShowSuspendedModal(false)}
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
