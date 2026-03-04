import { supabase } from '../config/supabase.js';

// Fetch all products (with optional filters)
export const getAllProducts = async (req, res) => {
  try {
    const { status, seller_id, condition, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('Products').select('*').is('deleted_at', null);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (seller_id) query = query.eq('seller_id', seller_id);
    if (condition) query = query.eq('condition', condition);

    // Add pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ count, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch product by product ID
export const getProductById = async (req, res) => {
  try {
    const { products_id } = req.params;
    const { data, error } = await supabase
      .from('Products')
      .select('*')
      .eq('products_id', products_id)
      .is('deleted_at', null)
      .single();

    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all products by seller
export const getProductsBySeller = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('Products')
      .select('*')
      .eq('seller_id', seller_id)
      .is('deleted_at', null);

    if (status) query = query.eq('status', status);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ count, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new product
export const createProduct = async (req, res) => {
  try {
    const { seller_id, title, description, sku, condition, status, reserve_price, starting_price } = req.body;

    // Validation
    if (!seller_id || !title) {
      return res.status(400).json({ error: 'seller_id and title are required.' });
    }

    // Verify seller exists
    const { data: sellerCheck, error: sellerError } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('seller_id', seller_id)
      .single();

    if (sellerError || !sellerCheck) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const { data, error } = await supabase
      .from('Products')
      .insert([
        {
          seller_id,
          title,
          description: description || null,
          sku: sku || null,
          condition: condition || null,
          status: status || 'active',
          reserve_price: reserve_price || null,
          starting_price: starting_price || null
        }
      ])
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Product created successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const { products_id } = req.params;
    const { title, description, sku, condition, status, reserve_price, starting_price } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (sku !== undefined) updateData.sku = sku;
    if (condition !== undefined) updateData.condition = condition;
    if (status !== undefined) updateData.status = status;
    if (reserve_price !== undefined) updateData.reserve_price = reserve_price;
    if (starting_price !== undefined) updateData.starting_price = starting_price;

    const { data, error } = await supabase
      .from('Products')
      .update(updateData)
      .eq('products_id', products_id)
      .is('deleted_at', null)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Soft delete product
export const deleteProduct = async (req, res) => {
  try {
    const { products_id } = req.params;

    const { data, error } = await supabase
      .from('Products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('products_id', products_id)
      .is('deleted_at', null)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Restore deleted product
export const restoreProduct = async (req, res) => {
  try {
    const { products_id } = req.params;

    const { data, error } = await supabase
      .from('Products')
      .update({ deleted_at: null })
      .eq('products_id', products_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product restored successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update product status
export const updateProductStatus = async (req, res) => {
  try {
    const { products_id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const validStatuses = ['active', 'inactive', 'archived', 'sold', 'delisted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('Products')
      .update({ status })
      .eq('products_id', products_id)
      .is('deleted_at', null)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product status updated successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search products by title or description
export const searchProducts = async (req, res) => {
  try {
    const { query, limit = 50, offset = 0 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const { data, error, count } = await supabase
      .from('Products')
      .select('*')
      .is('deleted_at', null)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ count, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
