'use client';

import { useState } from 'react';
import { Ban, AlertTriangle, X } from 'lucide-react';
import styles from './CancellationModal.module.css';

export default function CancellationModal({
    isOpen,
    onClose,
    onConfirm,
    orderDetails,
    cancellationLimit
}) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const isAtLimit = cancellationLimit && !cancellationLimit.canCancel;
    const remainingCancellations = cancellationLimit?.remainingCancellations || 0;

    const handleSubmit = async () => {
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

    return (
        <>
            <div className={styles.overlay} onClick={handleClose} />
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={handleClose} disabled={isSubmitting}>
                    <X size={20} />
                </button>

                <div className={styles.modalHeader}>
                    <div className={`${styles.iconWrapper} ${isAtLimit ? styles.danger : styles.warning}`}>
                        {isAtLimit ? <AlertTriangle size={32} /> : <Ban size={32} />}
                    </div>
                    <h2>Cancel Order</h2>
                    <p className={styles.subtitle}>
                        {orderDetails?.name || 'Order Cancellation'}
                    </p>
                </div>

                <div className={styles.modalBody}>
                    {/* Cancellation Limit Info */}
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
                                    width: `${((cancellationLimit?.cancellationsThisWeek || 0) / 3) * 100}%`
                                }}
                            />
                        </div>
                        <div className={styles.limitMessage}>
                            {isAtLimit ? (
                                <>
                                    <AlertTriangle size={16} />
                                    <span>
                                        <strong>Warning:</strong> You have used all 3 cancellations this week.
                                        Proceeding will result in a <strong>STRIKE</strong> on your account.
                                    </span>
                                </>
                            ) : (
                                <span>
                                    Remaining cancellations: <strong>{remainingCancellations}</strong>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Reason Input */}
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
                            rows={4}
                            disabled={isSubmitting}
                            maxLength={500}
                        />
                        <div className={styles.charCount}>
                            {reason.length} / 500 characters
                        </div>
                    </div>

                    {/* Consequences Info */}
                    <div className={styles.infoBox}>
                        <h4>What happens when you cancel:</h4>
                        <ul>
                            <li>Your order will be immediately cancelled</li>
                            <li>The payment window will be cleared (no payment violation)</li>
                            <li>This counts as 1 cancellation toward your weekly limit</li>
                            {isAtLimit && (
                                <li className={styles.strikeWarning}>
                                    <AlertTriangle size={14} />
                                    <strong>A strike will be issued to your account</strong>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <button
                        className={styles.cancelButton}
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Keep Order
                    </button>
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
                </div>
            </div>
        </>
    );
}
