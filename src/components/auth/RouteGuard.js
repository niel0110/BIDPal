'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * RouteGuard component to protect pages that require authentication.
 * If the user is not authenticated, they are redirected to the sign-in page.
 */
export default function RouteGuard({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            // Redirect to signin, but save the current path to return later if needed
            // (Note: Next.js handle back button better, but we could add ?redirect=pathname)
            router.replace('/signin');
        }
    }, [user, loading, router, pathname]);

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: '#f8fafc',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <div className="loading-spinner" style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e2e8f0',
                    borderTopColor: '#cc2b41',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style jsx>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Authenticating...</p>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect in useEffect
    }

    return children;
}
