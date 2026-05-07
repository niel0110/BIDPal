'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch fresh user data from Supabase (via backend) and sync to state + localStorage.
    // Non-blocking — callers don't need to await; cached user stays valid until this resolves.
    const refreshUser = useCallback(async (userId, token) => {
        const uid = userId ?? JSON.parse(localStorage.getItem('bidpal_user') || 'null')?.user_id;
        const tok = token ?? localStorage.getItem('bidpal_token');
        if (!uid || !tok) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/users/${uid}`, {
                headers: { Authorization: `Bearer ${tok}` },
            });
            if (!res.ok) return; // expired token or server error — keep cached data
            const fresh = await res.json();
            if (fresh?.error) return;
            setUser(prev => {
                const updated = {
                    ...prev,
                    ...fresh,
                    role: (fresh.role || prev?.role)?.toLowerCase(),
                };
                localStorage.setItem('bidpal_user', JSON.stringify(updated));
                return updated;
            });
        } catch {
            // Network unavailable — silently keep cached user
        }
    }, []);

    // On mount: restore from localStorage immediately (fast), then sync from Supabase in background.
    // This ensures admin-side changes (KYC approval, role updates, etc.) are reflected on next load
    // without forcing the user to re-login.
    useEffect(() => {
        const storedUser = localStorage.getItem('bidpal_user');
        const token = localStorage.getItem('bidpal_token');

        if (storedUser && token) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                // Keep auth loading until fresh verification fields are available.
                refreshUser(parsed.user_id, token).finally(() => setLoading(false));
                return;
            } catch {
                localStorage.removeItem('bidpal_user');
            }
        }
        setLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async ({ email, password }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.error === 'account_banned') {
                    return { success: false, banned: true, message: data.message };
                }
                throw new Error(data.error || 'Login failed');
            }
            const normalizedUser = {
                ...data.user,
                role: data.user?.role?.toLowerCase(),
                accountStatus: data.accountStatus || null,
            };
            setUser(normalizedUser);
            localStorage.setItem('bidpal_user', JSON.stringify(normalizedUser));
            localStorage.setItem('bidpal_token', data.token);
            return { success: true, user: normalizedUser };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const register = async ({ email, password, role, emailVerificationToken, referralCode }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role, emailVerificationToken, referralCode }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            const normalizedUser = { ...data.user, role: data.user?.role?.toLowerCase() };
            setUser(normalizedUser);
            localStorage.setItem('bidpal_user', JSON.stringify(normalizedUser));
            localStorage.setItem('bidpal_token', data.token);
            return { success: true, user: normalizedUser };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const updateUser = (updates) => {
        setUser(prev => {
            const updated = { ...prev, ...updates };
            localStorage.setItem('bidpal_user', JSON.stringify(updated));
            return updated;
        });
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('bidpal_user');
        localStorage.removeItem('bidpal_token');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
