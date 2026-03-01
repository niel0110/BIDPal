'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';

export default function ForgotPassword() {
    const { isSubmitting, runWithLock } = useSubmitLock();

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            console.log('Send password reset code');
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.leftPanel}>
                    <div className={styles.logoWrapper}>
                        <AuthLogo />
                    </div>
                </div>

                <div className={styles.rightPanel}>
                    <div className={styles.formWrapper}>
                        <h1 className={styles.title}>Forgot password?</h1>
                        <p className={styles.subtitle}>
                            Don&apos;t worry! It happens. Please enter the email associated with your account.
                        </p>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <Input type="email" placeholder="Email address" />
                            </div>
                            <Button type="submit" variant="primary" disabled={isSubmitting}>
                                {isSubmitting ? 'Sending...' : 'Send Code'}
                            </Button>
                        </form>

                        <p className={styles.footerText}>
                            Remember password? <Link href="/signin" className={styles.footerLink}>Log in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
