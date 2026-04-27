import { supabase } from '../config/supabase.js';
import { generatePriceRecommendation } from '../services/priceRecommendationService.js';
import { createModerationCase } from '../services/violationService.js';

// Fetch all products (with optional filters)
export const getAllProducts = async (req, res) => {
  try {
    const {
      status,
      seller_id,
      condition,
      category,
      search,
      has_price,
      sort = 'recent',
      limit = 50,
      offset = 0
    } = req.query;

    let query = supabase.from('vw_product_details').select('*', { count: 'exact' });

    // Filters
    if (status)    query = query.eq('status', status);
    if (seller_id) query = query.eq('seller_id', seller_id);
    if (condition) query = query.eq('condition', condition);
    if (category)  query = query.ilike('category', `%${category}%`);
    if (search)    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    if (has_price === 'true') query = query.not('price', 'is', null);

    // Sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'popular':
        query = query.order('wishlist_count', { ascending: false, nullsFirst: false });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    query = query.range(Number(offset), Number(offset) + parseInt(limit) - 1);

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
    const { status, has_price, limit = 50, offset = 0 } = req.query;

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
    if (has_price === 'true') query = query.not('price', 'is', null);
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
      brand,
      specifications,
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
      p_condition: condition || 'Good',
      p_brand: brand || null,
      p_specifications: specifications || null,
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

    // --- AUTOMATED MODERATION CHECKS ---
    try {
        const productDataForAI = {
            name: productName,
            description: description || '',
            category: Array.isArray(categories) ? categories[0] : (categories || 'General'),
            condition: condition || 'Good',
            brand: brand || 'Generic'
        };

        const priceResult = await generatePriceRecommendation(productDataForAI);
        
        if (priceResult.success) {
            const suggestedPrice = priceResult.recommendation.suggestedReservePrice || priceResult.recommendation.suggestedStartingBid;
            const actualPrice = price ? parseFloat(price) : (starting_price ? parseFloat(starting_price) : 0);

            if (suggestedPrice > 0 && actualPrice > 0) {
                const deviation = Math.abs(actualPrice - suggestedPrice) / suggestedPrice;
                
                if (deviation > 0.5) {
                    console.log(`⚠️  Price deviation alert: ${Math.round(deviation * 100)}% deviation from recommended ₱${suggestedPrice}`);
                    
                    // Flag for moderation
                    await supabase
                        .from('Products')
                        .update({ status: 'under_review' })
                        .eq('products_id', data.data.products_id);

                    // Create moderation case
                    await createModerationCase({
                        user_id: user_id || null, // Might be null if only seller_id known, but we usually have it
                        case_type: 'listing_moderation',
                        priority: 'normal',
                        related_id: data.data.products_id, // We'll assume the migration for related_id is pending or we'll use a Note
                        evidence: {
                            reason: 'Price deviation > 50%',
                            suggested_price: suggestedPrice,
                            actual_price: actualPrice,
                            deviation_percent: Math.round(deviation * 100)
                        }
                    });

                    return res.status(201).json({ 
                        message: 'Product created and sent for moderation review due to price deviation.', 
                        data: { ...data.data, status: 'under_review' } 
                    });
                }
            }
        }
    } catch (modErr) {
        console.error('Moderation check error (non-fatal):', modErr);
        // We don't block product creation if moderation check fails
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

// Deep cascading permanent delete for products and all metadata
export const deleteProduct = async (req, res) => {
  try {
    const { products_id } = req.params;

    console.log(`🚀 Starting deep permanent delete for product: ${products_id}`);

    // 1. Check for Order Items - Essential guard rail
    const { data: hasOrder } = await supabase
      .from('Order_items')
      .select('orderItem_id')
      .eq('products_id', products_id)
      .maybeSingle();

    if (hasOrder) {
      return res.status(400).json({ error: 'This item has already been sold. It cannot be permanently deleted from records.' });
    }

    // 2. Find all associated Auction IDs
    const { data: auctions } = await supabase
      .from('Auctions')
      .select('auction_id')
      .eq('products_id', products_id);

    const auctionIds = auctions?.map(a => a.auction_id) || [];

    if (auctionIds.length > 0) {
        console.log(`📦 Found ${auctionIds.length} auctions to clean up.`);

        // 3. Break circularity: Nullify winning bid references in Auctions first
        await supabase
            .from('Auctions')
            .update({ winning_bid_id: null })
            .in('auction_id', auctionIds);

        // 4. Delete dependent metadata for all found auctions
        await Promise.all([
            supabase.from('Bids').delete().in('auction_id', auctionIds),
            supabase.from('Auction_Likes').delete().in('auction_id', auctionIds),
            supabase.from('Auction_Shares').delete().in('auction_id', auctionIds),
            supabase.from('Auction_Views').delete().in('auction_id', auctionIds),
            supabase.from('Live_Comments').delete().in('auction_id', auctionIds),
            supabase.from('Live_stream').delete().in('auction_id', auctionIds),
            supabase.from('Auction_winners').delete().in('auction_id', auctionIds),
            supabase.from('Auction_schedules').delete().in('auction_id', auctionIds),
            supabase.from('Notifications').delete().in('reference_id', auctionIds).eq('reference_type', 'auction'),
            supabase.from('payment_windows').delete().in('auction_id', auctionIds),
            supabase.from('Order_Cancellations').delete().in('auction_id', auctionIds),
            supabase.from('Seller_Reports').delete().in('auction_id', auctionIds)
        ]);
        
        // 5. Delete the Auctions themselves
        await supabase.from('Auctions').delete().in('auction_id', auctionIds);
    }

    // 6. Final cleanup of product-specific assets
    await Promise.all([
        supabase.from('Cart_items').delete().eq('product_id', products_id),
        supabase.from('Product_Categories').delete().eq('products_id', products_id),
        supabase.from('Product_Images').delete().eq('products_id', products_id)
    ]);

    // 7. Delete the Product
    const { data, error } = await supabase
      .from('Products')
      .delete()
      .eq('products_id', products_id)
      .select('*');

    if (error) {
        console.error(`❌ Permanent delete failed at final step for ${products_id}:`, error);
        return res.status(400).json({ error: `System Error: ${error.message}` });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product record was not found.' });
    }

    console.log(`✅ Deep delete successful for ${products_id}.`);

    res.json({ 
      success: true,
      message: 'Product and all associated history permanently removed.',
      data: data[0] 
    });
  } catch (err) {
    console.error('🔥 Unexpected error in deep deleteProduct:', err);
    res.status(500).json({ error: 'Internal server error occurred during deletion.' });
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
