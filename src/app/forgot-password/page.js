'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordChecklist from '@/components/auth/PasswordChecklist';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { PASSWORD_POLICY_MESSAGE, getPasswordValidation } from '@/lib/passwordPolicy';
import styles from './page.module.css';

export default function ForgotPassword() {
    const { isSubmitting, runWithLock } = useSubmitLock();
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const passwordValidation = getPasswordValidation(password);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const sendCode = async () => {
        const res = await fetch(`${apiUrl}/api/auth/send-verification-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, purpose: 'forgot-password' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to send verification code.');
        return data;
    };

    const verifyCode = async () => {
        const res = await fetch(`${apiUrl}/api/auth/verify-email-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, purpose: 'forgot-password' }),
        });
        const data = await res.json();
        if (!res.ok) {
            const err = new Error(data.error || 'Unable to verify code.');
            err.code = data.code;
            throw err;
        }
        return data.token;
    };

    const resetPassword = async () => {
        const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetToken, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to reset password.');
        return data;
    };

    const handleResendCode = async () => {
        setError('');
        setMessage('');
        setCode('');
        try {
            const data = await sendCode();
            setMessage(data.devCode
                ? `Development code: ${data.devCode}`
                : 'A new verification code was sent. Use the latest code only.');
        } catch (err) {
            setError(err.message || 'Unable to resend verification code.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            setError('');
            setMessage('');

            try {
                if (step === 'email') {
                    if (!email) {
                        setError('Email is required.');
                        return;
                    }
                    const data = await sendCode();
                    setStep('code');
                    setMessage(data.devCode
                        ? `Development code: ${data.devCode}`
                        : 'We sent a 6-digit code to your email.');
                    return;
                }

                if (step === 'code') {
                    if (!code) {
                        setError('Please enter the verification code.');
                        return;
                    }
                    const token = await verifyCode();
                    setResetToken(token);
                    setStep('password');
                    setMessage('Code verified. You can now set a new password.');
                    return;
                }

                if (!password || !confirmPassword) {
                    setError('Please enter and confirm your new password.');
                    return;
                }
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    return;
                }
                if (!passwordValidation.isValid) {
                    setError(PASSWORD_POLICY_MESSAGE);
                    return;
                }
                await resetPassword();
                setStep('done');
                setMessage('Password reset successfully. You can now log in.');
            } catch (err) {
                if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'INVALID_CODE'].includes(err.code)) {
                    setCode('');
                    setError(`${err.message} You can send a new code below.`);
                    return;
                }
                setError(err.message || 'Something went wrong. Please try again.');
            }
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
                            {step === 'done'
                                ? 'Your password has been updated.'
                                : 'Enter the email associated with your account and we will send a reset code.'}
                        </p>

                        {step !== 'done' && (
                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <Input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        disabled={step !== 'email'}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                {step === 'code' && (
                                    <div className={styles.formGroup}>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="Verification code"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        />
                                    </div>
                                )}

                                {step === 'password' && (
                                    <>
                                        <div className={styles.formGroup}>
                                            <Input
                                                type="password"
                                                placeholder="New password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                        </div>
                                        <PasswordChecklist password={password} />
                                        <div className={styles.formGroup}>
                                            <Input
                                                type="password"
                                                placeholder="Confirm new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={isSubmitting || (step === 'password' && !passwordValidation.isValid)}
                                >
                                    {isSubmitting
                                        ? 'Please wait...'
                                        : step === 'email'
                                            ? 'Send Code'
                                            : step === 'code'
                                                ? 'Verify Code'
                                                : 'Reset Password'}
                                </Button>

                                {step === 'code' && (
                                    <button
                                        type="button"
                                        className={styles.textButton}
                                        disabled={isSubmitting}
                                        onClick={() => runWithLock(handleResendCode)}
                                    >
                                        Send new code
                                    </button>
                                )}
                            </form>
                        )}

                        {error && <p className={styles.errorText}>{error}</p>}
                        {message && <p className={styles.successText}>{message}</p>}

                        <p className={styles.footerText}>
                            Remember password? <Link href="/signin" className={styles.footerLink}>Log in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
