'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useRef } from 'react';

export default function GoogleSignInButton({ onSuccess, onError, text = 'signin_with' }) {
    const { loginWithGoogle } = useAuth();
    const buttonRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.google) return;

        // Render Google Sign-In button
        window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            callback: async (response) => {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
                    const res = await fetch(`${apiUrl}/api/auth/google-login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credential: response.credential })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Google login failed');

                    if (onSuccess) {
                        onSuccess(data);
                    }
                } catch (err) {
                    console.error('Google Sign-In error:', err);
                    if (onError) {
                        onError(err);
                    }
                }
            }
        });

        if (buttonRef.current) {
            window.google.accounts.id.renderButton(
                buttonRef.current,
                {
                    theme: 'outline',
                    size: 'large',
                    text: text,
                    width: buttonRef.current.offsetWidth || 300
                }
            );
        }
    }, [onSuccess, onError, text]);

    return <div ref={buttonRef} style={{ width: '100%' }}></div>;
}
