'use client';

import { XCircle } from 'lucide-react';
import { getPasswordValidation } from '@/lib/passwordPolicy';
import styles from './PasswordChecklist.module.css';

export default function PasswordChecklist({ password, className = '' }) {
    if (!password) return null;

    const { checks } = getPasswordValidation(password);
    const missingChecks = checks.filter((check) => !check.passed);

    if (missingChecks.length === 0) return null;

    return (
        <div className={`${styles.errorContainer} ${className}`.trim()}>
            <ul className={styles.list}>
                {missingChecks.map((check) => (
                    <li
                        key={check.id}
                        className={styles.item}
                    >
                        <XCircle size={14} />
                        <span>{check.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

