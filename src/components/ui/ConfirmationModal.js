'use client';

import { X, AlertTriangle, CheckCircle2, Info, AlertOctagon } from 'lucide-react';
import styles from './ConfirmationModal.module.css';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    type = 'info', // 'danger' | 'success' | 'warning' | 'info'
    showCancel = true,
    extraContent = null
}) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <AlertOctagon className={styles.iconDanger} size={40} />;
            case 'success': return <CheckCircle2 className={styles.iconSuccess} size={40} />;
            case 'warning': return <AlertTriangle className={styles.iconWarning} size={40} />;
            default: return <Info className={styles.iconInfo} size={40} />;
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className={styles.content}>
                    <div className={styles.iconWrapper}>
                        {getIcon()}
                    </div>
                    <h2>{title}</h2>
                    <div className={styles.message}>
                        {typeof message === 'string' ? <p>{message}</p> : message}
                    </div>
                </div>

                {extraContent && (
                    <div className={styles.extraContent}>
                        {extraContent}
                    </div>
                )}

                <div className={styles.footer}>
                    {showCancel && (
                        <button className={styles.cancelBtn} onClick={onClose}>
                            {cancelText}
                        </button>
                    )}
                    <button 
                        className={`${styles.confirmBtn} ${styles[type]}`} 
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
