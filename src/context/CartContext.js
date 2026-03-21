'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
    const { user } = useAuth();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCart = useCallback(async () => {
        if (!user || !user.user_id) {
            console.log('Cart fetch skipped: user or user_id is missing', { user });
            setCartItems([]);
            setLoading(false);
            return;
        }
        try {
            console.log(`Fetching cart for user: ${user.user_id}`);
            const apiUrl = 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/cart/${user.user_id}`);
            if (!res.ok) throw new Error('Failed to fetch cart');
            const data = await res.json();
            setCartItems(data);
        } catch (err) {
            console.error('Cart fetch error:', err);
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
            const apiUrl = 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.user_id,
                    products_id: product_id,
                    quantity: 1
                }),
            });
            if (!res.ok) throw new Error('Failed to add to cart');
            await fetchCart(); // Refresh cart
            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, error: err.message };
        }
    };

    const removeItem = async (cart_id) => {
        try {
            const apiUrl = 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/cart/${cart_id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to remove item');
            setCartItems(prev => prev.filter(item => item.cart_id !== cart_id));
            return { success: true };
        } catch (err) {
            console.error(err);
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
