'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';

export default function SignUp() {
    console.log('=== RENDERING SIGNUP PAGE ===');
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState('buyer');
    const router = useRouter();
    const { register, loginWithGoogle } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const { isSubmitting, runWithLock } = useSubmitLock();

    const handleSignUp = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            setError('');

            console.log('SIGNUP FORM SUBMITTED');
            console.log('Email value:', email, 'Type:', typeof email, 'Length:', email?.length);
            console.log('Password value:', password, 'Type:', typeof password, 'Length:', password?.length);
            console.log('ConfirmPassword value:', confirmPassword, 'Type:', typeof confirmPassword, 'Length:', confirmPassword?.length);
            console.log('Which function am I calling?', typeof register);

            if (!email || !password || !confirmPassword) {
                console.log('VALIDATION FAILED: Missing fields');
                console.log('email exists?', !!email);
                console.log('password exists?', !!password);
                console.log('confirmPassword exists?', !!confirmPassword);
                setError('All fields are required.');
                return;
            }

            if (password !== confirmPassword) {
                console.log('VALIDATION FAILED: Passwords do not match');
                setError('Passwords do not match.');
                return;
            }

            console.log('Validation passed, calling register function now...');
            console.log('About to call register with:', { email, password, role: selectedRole });

            try {
                const result = await register({ email, password, role: selectedRole });
                console.log('Register function returned:', result);

                if (!result.success) {
                    console.log('Registration failed:', result.error);
                    setError(result.error);
                    return;
                }

                console.log('Registration successful!');
                if (selectedRole === 'seller') {
                    router.push('/seller/setup');
                } else {
                    router.push('/');
                }
            } catch (err) {
                console.error('ERROR during register:', err);
                setError(err.message);
            }
        });
    };

    const handleGoogleSignUp = async () => {
        await runWithLock(async () => {
            setError('');
            const result = await loginWithGoogle(selectedRole);
            if (!result.success) {
                setError(result.error);
                return;
            }
            if (selectedRole === 'seller') {
                router.push('/seller/setup');
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
                    <h1 className={styles.authTitle}>
                        Create <span className={styles.redText}>account</span>
                    </h1>

                    <div className={styles.roleGrid}>
                        <div
                            className={`${styles.roleOption} ${selectedRole === 'buyer' ? styles.roleActive : ''}`}
                            onClick={() => setSelectedRole('buyer')}
                        >
                            <div className={styles.roleLabel}>Buyer</div>
                            <div className={styles.roleSub}>I want to bid</div>
                        </div>
                        <div
                            className={`${styles.roleOption} ${selectedRole === 'seller' ? styles.roleActive : ''}`}
                            onClick={() => setSelectedRole('seller')}
                        >
                            <div className={styles.roleLabel}>Seller</div>
                            <div className={styles.roleSub}>I want to sell</div>
                        </div>
                    </div>

                    <form onSubmit={handleSignUp} className={styles.mainForm}>
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                        />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`${styles.input} ${styles.inputGroup}`}
                        />
                        <input
                            type="password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`${styles.input} ${styles.inputGroup}`}
                        />
                        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}

                        <div className={styles.formFooter}>
                            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
                                {isSubmitting ? 'Creating account...' : 'Create account'}
                            </Button>
                        </div>

                        <button
                            type="button"
                            className={styles.toggleAuth}
                            onClick={() => router.push('/signin')}
                        >
                            Already have an account? <span className={styles.toggleLink}>Sign In</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
