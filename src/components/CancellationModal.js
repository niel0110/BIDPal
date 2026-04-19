'use client';

import { useState } from 'react';
import { Ban, AlertTriangle, X, ShieldAlert, ShieldX, ShieldCheck, Shield } from 'lucide-react';
import styles from './CancellationModal.module.css';

const ACCOUNT_STATUS_CONFIG = {
    clean:      { label: 'Good Standing',  color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', Icon: ShieldCheck },
    warned:     { label: 'Strike 1 — Warned',      color: '#b45309', bg: '#fffbeb', border: '#fde68a', Icon: Shield },
    restricted: { label: 'Strike 2 — Restricted',  color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', Icon: ShieldAlert },
    suspended:  { label: 'Strike 3 — Suspended',   color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: ShieldX },
};

export default function CancellationModal({
    isOpen,
    onClose,
    onConfirm,
    orderDetails,
    cancellationLimit,
    violationRecord
}) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const accountStatus = violationRecord?.account_status || 'clean';
    const strikeCount   = violationRecord?.strike_count   || 0;
    const isSuspended   = accountStatus === 'suspended';
    const isAtLimit     = cancellationLimit && !cancellationLimit.canCancel;
    const statusCfg     = ACCOUNT_STATUS_CONFIG[accountStatus] || ACCOUNT_STATUS_CONFIG.clean;
    const StatusIcon    = statusCfg.Icon;

    // What happens on this cancellation
    const nextStrikeNum = strikeCount + 1;
    const willTriggerStrike = isAtLimit; // 4th+ this week

    const getConsequenceMessage = () => {
        if (isSuspended) return null;
        if (!willTriggerStrike) return null;
        if (nextStrikeNum === 1) return 'This will issue Strike 1 on your account. You will receive a warning.';
        if (nextStrikeNum === 2) return 'This will issue Strike 2. Your account will be restricted — pre-authorization required before bidding.';
        return `This will issue Strike ${nextStrikeNum}. Your account may be suspended and reviewed by moderation.`;
    };

    const handleSubmit = async () => {
        if (isSuspended) return;
        if (!reason.trim()) {
            alert('Please provide a reason for cancellation');
            return;
        }
        setIsSubmitting(true);
        await onConfirm(reason);
        setIsSubmitting(false);
        setReason('');
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setReason('');
            onClose();
        }
    };

    const consequenceMsg = getConsequenceMessage();

    return (
        <>
            <div className={styles.overlay} onClick={handleClose} />
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={handleClose} disabled={isSubmitting}>
                    <X size={20} />
                </button>

                {/* Header */}
                <div className={`${styles.modalHeader} ${isSuspended ? styles.headerSuspended : isAtLimit ? styles.headerDanger : ''}`}>
                    <div className={`${styles.iconWrapper} ${isSuspended ? styles.suspended : isAtLimit ? styles.danger : styles.warning}`}>
                        {isSuspended ? <ShieldX size={32} /> : isAtLimit ? <AlertTriangle size={32} /> : <Ban size={32} />}
                    </div>
                    <h2>{isSuspended ? 'Account Suspended' : 'Cancel Order'}</h2>
                    <p className={styles.subtitle}>
                        {isSuspended
                            ? 'Your account is under moderation review'
                            : orderDetails?.name || 'Order Cancellation'}
                    </p>
                </div>

                <div className={styles.modalBody}>

                    {/* Account Status Row */}
                    <div className={styles.statusRow} style={{ background: statusCfg.bg, borderColor: statusCfg.border }}>
                        <div className={styles.statusLeft}>
                            <StatusIcon size={16} color={statusCfg.color} />
                            <span className={styles.statusLabel} style={{ color: statusCfg.color }}>
                                {statusCfg.label}
                            </span>
                        </div>
                        <div className={styles.strikeDots}>
                            {[1, 2, 3].map(n => (
                                <div
                                    key={n}
                                    className={styles.strikeDot}
                                    style={{
                                        background: n <= strikeCount ? '#dc2626' : '#e5e7eb',
                                        boxShadow: n <= strikeCount ? '0 0 0 2px #fecaca' : 'none'
                                    }}
                                />
                            ))}
                            <span className={styles.strikeText} style={{ color: strikeCount > 0 ? '#dc2626' : '#9ca3af' }}>
                                {strikeCount}/3 strikes
                            </span>
                        </div>
                    </div>

                    {/* Suspended block */}
                    {isSuspended && (
                        <div className={styles.suspendedBox}>
                            <ShieldX size={20} color="#b91c1c" />
                            <div>
                                <p className={styles.suspendedTitle}>You cannot cancel orders while suspended</p>
                                <p className={styles.suspendedSub}>
                                    Your account is currently under review by our moderation team. You may submit an appeal if you believe this is a mistake.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Cancellation counter (only when not suspended) */}
                    {!isSuspended && (
                        <div className={`${styles.limitInfo} ${isAtLimit ? styles.limitDanger : styles.limitWarning}`}>
                            <div className={styles.limitHeader}>
                                <span className={styles.limitLabel}>Cancellations This Week</span>
                                <span className={styles.limitCount}>
                                    {cancellationLimit?.cancellationsThisWeek || 0} / 3
                                </span>
                            </div>
                            <div className={styles.limitBar}>
                                <div
                                    className={styles.limitProgress}
                                    style={{
                                        width: `${Math.min(((cancellationLimit?.cancellationsThisWeek || 0) / 3) * 100, 100)}%`
                                    }}
                                />
                            </div>
                            <div className={styles.limitMessage}>
                                {isAtLimit ? (
                                    <>
                                        <AlertTriangle size={14} />
                                        <span>
                                            You have used all 3 cancellations this week.
                                            Proceeding will result in a <strong>STRIKE</strong> on your account.
                                        </span>
                                    </>
                                ) : (
                                    <span>
                                        {cancellationLimit?.remainingCancellations ?? 3} cancellation(s) remaining this week
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Consequence banner */}
                    {consequenceMsg && (
                        <div className={styles.consequenceBanner}>
                            <AlertTriangle size={15} color="#92400e" />
                            <span>{consequenceMsg}</span>
                        </div>
                    )}

                    {/* Reason input */}
                    {!isSuspended && (
                        <>
                            <div className={styles.inputSection}>
                                <label htmlFor="cancellation-reason">
                                    Reason for Cancellation <span className={styles.required}>*</span>
                                </label>
                                <textarea
                                    id="cancellation-reason"
                                    className={styles.textarea}
                                    placeholder="Please tell us why you're cancelling this order..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    disabled={isSubmitting}
                                    maxLength={500}
                                />
                                <div className={styles.charCount}>{reason.length} / 500</div>
                            </div>

                            <div className={styles.infoBox}>
                                <h4>What happens when you cancel:</h4>
                                <ul>
                                    <li>Your order will be immediately cancelled</li>
                                    <li>This counts as 1 cancellation toward your weekly limit (3/week)</li>
                                    {willTriggerStrike && (
                                        <li className={styles.strikeWarning}>
                                            <AlertTriangle size={13} />
                                            <strong>A strike will be issued to your account</strong>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button className={styles.cancelButton} onClick={handleClose} disabled={isSubmitting}>
                        {isSuspended ? 'Close' : 'Keep Order'}
                    </button>
                    {!isSuspended && (
                        <button
                            className={`${styles.confirmButton} ${isAtLimit ? styles.dangerButton : ''}`}
                            onClick={handleSubmit}
                            disabled={isSubmitting || !reason.trim()}
                        >
                            {isSubmitting ? (
                                <span className={styles.loadingText}>
                                    <span className={styles.spinner} />
                                    Cancelling...
                                </span>
                            ) : isAtLimit ? (
                                'Cancel Anyway (Get Strike)'
                            ) : (
                                'Confirm Cancellation'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
