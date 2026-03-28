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
    const now = new Date().toISOString();
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .update({
        status: 'active',
        start_time: now, // Update start_time to actual live time
        live_started_at: now
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

    console.log(`🏁 Ending auction ${id}...`);

    // 1. Get the highest bid (winning bid)
    const { data: winningBid, error: bidError } = await supabase
      .from('Bids')
      .select('bid_id, bid_amount, user_id, placed_at, bidder:User(user_id, Fname, Lname, Avatar, email)')
      .eq('auction_id', id)
      .order('bid_amount', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bidError) {
      console.error('Error fetching winning bid:', bidError);
    }

    console.log('🏆 Winning bid:', winningBid);

    // 2. Get auction details before updating
    const { data: currentAuction } = await supabase
      .from('Auctions')
      .select('*, Seller(seller_id, user_id, store_name)')
      .eq('auction_id', id)
      .single();

    // 3. Update Auction status to 'ended' and record live end time and winner
    const updateData = {
      status: 'ended',
      live_ended_at: new Date().toISOString()
    };

    // Add winner information if there's a winning bid
    if (winningBid) {
      updateData.winning_bid_id = winningBid.bid_id;
      updateData.winner_user_id = winningBid.user_id;
      updateData.final_price = winningBid.bid_amount;
    }

    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .update(updateData)
      .eq('auction_id', id)
      .select()
      .single();

    if (auctionError) throw auctionError;

    // 4. Determine product status based on whether there's a winner
    let productStatus = 'inactive'; // Default if no bids
    let reserveMet = false;

    if (winningBid) {
      // Check if winning bid meets reserve price
      if (winningBid.bid_amount >= (auction.reserve_price || 0)) {
        productStatus = 'sold';
        reserveMet = true;
      } else {
        productStatus = 'inactive'; // Reserve not met
        console.log(`⚠️ Reserve price not met. Winning bid: ${winningBid.bid_amount}, Reserve: ${auction.reserve_price}`);
      }
    }

    // Update Product status
    await supabase
      .from('Products')
      .update({ status: productStatus })
      .eq('products_id', auction.products_id);

    // 5. Create notifications and order if there's a winner and reserve is met
    let orderId = null;

    if (winningBid && reserveMet) {
      console.log('✅ Creating order for winner...');

      // Get product details for the order
      const { data: productData } = await supabase
        .from('vw_product_details')
        .select('*')
        .eq('products_id', auction.products_id)
        .maybeSingle();

      // Create order for the winner
      const { data: orderData, error: orderError } = await supabase
        .from('Orders')
        .insert([{
          user_id: winningBid.user_id,
          total_amount: winningBid.bid_amount,
          status: 'pending_payment', // Awaiting payment
          order_type: 'auction',
          auction_id: id // Link to auction
        }])
        .select('order_id')
        .single();

      if (orderError) {
        console.error('❌ ERROR creating order:', orderError);
        console.error('Order data attempted:', {
          user_id: winningBid.user_id,
          total_amount: winningBid.bid_amount,
          status: 'pending_payment',
          order_type: 'auction',
          auction_id: id
        });
      } else {
        orderId = orderData.order_id;
        console.log(`✅ Order created successfully: ${orderId}`);

        // Create order item
        const { error: itemError } = await supabase
          .from('Order_items')
          .insert([{
            order_id: orderId,
            products_id: auction.products_id,
            quantity: 1,
            unit_price: winningBid.bid_amount,
            subtotal: winningBid.bid_amount
          }]);

        if (itemError) {
          console.error('❌ ERROR creating order item:', itemError);
        } else {
          console.log(`📦 Order item created for order: ${orderId}`);
        }
      }

      // Notify winner
      const winnerName = winningBid.bidder ?
        `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
        winningBid.bidder.email?.split('@')[0] : 'Bidder';

      const { data: winnerNotif, error: winnerNotifError } = await supabase
        .from('Notifications')
        .insert([{
          user_id: winningBid.user_id,
          type: 'auction_won',
          title: '🎉 Congratulations! You won the auction',
          message: `You won the auction with a bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')}. Please proceed to payment.`,
          reference_id: id,
          reference_type: 'auction',
          metadata: JSON.stringify({
            order_id: orderId,
            product_name: productData?.name
          })
        }])
        .select();

      if (winnerNotifError) {
        console.error('❌ Failed to create winner notification:', winnerNotifError);
      } else {
        console.log(`🔔 Winner notification sent to user ${winningBid.user_id}`, winnerNotif);
      }

      // Get seller info and notify seller about the sale
      const sellerUserId = currentAuction?.Seller?.user_id;

      if (sellerUserId) {
        const { data: sellerNotif, error: sellerNotifError } = await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserId,
            type: 'auction_sold',
            title: '💰 Your auction has ended successfully',
            message: `Your auction sold to ${winnerName} for ₱${winningBid.bid_amount.toLocaleString('en-PH')}. Awaiting buyer payment.`,
            reference_id: id,
            reference_type: 'auction',
            metadata: JSON.stringify({
              order_id: orderId,
              winner_user_id: winningBid.user_id
            })
          }])
          .select();

        if (sellerNotifError) {
          console.error('❌ Failed to create seller notification:', sellerNotifError);
        } else {
          console.log(`🔔 Seller notification sent to user ${sellerUserId}`, sellerNotif);
        }
      }
    } else if (winningBid && !reserveMet) {
      // Notify bidder that reserve wasn't met
      await supabase
        .from('Notifications')
        .insert([{
          user_id: winningBid.user_id,
          type: 'auction_reserve_not_met',
          title: 'Auction ended - Reserve not met',
          message: `The auction ended but the reserve price was not met. Your bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')} was the highest.`,
          reference_id: id,
          reference_type: 'auction'
        }]);
    }

    // 6. Broadcast auction end via Socket.IO
    if (req.app.locals.io) {
      const winnerInfo = winningBid && reserveMet ? {
        user_id: winningBid.user_id,
        bid_amount: winningBid.bid_amount,
        bidder_name: winningBid.bidder ?
          `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
          winningBid.bidder.email?.split('@')[0] || 'Winner' : 'Winner',
        bidder_avatar: winningBid.bidder?.Avatar || null,
        order_id: orderId
      } : null;

      req.app.locals.io.to(`auction:${id}`).emit('auction-ended', {
        auction_id: id,
        winner: winnerInfo,
        final_price: winningBid?.bid_amount || 0,
        product_status: productStatus,
        reserve_met: reserveMet,
        has_winner: winningBid && reserveMet
      });

      console.log('📡 Broadcast auction-ended event');
    }

    console.log(`✅ Auction ${id} ended successfully`);

    res.json({
      success: true,
      message: 'Auction ended successfully',
      data: auction,
      winner: winningBid && reserveMet ? {
        user_id: winningBid.user_id,
        bid_amount: winningBid.bid_amount,
        bid_id: winningBid.bid_id,
        order_id: orderId
      } : null,
      product_status: productStatus,
      reserve_met: reserveMet,
      has_winner: winningBid && reserveMet
    });
  } catch (err) {
    console.error('❌ End auction error:', err);
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

// Place a bid on an auction
export const placeBid = async (req, res) => {
  try {
    const { id } = req.params; // auction_id
    const { amount } = req.body;
    const user_id = req.user?.user_id || req.user?.id; // From auth middleware

    console.log('📝 Placing bid:', { auction_id: id, user_id, amount });

    if (!user_id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid bid amount is required' });
    }

    // Get auction details to validate bid (include current_price)
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id, reserve_price, current_price, incremental_bid_step, status')
      .eq('auction_id', id)
      .single();

    if (auctionError || !auction) {
      console.error('❌ Auction lookup error:', { id, auctionError, auction });
      return res.status(404).json({ error: 'Auction not found' });
    }

    console.log('📋 Auction found:', { auction_id: auction.auction_id, status: auction.status, current_price: auction.current_price });

    if (auction.status !== 'active') {
      console.error('⚠️  Auction not active:', auction.status);
      return res.status(400).json({
        error: `Auction is not active (status: ${auction.status})`,
        currentStatus: auction.status
      });
    }

    // Use current_price from Auctions table (kept up-to-date by DB trigger)
    const currentPrice = parseFloat(auction.current_price || auction.reserve_price || 0);
    const step = parseFloat(auction.incremental_bid_step || 100);

    // Validate bid amount — must exceed current price by at least one step
    const minBid = currentPrice + step;
    const bidAmount = parseFloat(amount);

    if (bidAmount < minBid) {
      return res.status(400).json({
        error: `Bid must be at least ₱${minBid.toLocaleString('en-PH')}`,
        minBid,
        currentPrice
      });
    }

    // Insert bid into database (trigger will update Auctions.current_price)
    const { data: bid, error: bidError } = await supabase
      .from('Bids')
      .insert([{
        auction_id: id,
        user_id: user_id,
        bid_amount: bidAmount,
        placed_at: new Date().toISOString()
      }])
      .select('bid_id, bid_amount, placed_at, user_id')
      .single();

    if (bidError) {
      console.error('❌ Bid insert error:', bidError);
      throw bidError;
    }

    // Get user info separately to avoid foreign key issues
    const { data: userData } = await supabase
      .from('User')
      .select('Fname, Lname, Avatar')
      .eq('user_id', user_id)
      .single();

    // Calculate next minimum bid after this one
    const minNextBid = bidAmount + step;

    console.log('✅ Bid placed successfully:', bid);

    const fName = userData?.Fname;
    const lName = userData?.Lname;
    const emailName = userData?.email ? userData.email.split('@')[0] : 'User';
    const fullName = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : emailName;

    // Return formatted bid data with user information and next minimum bid
    res.status(201).json({
      success: true,
      bid_id: bid.bid_id,
      user_id: user_id,
      amount: bid.bid_amount,
      placed_at: bid.placed_at,
      bidder_name: fullName,
      bidder_avatar: userData?.Avatar || null,
      minNextBid,
      currentPrice: bidAmount,
      message: 'Bid placed successfully'
    });
  } catch (err) {
    console.error('❌ Place bid error:', err);
    res.status(500).json({ error: err.message || 'Failed to place bid' });
  }
};

// Get real-time stats for an auction
export const getAuctionStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    const getViewerCount = req.app.locals.getViewerCount || (() => 0);
    const liveViewers = getViewerCount(id);

    const { count: totalViews } = await supabase
      .from('Auction_Views')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    const { count: likes } = await supabase
      .from('Auction_Likes')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    const { count: shares } = await supabase
      .from('Auction_Shares')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', id);

    let isLiked = false;
    if (user_id) {
      const { data: existingLike } = await supabase
        .from('Auction_Likes')
        .select('user_id')
        .eq('auction_id', id)
        .eq('user_id', user_id)
        .maybeSingle();
      if (existingLike) isLiked = true;
    }

    res.json({
      stats: {
        viewers: Math.max(liveViewers, totalViews || 0),
        liveViewers,
        totalViews: totalViews || 0,
        likes: likes || 0,
        shares: shares || 0
      },
      isLiked
    });
  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get auction winner details
export const getAuctionWinner = async (req, res) => {
  try {
    const { id } = req.params;

    // Get auction with winner info
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id, status, winner_user_id, winning_bid_id, final_price, reserve_price, products_id')
      .eq('auction_id', id)
      .single();

    if (auctionError) throw auctionError;

    if (auction.status !== 'ended') {
      return res.status(400).json({
        error: 'Auction has not ended yet',
        status: auction.status
      });
    }

    if (!auction.winner_user_id || !auction.winning_bid_id) {
      return res.json({
        has_winner: false,
        message: 'No winner for this auction'
      });
    }

    // Get winning bid details with bidder info
    const { data: winningBid, error: bidError } = await supabase
      .from('Bids')
      .select('bid_id, bid_amount, placed_at, user_id, bidder:User(user_id, Fname, Lname, Avatar, email)')
      .eq('bid_id', auction.winning_bid_id)
      .single();

    if (bidError) throw bidError;

    // Get product details
    const { data: productData } = await supabase
      .from('vw_product_details')
      .select('*')
      .eq('products_id', auction.products_id)
      .maybeSingle();

    // Find associated order
    const { data: orderData } = await supabase
      .from('Orders')
      .select('order_id, status, total_amount, placed_at')
      .eq('user_id', auction.winner_user_id)
      .eq('order_type', 'auction')
      .order('placed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const winnerName = winningBid.bidder ?
      `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
      winningBid.bidder.email?.split('@')[0] : 'Winner';

    res.json({
      has_winner: true,
      auction_id: auction.auction_id,
      winner: {
        user_id: winningBid.user_id,
        name: winnerName,
        avatar: winningBid.bidder?.Avatar || null,
        email: winningBid.bidder?.email
      },
      winning_bid: {
        bid_id: winningBid.bid_id,
        amount: winningBid.bid_amount,
        placed_at: winningBid.placed_at
      },
      product: {
        product_id: auction.products_id,
        name: productData?.name || 'Unknown Product',
        images: productData?.images || []
      },
      order: orderData ? {
        order_id: orderData.order_id,
        status: orderData.status,
        total_amount: orderData.total_amount,
        placed_at: orderData.placed_at
      } : null,
      reserve_met: auction.final_price >= (auction.reserve_price || 0)
    });
  } catch (err) {
    console.error('Get auction winner error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all bids for an auction
export const getAuctionBids = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: bids, error } = await supabase
      .from('Bids')
      .select('bid_id, bid_amount, placed_at, user_id, bidder:User(user_id, Fname, Lname, Avatar, email)')
      .eq('auction_id', id)
      .order('bid_amount', { ascending: false });

    if (error) throw error;

    res.json(bids || []);
  } catch (err) {
    console.error('Get auction bids error:', err);
    res.status(500).json({ error: err.message });
  }
};
