'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { getPasswordValidation } from '@/lib/passwordPolicy';
import styles from './PasswordChecklist.module.css';

export default function PasswordChecklist({ password, className = '' }) {
    const { checks } = getPasswordValidation(password);

    return (
        <div className={`${styles.card} ${className}`.trim()}>
            <p className={styles.title}>Password requirements</p>
            <ul className={styles.list}>
                {checks.map((check) => (
                    <li
                        key={check.id}
                        className={`${styles.item} ${check.passed ? styles.itemPassed : styles.itemPending}`}
                    >
                        {check.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <span>{check.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
