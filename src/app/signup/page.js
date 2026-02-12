'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import styles from './page.module.css';

export default function SignUp() {
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState('buyer');
    const router = useRouter();
    const { login } = useAuth();

    const handleSignUp = (e) => {
        e.preventDefault();
        console.log('Signing up as', selectedRole);
        login({ name: 'New User', email: 'newuser@example.com', role: selectedRole });

        if (selectedRole === 'seller') {
            router.push('/seller');
        } else {
            router.push('/');
        }
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
                        <Input type="email" placeholder="Email address" />
                        <div style={{ marginTop: '1rem' }}>
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                icon={EyeIcon}
                            />
                        </div>
                        <div style={{ marginTop: '1rem' }}>
                            <Input type="password" placeholder="Confirm password" />
                        </div>

                        <div className={styles.formFooter}>
                            <Button type="submit" variant="primary" fullWidth>
                                Create account
                            </Button>
                        </div>

                        <div className={styles.otherOptions}>
                            <p className={styles.dividerText}>or continue with</p>
                            <div className={styles.socialButtons}>
                                <button type="button" className={styles.socialBtn}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                </button>
                                <button type="button" className={styles.socialBtn}>
                                    <svg width="24" height="24" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </button>
                                <button type="button" className={styles.socialBtn}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                    </svg>
                                </button>
                            </div>
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
