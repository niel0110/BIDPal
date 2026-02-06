'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import styles from './page.module.css';

export default function SignIn() {
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState('buyer'); // 'buyer' or 'seller'
    const { login } = useAuth();
    const router = useRouter();

    const handleSignIn = (e) => {
        e.preventDefault();
        // Mock successful login logic here
        console.log("Signing in as", selectedRole);
        login({ name: 'Bidder User', email: 'user@example.com', role: selectedRole });

        if (selectedRole === 'seller') {
            router.push('/seller');
        } else {
            router.push('/');
        }
    };

    const EyeIcon = (
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
    );

    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <div className={styles.logoWrapper}>
                    <Logo />
                </div>
            </div>

            <div className={styles.rightPanel}>
                <div className={styles.formWrapper}>
                    <div className={styles.titleWrapper}>
                        <h1 className={styles.title}>
                            Sign <span className={styles.highlight}>In</span>
                        </h1>
                    </div>

                    <div className={styles.roleSelection}>
                        <div
                            className={`${styles.roleCard} ${selectedRole === 'buyer' ? styles.activeRole : ''}`}
                            onClick={() => setSelectedRole('buyer')}
                        >
                            <div className={styles.roleIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                            </div>
                            <div className={styles.roleMeta}>
                                <strong>Buyer</strong>
                                <span>Bid on items</span>
                            </div>
                        </div>

                        <div
                            className={`${styles.roleCard} ${selectedRole === 'seller' ? styles.activeRole : ''}`}
                            onClick={() => setSelectedRole('seller')}
                        >
                            <div className={styles.roleIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><path d="m3 9 2.45-4.91A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.09L21 9" /><path d="M12 3v6" />
                                </svg>
                            </div>
                            <div className={styles.roleMeta}>
                                <strong>Seller</strong>
                                <span>Sell items</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSignIn}>
                        <div className={styles.formGroup}>
                            <Input
                                type="email"
                                placeholder="Email address"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                icon={EyeIcon}
                                onIconClick={() => setShowPassword(!showPassword)}
                            />
                            <Link href="#" className={styles.forgotPassword}>
                                Forgot password?
                            </Link>
                        </div>

                        <div className={styles.buttonWrapper}>
                            <Button type="submit" variant="primary">Sign In</Button>
                        </div>

                        <div className={styles.otherOptions}>
                            <p className={styles.dividerText}>Other sign in options</p>
                            <div className={styles.socialButtons}>
                                <button type="button" className={styles.socialBtn}>
                                    <span style={{ color: '#1877F2', fontWeight: 'bold' }}>f</span>
                                </button>
                                <button type="button" className={styles.socialBtn}>
                                    <span style={{ color: '#DB4437', fontWeight: 'bold' }}>G</span>
                                </button>
                                <button type="button" className={styles.socialBtn}>
                                    <span style={{ color: 'black' }}></span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
