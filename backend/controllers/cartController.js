import { supabase } from '../config/supabase.js';

const ACTIVE_CART_LIMIT = 15;

const getProductFixedPrice = (product) => {
  const price = parseFloat(product?.price || 0);
  const startingPrice = parseFloat(product?.starting_price || 0);
  return price || startingPrice || 0;
};


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
        price_snapshot,
        is_stashed,
        added_at,
        Products (
            name,
            price,
            starting_price,
            condition,
            description,
            seller_id,
            Product_Images (
                image_url
            ),
            Seller (
                store_name
            ),
            status,
            availability
        )
      `)
      .eq('cart_id', cart_id)
      .order('is_stashed', { ascending: true }) // Active items first
      .order('added_at', { ascending: false }); // Newest items first

    if (error) {
      console.error(`Supabase error fetching cart for user ${user_id}:`, error.message);
      return res.status(500).json({ error: error.message });
    }
    
    if (!data) return res.json([]);

    // Format response for frontend
    const formattedData = data.map(item => {
      const productPrice = getProductFixedPrice(item.Products);
      const price = productPrice || item.price_snapshot || 0;
      return ({
        cart_id: item.cartItem_id,
        id: item.product_id,
        name: item.Products?.name || 'Unknown Product',
        price,
        quantity: item.quantity,
        is_stashed: item.is_stashed || false,
        added_at: item.added_at,
        image: item.Products?.Product_Images?.[0]?.image_url || null,
        seller: item.Products?.Seller?.store_name || 'Unknown Store',
        seller_id: item.Products?.seller_id || null,
        condition: item.Products?.condition || 'N/A',
        description: item.Products?.description || '',
        status: item.Products?.status || 'active',
        availability: item.Products?.availability ?? 1
      });
    });

    // Split into active and stashed for better frontend handling
    const response = {
      active: formattedData.filter(item => !item.is_stashed),
      stashed: formattedData.filter(item => item.is_stashed),
      total_active: formattedData.filter(item => !item.is_stashed).length,
      limit: ACTIVE_CART_LIMIT
    };

    res.json(response);
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
      const { data: product } = await supabase
        .from('Products')
        .select('price, starting_price')
        .eq('products_id', products_id)
        .single();
      const priceSnapshot = getProductFixedPrice(product) || (existingItem.price_snapshot || 0);

      // Update quantity
      const { data, error } = await supabase
        .from('Cart_items')
        .update({
          quantity: parseInt(existingItem.quantity) + parseInt(quantity),
          price_snapshot: priceSnapshot
        })
        .eq('cartItem_id', existingItem.cartItem_id)
        .select('*');

      if (error) return res.status(400).json({ error: error.message });


      return res.json({ message: 'Cart updated', data: data[0] });
    } else {
      const { data: product } = await supabase
        .from('Products')
        .select('price, starting_price')
        .eq('products_id', products_id)
        .single();

      const priceSnapshot = getProductFixedPrice(product);

      // Insert new item
      const { data, error } = await supabase
        .from('Cart_items')
        .insert([{ 
            cart_id, 
            product_id: products_id, 
            quantity,
            price_snapshot: priceSnapshot
        }])
        .select('*');

      if (error) return res.status(400).json({ error: error.message });
      

      // Post-process: Manage cart limits
      await enforceCartLimit(cart_id);
      
      return res.status(201).json({ message: 'Added to cart', data: data[0] });
    }
  } catch (err) {
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};

// Internal helper to enforce the active cart limit
const enforceCartLimit = async (cart_id) => {
  try {
    // 1. Get all active items ordered by added_at
    const { data: activeItems, error: fetchError } = await supabase
      .from('Cart_items')
      .select('cartItem_id')
      .eq('cart_id', cart_id)
      .eq('is_stashed', false)
      .order('added_at', { ascending: false });

    if (fetchError) throw fetchError;

    // 2. If we exceed the limit, stash the oldest ones
    if (activeItems && activeItems.length > ACTIVE_CART_LIMIT) {
      const itemsToStash = activeItems.slice(ACTIVE_CART_LIMIT);
      const idsToStash = itemsToStash.map(item => item.cartItem_id);

        
      console.log(`Auto-stashed ${idsToStash.length} items for cart ${cart_id} and returned stock.`);
    }
  } catch (err) {
    console.error('Error enforcing cart limit:', err.message);
  }
};

// Manually stash an item
export const stashCartItem = async (req, res) => {
  try {
    const { cartItem_id } = req.params;
    const { data, error } = await supabase
      .from('Cart_items')
      .update({ is_stashed: true })
      .eq('cartItem_id', cartItem_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Item stashed', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Manually unstash an item (moves back to active, might trigger stashing of others)
export const unstashCartItem = async (req, res) => {
  try {
    const { cartItem_id } = req.params;
    
    // 1. Move to active
    const { data, error } = await supabase
      .from('Cart_items')
      .update({ is_stashed: false, added_at: new Date().toISOString() }) // Reset added_at to make it "newest" active
      .eq('cartItem_id', cartItem_id)
      .select('cart_id, cartItem_id');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Item not found' });

    // 2. Enforce limit (this might stash the oldest active item)
    await enforceCartLimit(data[0].cart_id);


    res.json({ message: 'Item moved to active cart', data: data[0] });
  } catch (err) {
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

    const { data: existingItem } = await supabase.from('Cart_items').select('quantity, is_stashed').eq('cartItem_id', cartItem_id).single();
    if (!existingItem) return res.status(404).json({ error: 'Cart item not found' });

    const { data, error } = await supabase
      .from('Cart_items')
      .update({ quantity })
      .eq('cartItem_id', cartItem_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Cart item found' });


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

    // Fetch items that were NOT stashed to return stock
    const { data: activeItems } = await supabase
      .from('Cart_items')
      .select('product_id, quantity')
      .eq('cart_id', cart_id)
      .eq('is_stashed', false);

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

// Remove specific products from cart after a successful order — WITHOUT restoring stock
// (The product is now "sold", so stock should stay at 0)
export const removeOrderedItemsFromCart = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { product_ids } = req.body; // array of product UUIDs that were ordered

    if (!user_id || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'user_id and product_ids[] are required' });
    }

    const cart_id = await getOrCreateCartId(user_id);

    // Delete those cart items WITHOUT calling adjustProductAvailability
    // because the product status/availability was already finalized by createOrder
    const { error } = await supabase
      .from('Cart_items')
      .delete()
      .eq('cart_id', cart_id)
      .in('product_id', product_ids);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Ordered items removed from cart' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
