'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function CartProvider({ children }) {
    const { user } = useAuth();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCart = useCallback(async () => {
        if (!user || !user.user_id) {
            setCartItems([]);
            setLoading(false);
            return;
        }

        // Skip cart fetch for sellers (they don't need a cart)
        if (user.role?.toLowerCase() === 'seller') {
            setCartItems([]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/cart/${user.user_id}`);

            if (!res.ok) {
                // If it's a 404 or validation error, just set empty cart silently
                if (res.status === 404 || res.status === 400) {
                    setCartItems([]);
                    setLoading(false);
                    return;
                }
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch cart');
            }

            const data = await res.json();
            setCartItems(Array.isArray(data) ? data : []);
        } catch (err) {
            // Silently fail - cart is optional, don't break the app
            console.warn('Cart unavailable:', err.message);
            setCartItems([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchCart();
    }, [user, fetchCart]);

    const addToCart = async (product_id) => {
        if (!user) return { success: false, error: 'User not logged in' };
        try {
            const res = await fetch(`${API_URL}/api/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.user_id,
                    products_id: product_id,
                    quantity: 1
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add to cart');
            }
            await fetchCart(); // Refresh cart
            return { success: true };
        } catch (err) {
            console.error('Add to cart error:', err);
            return { success: false, error: err.message };
        }
    };

    const removeItem = async (cart_id) => {
        try {
            const res = await fetch(`${API_URL}/api/cart/${cart_id}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to remove item');
            }
            setCartItems(prev => prev.filter(item => item.cart_id !== cart_id));
            return { success: true };
        } catch (err) {
            console.error('Remove cart item error:', err);
            return { success: false, error: err.message };
        }
    };

    const isInCart = (product_id) => {
        return cartItems.some(item => item.id === product_id);
    };

    return (
        <CartContext.Provider value={{ cartItems, loading, addToCart, removeItem, isInCart, refreshCart: fetchCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
