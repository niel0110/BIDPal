'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import TermsModal from '@/components/TermsModal/TermsModal';
import AuthLogo from '@/components/AuthLogo';
import { useAuth } from '@/context/AuthContext';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';

export default function SignUp() {
    const router = useRouter();
    const { register } = useAuth();
    const { isSubmitting, runWithLock } = useSubmitLock();

    const [selectedRole, setSelectedRole] = useState('Buyer');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [verificationStep, setVerificationStep] = useState('details');
    const [verificationCode, setVerificationCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [referralCode] = useState(() => {
        if (typeof window === 'undefined') return '';

        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) {
            const normalizedRef = ref.trim().toUpperCase();
            localStorage.setItem('bidpal_referral_code', normalizedRef);
            return normalizedRef;
        }

        return localStorage.getItem('bidpal_referral_code') || '';
    });

    const readApiResponse = async (res, fallbackMessage) => {
        const contentType = res.headers.get('content-type') || '';
        let data = {};

        if (contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            data = { error: text || fallbackMessage };
        }

        if (!res.ok) {
            const err = new Error(data.error || fallbackMessage);
            err.code = data.code;
            throw err;
        }

        return data;
    };

    const sendVerificationCode = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        try {
            const res = await fetch(`${apiUrl}/api/auth/send-verification-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose: 'register' }),
            });
            return await readApiResponse(res, 'Unable to send verification code.');
        } catch (err) {
            if (err instanceof TypeError) {
                throw new Error('Cannot reach the BIDPal backend. Make sure the backend server is running on port 5000, then try again.');
            }
            throw err;
        }
    };

    const verifyCode = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/auth/verify-email-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: verificationCode, purpose: 'register' }),
        });
        const data = await readApiResponse(res, 'Unable to verify code.');
        return data.token;
    };

    const handleResendCode = async () => {
        setError('');
        setMessage('');
        setVerificationCode('');
        try {
            await sendVerificationCode();
            setMessage('A new verification code was sent to your email. Use the latest code only.');
        } catch (err) {
            setError(err.message || 'Unable to resend verification code.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            setError('');
            setMessage('');

            if (!email || !password || !confirm) {
                setError('All fields are required.');
                return;
            }
            if (password !== confirm) {
                setError('Passwords do not match.');
                return;
            }
            if (!agreed) {
                setError('Please agree to the Terms & Conditions before continuing.');
                setShowTerms(true);
                return;
            }

            try {
                if (verificationStep === 'details') {
                    await sendVerificationCode();
                    setVerificationStep('code');
                    setMessage('We sent a 6-digit verification code to your email.');
                    return;
                }

                if (!verificationCode) {
                    setError('Please enter the verification code sent to your email.');
                    return;
                }

                const emailVerificationToken = await verifyCode();
                const role = selectedRole.toLowerCase();
                const result = await register({ email, password, role, emailVerificationToken, referralCode });
                if (!result.success) {
                    setError(result.error);
                    return;
                }

                localStorage.removeItem('bidpal_referral_code');
                router.push(role === 'seller' ? '/seller/setup' : '/buyer/setup');
            } catch (err) {
                if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'INVALID_CODE'].includes(err.code)) {
                    setVerificationCode('');
                    setError(`${err.message} You can send a new code below.`);
                    return;
                }

                setError(err.message || 'Something went wrong. Please try again.');
            }
        });
    };

    return (
        <>
            {showTerms && (
                <TermsModal
                    key={selectedRole}
                    role={selectedRole}
                    onClose={() => setShowTerms(false)}
                    onAgree={() => {
                        setAgreed(true);
                        setShowTerms(false);
                        setError('');
                    }}
                />
            )}

            <div className={styles.authContainer}>
                <div className={styles.authLeft}>
                    <div className={styles.authLogo}><AuthLogo /></div>
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
                            Create <span className={styles.redText}>account</span>
                        </h1>

                        <div className={styles.roleGrid}>
                            {['Buyer', 'Seller'].map((role) => (
                                <div
                                    key={role}
                                    className={`${styles.roleOption} ${selectedRole === role ? styles.roleActive : ''}`}
                                    onClick={() => {
                                        setSelectedRole(role);
                                        setAgreed(false);
                                    }}
                                >
                                    <div className={styles.roleLabel}>{role}</div>
                                    <div className={styles.roleSub}>{role === 'Buyer' ? 'I want to bid' : 'I want to sell'}</div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} className={styles.mainForm} noValidate>
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setVerificationStep('details');
                                    setVerificationCode('');
                                }}
                                className={styles.input}
                            />
                            <div className={`${styles.inputGroup} ${styles.passwordWrap}`}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${styles.input} ${styles.passwordInput}`}
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword((value) => !value)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                            <div className={`${styles.inputGroup} ${styles.passwordWrap}`}>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="Confirm password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    className={`${styles.input} ${styles.passwordInput}`}
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowConfirm((value) => !value)}
                                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                                >
                                    {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                            {verificationStep === 'code' && (
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="Verification code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className={`${styles.input} ${styles.inputGroup}`}
                                />
                            )}
                            {verificationStep === 'code' && (
                                <button
                                    type="button"
                                    className={styles.resendCodeBtn}
                                    disabled={isSubmitting}
                                    onClick={() => runWithLock(handleResendCode)}
                                >
                                    Send new code
                                </button>
                            )}

                            <button
                                type="submit"
                                disabled={!agreed || isSubmitting}
                                className={`${styles.submitBtn} ${agreed && !isSubmitting ? styles.submitBtnOn : ''}`}
                            >
                                {isSubmitting
                                    ? (verificationStep === 'details' ? 'Sending code...' : 'Creating account...')
                                    : (verificationStep === 'details' ? 'Send verification code' : 'Verify and create account')}
                            </button>

                            <div className={styles.termsRow}>
                                <button
                                    type="button"
                                    className={`${styles.termsCircle} ${agreed ? styles.termsCircleOn : ''}`}
                                    onClick={() => setShowTerms(true)}
                                    aria-label={agreed ? 'Terms accepted' : 'Open terms and conditions'}
                                    aria-pressed={agreed}
                                >
                                    {agreed && (
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </button>
                                <span className={styles.termsText}>
                                    I agree to the{' '}
                                    <button
                                        type="button"
                                        className={styles.termsLink}
                                        onClick={() => setShowTerms(true)}
                                    >
                                        Terms &amp; Conditions
                                    </button>
                                </span>
                            </div>

                            {error && <p className={styles.errorMsg}>{error}</p>}
                            {message && (
                                <p style={{ color: '#166534', fontSize: '0.82rem', margin: '0.5rem 0 0', padding: 0 }}>
                                    {message}
                                </p>
                            )}

                            <button
                                type="button"
                                className={styles.toggleAuth}
                                onClick={() => router.push('/signin')}
                            >
                                Already have an account?{' '}
                                <span className={styles.toggleLink}>Sign In</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
