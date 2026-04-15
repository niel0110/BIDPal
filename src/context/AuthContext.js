'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check storage on mount to persist login across refreshes
    useEffect(() => {
        const storedUser = localStorage.getItem('bidpal_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user data", e);
            }
        }
        setLoading(false);
    }, []);

    // Login with backend
    const login = async ({ email, password }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            const normalizedUser = { ...data.user, role: data.user?.role?.toLowerCase() };
            setUser(normalizedUser);
            localStorage.setItem('bidpal_user', JSON.stringify(normalizedUser));
            localStorage.setItem('bidpal_token', data.token);
            return { success: true, user: normalizedUser };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // Register with backend
    const register = async ({ email, password, role }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
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

    const logout = () => {
        setUser(null);
        localStorage.removeItem('bidpal_user');
        localStorage.removeItem('bidpal_token');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
