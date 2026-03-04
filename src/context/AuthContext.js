'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

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
    }, []);


    // Login with backend
    const login = async ({ email, password }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            console.log('Login: Sending to', `${apiUrl}/api/auth/login`, { email, password });
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            console.log('Login: Response status', res.status);
            const data = await res.json();
            console.log('Login: Response data', data);
            if (!res.ok) throw new Error(data.error || 'Login failed');
            setUser(data.user);
            localStorage.setItem('bidpal_user', JSON.stringify(data.user));
            localStorage.setItem('bidpal_token', data.token);
            return { success: true };
        } catch (err) {
            console.error('Login: Error', err.message);
            return { success: false, error: err.message };
        }
    };

    // Register with backend
    const register = async ({ email, password, role }) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            console.log('Register: Sending to', `${apiUrl}/api/auth/register`, { email, password, role });
            const res = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
            });
            console.log('Register: Response status', res.status);
            const data = await res.json();
            console.log('Register: Response data', data);
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            setUser(data.user);
            localStorage.setItem('bidpal_user', JSON.stringify(data.user));
            localStorage.setItem('bidpal_token', data.token);
            return { success: true };
        } catch (err) {
            console.error('Register: Error', err.message);
            return { success: false, error: err.message };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('bidpal_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
