'use client';

import { useState, useRef } from 'react';
import { BUYER_TERMS, SELLER_TERMS } from './termsContent';
import styles from './TermsModal.module.css';

export default function TermsModal({ role, onAgree, onClose }) {
    const terms = role === 'Seller' ? SELLER_TERMS : BUYER_TERMS;
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const bodyRef = useRef(null);

    const handleScroll = () => {
        const el = bodyRef.current;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
            setScrolledToBottom(true);
        }
    };

    const canAgree = scrolledToBottom && agreed;

    return (
        <div className={styles.page}>
            {/* Top bar */}
            <div className={styles.topBar}>
                <div className={styles.brand}>BID<span>Pal</span></div>
                <span className={styles.stepLabel}>
                    {role === 'Seller' ? '🏪 Seller' : '🛒 Buyer'} Account Setup
                </span>
            </div>

            <div className={styles.wrapper}>
                {/* Page heading */}
                <div className={styles.heading}>
                    <h1 className={styles.title}>Terms &amp; Conditions</h1>
                    <p className={styles.subtitle}>
                        Read the full agreement below before creating your {role.toLowerCase()} account.
                        Scroll to the bottom to unlock the agreement checkbox.
                    </p>
                </div>

                {/* Terms content card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardRole}>
                            {role === 'Seller' ? '🏪 Seller' : '🛒 Buyer'} Account Agreement
                        </span>
                        {!scrolledToBottom && (
                            <span className={styles.scrollHint}>↓ Scroll to read all</span>
                        )}
                        {scrolledToBottom && (
                            <span className={styles.scrollDone}>✓ Fully read</span>
                        )}
                    </div>

                    <div className={styles.body} ref={bodyRef} onScroll={handleScroll}>
                        {terms.map((section, si) => (
                            <div key={section.id} className={styles.section}>
                                <div className={styles.sectionHeading}>
                                    <span className={styles.sectionNum}>{si + 1}</span>
                                    <h3 className={styles.sectionTitle}>
                                        {section.icon} {section.title}
                                    </h3>
                                </div>
                                {section.content.map((item, i) => (
                                    <div key={i} className={styles.clause}>
                                        <h4 className={styles.clauseHead}>{item.heading}</h4>
                                        <p className={styles.clauseBody}>{item.body}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Agreement row */}
                <div className={styles.agreementRow}>
                    <label
                        className={`${styles.checkLabel} ${!scrolledToBottom ? styles.checkLabelDisabled : ''}`}
                        onClick={() => scrolledToBottom && setAgreed(a => !a)}
                    >
                        <div className={`${styles.circle} ${agreed ? styles.circleChecked : ''} ${!scrolledToBottom ? styles.circleDisabled : ''}`}>
                            {agreed && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            )}
                        </div>
                        <span className={styles.checkText}>
                            I have read and understood the Terms &amp; Conditions and agree to be bound by them.
                        </span>
                    </label>

                    {!scrolledToBottom && (
                        <p className={styles.checkHint}>Scroll through all terms above to enable this checkbox.</p>
                    )}
                </div>

                {/* Action buttons */}
                <div className={styles.actions}>
                    <button className={styles.declineBtn} onClick={onClose}>
                        Decline
                    </button>
                    <button
                        className={`${styles.agreeBtn} ${canAgree ? styles.agreeBtnOn : ''}`}
                        disabled={!canAgree}
                        onClick={canAgree ? onAgree : undefined}
                    >
                        I Agree &amp; Continue
                        {canAgree && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
