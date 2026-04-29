import { supabase } from '../config/supabase.js';

// Helper to get or create a cart for a user
const getOrCreateCartId = async (user_id) => {
  const { data: cart, error: fetchError } = await supabase
    .from('Carts')
    .select('cart_id')
    .eq('user_id', user_id)
    .single();

  if (fetchError && fetchError.code === 'PGRST116') {
    const { data: newCart, error: createError } = await supabase
      .from('Carts')
      .insert([{ user_id }])
      .select('cart_id')
      .single();

    if (createError) throw createError;
    return newCart.cart_id;
  }

  if (fetchError) throw fetchError;
  return cart.cart_id;
};

// Fetch all items in a user's cart
export const getCartByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!user_id || user_id === 'undefined' || !uuidRegex.test(user_id)) {
      console.warn(`Invalid user_id received in getCartByUser: ${user_id}`);
      return res.status(400).json({ error: 'Invalid or missing user_id. Must be a valid UUID.' });
    }
    
    // 1. Get cart_id for user
    const cart_id = await getOrCreateCartId(user_id);

    // 2. Fetch items with product details
    const { data, error } = await supabase
      .from('Cart_items')
      .select(`
        cartItem_id,
        product_id,
        quantity,
        Products (
            name,
            price,
            condition,
            description,
            seller_id,
            Product_Images (
                image_url
            ),
            Seller (
                store_name
            )
        )
      `)
      .eq('cart_id', cart_id)
      .order('added_at', { ascending: false });

    if (error) {
      console.error(`Supabase error fetching cart for user ${user_id}:`, error.message);
      return res.status(500).json({ error: error.message });
    }
    
    if (!data) return res.json([]);

    // Format response for frontend
    const formattedData = data.map(item => ({
        cart_id: item.cartItem_id,
        id: item.product_id,
        name: item.Products?.name || 'Unknown Product',
        price: item.Products?.price || 0,
        quantity: item.quantity,
        image: item.Products?.Product_Images?.[0]?.image_url || null,
        seller: item.Products?.Seller?.store_name || 'Unknown Store',
        seller_id: item.Products?.seller_id || null,
        condition: item.Products?.condition || 'N/A',
        description: item.Products?.description || ''
    }));

    res.json(formattedData);
  } catch (err) {
    console.error(`Unexpected error in getCartByUser for user ${req.params.user_id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};

// Add item to cart or increment quantity
export const addToCart = async (req, res) => {
  try {
    const { user_id, products_id, quantity = 1 } = req.body;

    if (!user_id || !products_id) {
      return res.status(400).json({ error: 'user_id and products_id are required' });
    }

    const cart_id = await getOrCreateCartId(user_id);

    // Check if item already exists in Cart_items
    const { data: existingItem, error: fetchError } = await supabase
      .from('Cart_items')
      .select('*')
      .eq('cart_id', cart_id)
      .eq('product_id', products_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`Supabase error checking existing item for cart ${cart_id}:`, fetchError.message);
      return res.status(500).json({ error: fetchError.message });
    }

    if (existingItem) {
      // Update quantity
      const { data, error } = await supabase
        .from('Cart_items')
        .update({ quantity: parseInt(existingItem.quantity) + parseInt(quantity) })
        .eq('cartItem_id', existingItem.cartItem_id)
        .select('*');

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ message: 'Cart updated', data: data[0] });
    } else {
      // Fetch current product price for snapshot
      const { data: product } = await supabase.from('Products').select('price').eq('products_id', products_id).single();

      // Insert new item
      const { data, error } = await supabase
        .from('Cart_items')
        .insert([{ 
            cart_id, 
            product_id: products_id, 
            quantity,
            price_snapshot: product?.price || 0
        }])
        .select('*');

      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ message: 'Added to cart', data: data[0] });
    }
  } catch (err) {
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};

// Update item quantity in cart
export const updateCartQuantity = async (req, res) => {
  try {
    const { cart_id: cartItem_id } = req.params; // Params says cart_id but it's the item's primary key
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const { data, error } = await supabase
      .from('Cart_items')
      .update({ quantity })
      .eq('cartItem_id', cartItem_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Cart item not found' });

    res.json({ message: 'Quantity updated', data: data[0] });
  } catch (err) {
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { cart_id: cartItem_id } = req.params;

    const { data, error } = await supabase
      .from('Cart_items')
      .delete()
      .eq('cartItem_id', cartItem_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Removed from cart', data: data[0] });
  } catch (err) {
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};

// Clear entire cart for a user
export const clearCart = async (req, res) => {
  try {
    const { user_id } = req.params;
    const cart_id = await getOrCreateCartId(user_id);

    const { error } = await supabase
      .from('Cart_items')
      .delete()
      .eq('cart_id', cart_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
