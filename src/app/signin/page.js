'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import AccountStatusModal from '@/components/ui/AccountStatusModal';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';

export default function SignIn() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [bannedModal, setBannedModal] = useState({ open: false, message: '' });
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
            if (result.banned) {
                setBannedModal({ open: true, message: result.message });
                return;
            }
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


    return (
        <div className={styles.authContainer}>
            <AccountStatusModal
                isOpen={bannedModal.open}
                message={bannedModal.message}
                onClose={() => setBannedModal({ open: false, message: '' })}
            />
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
                            <div className={styles.passwordWrap}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${styles.input} ${styles.passwordInput}`}
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword(v => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
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
