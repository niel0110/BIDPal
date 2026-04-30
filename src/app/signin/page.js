'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';

export default function SignIn() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { isSubmitting, runWithLock } = useSubmitLock();
    const { login, loginWithGoogle } = useAuth();
    const router = useRouter();

    const handleSignIn = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            setError('');
            if (!email || !password) {
                setError('Email and password are required.');
                return;
            }
            const result = await login({ email, password });
            if (!result.success) {
                setError(result.error);
                return;
            }
            if (result.user?.role?.toLowerCase() === 'seller') {
                router.push('/seller');
            } else {
                router.push('/');
            }
        });
    };

    const handleGoogleSignIn = async () => {
        await runWithLock(async () => {
            setError('');
            const result = await loginWithGoogle();
            if (!result.success) {
                setError(result.error);
                return;
            }
            if (result.user?.role?.toLowerCase() === 'seller') {
                router.push('/seller');
            } else {
                router.push('/');
            }
        });
    };


    const EyeIcon = (
        <div onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showPassword ? (
                    <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </>
                ) : (
                    <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                )}
            </svg>
        </div>
    );

    return (
        <div className={styles.authContainer}>
            <div className={styles.authLeft}>
                <div className={styles.authLogo}>
                    <AuthLogo />
                </div>
            </div>
            <div className={styles.authRight}>
                <div className={styles.authFormWrapper}>
                    <div className={styles.mobileLogo}>
                        <img src="/BIDPaL Logo.png" alt="BIDPal" className={styles.mobileLogoImg} />
                        <span className={styles.mobileLogoText}>
                            <span style={{ color: '#d02440' }}>B</span>
                            <span style={{ color: '#542769' }}>I</span>
                            <span style={{ color: '#fba91d' }}>D</span>
                            <span style={{ color: '#ef4f25' }}>P</span>
                            <span style={{ color: '#d02440' }}>a</span>
                            <span style={{ color: '#542769' }}>l</span>
                        </span>
                    </div>
                    <h1 className={styles.authTitle}>
                        Sign <span className={styles.redText}>In</span>
                    </h1>

                    <form onSubmit={handleSignIn} className={styles.mainForm}>
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                        />
                        <div className={styles.inputGroup}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                            />
                            <Link href="/forgot-password" className={styles.forgotPassword}>
                                Forgot password?
                            </Link>
                        </div>
                        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}

                        <div className={styles.formFooter}>
                            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
                                {isSubmitting ? 'Signing In...' : 'Sign In'}
                            </Button>
                        </div>

                        <button
                            type="button"
                            className={styles.toggleAuth}
                            onClick={() => router.push('/signup')}
                        >
                            Don&apos;t have an account? <span className={styles.toggleLink}>Sign Up</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
