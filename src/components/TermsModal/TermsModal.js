'use client';

import { useEffect, useRef, useState } from 'react';
import { BUYER_TERMS, SELLER_TERMS } from './termsContent';
import styles from './TermsModal.module.css';

export default function TermsModal({ role, onAgree, onClose }) {
    const terms = role === 'Seller' ? SELLER_TERMS : BUYER_TERMS;
    const bodyRef = useRef(null);
    const [scrolledToBottom, setScrolledToBottom] = useState(false);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const checkScrollPosition = () => {
            const el = bodyRef.current;
            if (!el) return;

            const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
            const contentFits = el.scrollHeight <= el.clientHeight + 16;
            if (reachedBottom || contentFits) {
                setScrolledToBottom(true);
            }
        };

        checkScrollPosition();
        window.addEventListener('resize', checkScrollPosition);

        return () => {
            window.removeEventListener('resize', checkScrollPosition);
        };
    }, [terms]);

    const handleScroll = () => {
        const el = bodyRef.current;
        if (!el) return;

        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) {
            setScrolledToBottom(true);
        }
    };

    return (
        <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>{role} Account</p>
                        <h2 id="terms-modal-title" className={styles.title}>Terms &amp; Conditions</h2>
                        <p className={styles.subtitle}>
                            Read the full agreement. The accept button stays locked until you reach the bottom.
                        </p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close terms and conditions">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className={styles.statusRow}>
                    <span className={styles.roleBadge}>{role} terms</span>
                    <span className={scrolledToBottom ? styles.statusDone : styles.statusPending}>
                        {scrolledToBottom ? 'Ready to accept' : 'Scroll to the bottom to unlock acceptance'}
                    </span>
                </div>

                <div ref={bodyRef} className={styles.body} onScroll={handleScroll}>
                    {terms.map((section, sectionIndex) => (
                        <section key={section.id} className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>{sectionIndex + 1}</span>
                                <h3 className={styles.sectionTitle}>
                                    {section.icon} {section.title}
                                </h3>
                            </div>
                            {section.content.map((item, itemIndex) => (
                                <div key={itemIndex} className={styles.clause}>
                                    <p className={styles.clauseHeading}>{item.heading}</p>
                                    <p className={styles.clauseBody}>{item.body}</p>
                                </div>
                            ))}
                        </section>
                    ))}
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>
                        Close
                    </button>
                    <button
                        type="button"
                        className={`${styles.primaryButton} ${scrolledToBottom ? styles.primaryButtonEnabled : ''}`}
                        disabled={!scrolledToBottom}
                        onClick={scrolledToBottom ? onAgree : undefined}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
