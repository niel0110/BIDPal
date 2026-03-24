import { supabase } from '../config/supabase.js';

// Get all auctions for a seller
export const getSellerAuctions = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const { status, search, limit = 50, offset = 0 } = req.query;

    let final_seller_id = seller_id;

    // Check if the provided ID is actually a user_id
    const { data: sellerData } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', seller_id)
      .maybeSingle();

    if (sellerData) {
      final_seller_id = sellerData.seller_id;
    }

    // Build query to fetch auctions
    let query = supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      const dbStatus = status === 'completed' ? 'ended' : status;
      query = query.eq('status', dbStatus);
    }

    // Add pagination (we'll apply it after search filtering for now)
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: auctionsData, error: auctionsError } = await query;

    if (auctionsError) {
      console.error('Error fetching auctions:', auctionsError);
      return res.status(500).json({ error: auctionsError.message });
    }

    // If search query is provided, first get matching product IDs
    let searchProductIds = null;
    if (search && search.trim()) {
      const searchLower = `%${search.toLowerCase().trim()}%`;

      // Query products using ILIKE for case-insensitive search
      const { data: matchingProducts } = await supabase
        .from('Products')
        .select('products_id')
        .or(`name.ilike.${searchLower},description.ilike.${searchLower}`);

      if (matchingProducts) {
        searchProductIds = new Set(matchingProducts.map(p => p.products_id));
      }
    }

    // Fetch product details for each auction
    let transformedData = await Promise.all(
      auctionsData.map(async (auction) => {
        // Fetch product details from the view
        const { data: productData } = await supabase
          .from('vw_product_details')
          .select('*')
          .eq('products_id', auction.products_id)
          .maybeSingle();

        const images = productData?.images || [];
        const primaryImage = images.find(img => img.is_primary) || images[0];

        return {
          auction_id: auction.auction_id,
          product_id: auction.products_id,
          product_name: productData?.name || 'Unknown Product',
          product_description: productData?.description,
          product_image: primaryImage?.image_url || null,
          start_time: auction.start_time,
          end_time: auction.end_time,
          buy_now_price: auction.buy_now_price || 0,
          reserve_price: auction.reserve_price || 0,
          current_price: auction.current_price || auction.reserve_price || 0,
          status: auction.status,
          created_at: auction.created_at,
        };
      })
    );

    // Apply search filter if provided (filter by product IDs that matched search)
    if (searchProductIds !== null) {
      transformedData = transformedData.filter(auction =>
        searchProductIds.has(auction.product_id)
      );
    }

    res.json({ count: transformedData.length, data: transformedData });
  } catch (err) {
    console.error('Unexpected error fetching auctions:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all active/scheduled auctions for discovery
export const getAllAuctions = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('Auctions')
      .select(`
        *,
        Seller (
          store_name,
          logo_url,
          banner_url,
          User (
            Avatar
          )
        )
      `)
      .order('start_time', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['active', 'scheduled']);
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: auctionsData, error: auctionsError } = await query;

    if (auctionsError) throw auctionsError;

    // Fetch product details for each auction
    const transformedData = await Promise.all(
      auctionsData.map(async (auction) => {
        const { data: productData } = await supabase
          .from('vw_product_details')
          .select('*')
          .eq('products_id', auction.products_id)
          .maybeSingle();

        const images = productData?.images || [];
        const primaryImage = images.find(img => img.is_primary) || images[0];

        return {
          id: auction.auction_id,
          seller_id: auction.seller_id,
          title: productData?.name || 'Unknown Product',
          price: auction.buy_now_price || auction.reserve_price || 0,
          currentBid: auction.current_price || auction.reserve_price || 0,
          seller: auction.Seller?.store_name || 'Unknown Seller',
          seller_avatar: auction.Seller?.logo_url || auction.Seller?.User?.Avatar,
          seller_banner: auction.Seller?.banner_url,
          viewers: Math.floor(Math.random() * 100), // Random placeholder for now
          timeLeft: auction.status === 'active' ? 'Active Now' : new Date(auction.start_time).toLocaleString(),
          image: primaryImage?.image_url || null,
          status: auction.status
        };
      })
    );

    res.json({ count: transformedData.length, data: transformedData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Schedule a new live auction
export const scheduleAuction = async (req, res) => {
  try {
    const { 
      product_id, 
      user_id, // Get seller_id from user_id
      seller_id,
      sale_type, 
      starting_bid, 
      buy_now_price, 
      start_date, 
      start_time,
      end_date,
      end_time,
      timezone = 'UTC' 
    } = req.body;

    // Validation
    if (!product_id || (!user_id && !seller_id)) {
      return res.status(400).json({ error: 'product_id and user_id/seller_id are required.' });
    }

    if (!start_date || !start_time) {
      return res.status(400).json({ error: 'start_date and start_time are required.' });
    }

    let final_seller_id = seller_id;

    // Look up seller_id if only user_id is provided
    if (!final_seller_id && user_id) {
        const { data: sellerData, error: sellerError } = await supabase
            .from('Seller')
            .select('seller_id')
            .eq('user_id', user_id)
            .maybeSingle();

        if (sellerData) {
            final_seller_id = sellerData.seller_id;
        } else {
             return res.status(404).json({ error: 'Seller profile not found for this user.' });
        }
    }

    // Verify that the product exists and belongs to this seller
    const { data: productData, error: productError } = await supabase
        .from('Products')
        .select('products_id, seller_id, status')
        .eq('products_id', product_id)
        .is('deleted_at', null)
        .maybeSingle();

    if (!productData) {
        return res.status(404).json({ error: 'Product not found or has been deleted.' });
    }

    if (productData.seller_id !== final_seller_id) {
        return res.status(403).json({ error: 'You do not have permission to schedule this product.' });
    }

    // Check if product is already scheduled or in an auction
    if (productData.status === 'scheduled' || productData.status === 'active') {
        return res.status(400).json({ error: `Product is already ${productData.status}. Cannot schedule again.` });
    }

    // Check if there's already an active or scheduled auction for this product
    const { data: existingAuction } = await supabase
        .from('Auctions')
        .select('auction_id, status')
        .eq('products_id', product_id)
        .in('status', ['scheduled', 'active'])
        .maybeSingle();

    if (existingAuction) {
        return res.status(400).json({
            error: `This product already has a ${existingAuction.status} auction. Please cancel it before creating a new one.`
        });
    }

    // Combine date and time to ISO timestamp
    const startDateTimeStr = `${start_date}T${start_time}:00`;
    const start_timestamp = new Date(startDateTimeStr).toISOString();

    let end_timestamp;
    if (end_date && end_time) {
      const endDateTimeStr = `${end_date}T${end_time}:00`;
      end_timestamp = new Date(endDateTimeStr).toISOString();
    } else {
      // Default end time to 7 days after start if not provided
      const d = new Date(startDateTimeStr);
      d.setDate(d.getDate() + 7);
      end_timestamp = d.toISOString();
    }

    const isBid = sale_type === 'bid';

    // Insert into Auctions table
    const { data: auctionData, error: auctionError } = await supabase
      .from('Auctions')
      .insert([
        {
          products_id: product_id,
          seller_id: final_seller_id,
          start_time: start_timestamp,
          end_time: end_timestamp,
          buy_now_price: !isBid ? (buy_now_price || 0) : 0,
          reserve_price: isBid ? (starting_bid || 0) : 0,
          incremental_bid_step: isBid ? 5.00 : 0, // Default placeholder step
          status: 'scheduled',
          timezone: timezone
        }
      ])
      .select('auction_id')
      .single();

    if (auctionError) {
      console.error('Supabase auction insert error:', auctionError);
      return res.status(400).json({ error: auctionError.message });
    }

    // Insert audit log into Auction_schedules
    const { error: scheduleError } = await supabase
      .from('Auction_schedules')
      .insert([
        {
          auction_id: auctionData.auction_id,
          scheduled_by: user_id || final_seller_id, // Ideally the user who scheduled it
        }
      ]);

    if (scheduleError) {
      console.error('Auction_schedules insert error:', scheduleError);
      // Even if this fails, we created the auction, but log the error
    }

    // Update Product status to 'scheduled'
    await supabase
      .from('Products') // Or your active products table
      .update({ status: 'scheduled' })
      .eq('products_id', product_id);

    res.status(201).json({ message: 'Auction scheduled successfully', auction_id: auctionData.auction_id });
  } catch (err) {
    console.error('Unexpected error scheduling auction:', err);
    res.status(500).json({ error: err.message });
  }
};
// Start a scheduled auction
export const startAuction = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Update Auction status to 'active' and record live start time
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .update({
        status: 'active',
        live_started_at: new Date().toISOString()
      })
      .eq('auction_id', id)
      .select()
      .single();

    if (auctionError) throw auctionError;

    // 2. Update Product status to 'active'
    await supabase
      .from('Products')
      .update({ status: 'active' })
      .eq('products_id', auction.products_id);

    res.json({ message: 'Auction started', data: auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// End an active auction
export const endAuction = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Update Auction status to 'ended' and record live end time
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .update({
        status: 'ended',
        live_ended_at: new Date().toISOString()
      })
      .eq('auction_id', id)
      .select()
      .single();

    if (auctionError) throw auctionError;

    // 2. Update Product status to 'sold' (or 'inactive' if no winner)
    await supabase
      .from('Products')
      .update({ status: 'inactive' })
      .eq('products_id', auction.products_id);

    res.json({ message: 'Auction ended', data: auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single auction details
export const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: auction, error } = await supabase
      .from('Auctions')
      .select(`
        *,
        Seller (
          seller_id,
          store_name,
          logo_url,
          banner_url,
          User (
            Avatar,
            Fname,
            Lname
          )
        )
      `)
      .eq('auction_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    // Get product details
    const { data: productData } = await supabase
      .from('vw_product_details')
      .select('*')
      .eq('products_id', auction.products_id)
      .maybeSingle();

    const result = {
      ...auction,
      product: productData,
      seller_info: {
          seller_id: auction.Seller?.seller_id,
          store_name: auction.Seller?.store_name || 'Unknown Seller',
          avatar: auction.Seller?.logo_url || auction.Seller?.User?.Avatar,
          banner: auction.Seller?.banner_url,
          full_name: auction.Seller?.User ? `${auction.Seller.User.Fname} ${auction.Seller.User.Lname}` : 'Unknown'
      }
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all live comments for an auction
export const getLiveComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('Live_Comments')
      .select('comment_id, user_id, username, text, created_at')
      .eq('auction_id', id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Post a new live comment
export const postLiveComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, username, text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const { data, error } = await supabase
      .from('Live_Comments')
      .insert([{
        auction_id: id,
        user_id: user_id || null,
        username: username || 'Guest',
        text: text.trim()
      }])
      .select('comment_id, user_id, username, text, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
