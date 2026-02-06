'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import styles from './page.module.css';

export default function SignUp() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState('buyer'); // 'buyer' or 'seller'
    const router = useRouter();
    const { login } = useAuth();

    const handleSignUp = (e) => {
        e.preventDefault();
        // Mock successful registration logic here
        console.log("Signing up as", selectedRole);
        login({ name: 'New User', email: 'newuser@example.com', role: selectedRole });

        if (selectedRole === 'seller') {
            router.push('/seller');
        } else {
            router.push('/');
        }
    };

    const EyeIcon = (show, toggle) => (
        <div onClick={toggle} style={{ display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {show ? (
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
                            Create <span className={styles.highlight}>account</span>
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
                                <span>I want to bid on items</span>
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
                                <span>I want to sell items</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSignUp}>
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
                                icon={EyeIcon(showPassword, () => setShowPassword(!showPassword))}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm password"
                                icon={EyeIcon(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
                            />
                        </div>

                        <div className={styles.buttonWrapper}>
                            <Button type="submit" variant="primary">Create account</Button>
                        </div>

                        <div className={styles.disclaimer}>
                            <div className={styles.checkIcon}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-primary)" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p>
                                By creating an account or signing you agree to our <Link href="#" className={styles.link}>Terms and Conditions</Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
