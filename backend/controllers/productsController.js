import { supabase } from '../config/supabase.js';

// Fetch all products (with optional filters)
export const getAllProducts = async (req, res) => {
  try {
    const { status, seller_id, condition, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('vw_product_details').select('*');

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
      .from('vw_product_details')
      .select('*')
      .eq('products_id', products_id)
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

    let final_seller_id = seller_id;

    // Check if the provided ID is actually a user_id
    const { data: sellerData, error: sellerError } = await supabase
        .from('Seller')
        .select('seller_id')
        .eq('user_id', seller_id)
        .maybeSingle();
    
    if (sellerData) {
        final_seller_id = sellerData.seller_id;
    }

    let query = supabase
      .from('vw_product_details') // Better to use the view to get images easily
      .select('*')
      .eq('seller_id', final_seller_id);

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
    const { 
      seller_id, 
      user_id,
      title, 
      name,
      description, 
      availability,
      price,
      length_mm,
      width_mm,
      height_mm,
      starting_price,
      reserve_price,
      condition, 
      status, 
      image_urls // fallback if passed normally
    } = req.body;

    let categories = req.body.categories;
    if (typeof categories === 'string') {
        try {
            categories = JSON.parse(categories);
        } catch(e) {
            categories = categories.split(',').map(c => c.trim());
        }
    }

    const productName = name || title;

    let final_seller_id = seller_id;

    // If we only got user_id, look up the seller_id
    if (!final_seller_id && user_id) {
        const { data: sellerData, error: sellerError } = await supabase
            .from('Seller')
            .select('seller_id')
            .eq('user_id', user_id)
            .single();
        
        if (sellerData) {
            final_seller_id = sellerData.seller_id;
        }
    }

    // Validation
    if (!final_seller_id || !productName) {
      return res.status(400).json({ error: 'seller_id (or user_id belonging to a seller) and name are required.' });
    }

    let final_image_urls = image_urls ? (Array.isArray(image_urls) ? image_urls : [image_urls]) : [];

    // Process file uploads from multer
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Create a unique filename
        const fileExt = file.originalname.split('.').pop() || 'jpg';
        const fileName = `${final_seller_id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });
          
        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue; // Skip failed uploads but keep going to save product
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
          
        final_image_urls.push(publicUrl);
      }
    }

    // Call the Supabase RPC for full product upload
    const { data, error } = await supabase.rpc('upload_product', {
      p_seller_id: final_seller_id,
      p_name: productName,
      p_description: description || null,
      p_availability: availability !== undefined ? parseInt(availability) : 1,
      p_price: price ? parseFloat(price) : null,
      p_length_mm: length_mm ? Math.max(0, parseInt(length_mm)) : 0,
      p_width_mm: width_mm ? Math.max(0, parseInt(width_mm)) : 0,
      p_height_mm: height_mm ? Math.max(0, parseInt(height_mm)) : 0,
      p_starting_price: starting_price ? parseFloat(starting_price) : null,
      p_reserve_price: reserve_price ? parseFloat(reserve_price) : null,
      p_condition: condition || 'new',
      p_status: status || 'draft',
      p_categories: Array.isArray(categories) ? categories : null,
      p_image_urls: final_image_urls.length > 0 ? final_image_urls : null
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data.success) {
      return res.status(400).json({ error: data.error || data.message || 'Failed to create product' });
    }

    res.status(201).json({ message: data.message, data: data.data });
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

    const validStatuses = ['active', 'inactive', 'archived', 'sold', 'delisted', 'scheduled'];
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
