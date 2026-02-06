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

    const login = (userData) => {
        // Mock login - stores user object
        const mockUser = userData || { name: 'Bidder One', email: 'user@example.com', role: 'buyer' };
        setUser(mockUser);
        localStorage.setItem('bidpal_user', JSON.stringify(mockUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('bidpal_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
