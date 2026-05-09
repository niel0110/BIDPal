import { supabase } from '../config/supabase.js';
import { VALUE_ADDED_SERVICE_FEES, recordValueAddedEarning } from '../services/revenueService.js';
import { createNotification } from './notificationsController.js';
import { createPaymentWindow } from '../services/violationService.js';

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

    // Auto-transition: end any scheduled auctions whose start_time has passed
    const nowTs = new Date();
    const { data: overdueAuctions } = await supabase
      .from('Auctions')
      .select('auction_id, products_id, seller_id, Seller(user_id)')
      .eq('seller_id', final_seller_id)
      .eq('status', 'scheduled')
      .lte('start_time', nowTs.toISOString());

    if (overdueAuctions && overdueAuctions.length > 0) {
      const overdueIds = overdueAuctions.map(a => a.auction_id);
      const overdueProductIds = overdueAuctions.map(a => a.products_id).filter(Boolean);
      await supabase.from('Auctions').update({ status: 'ended' }).in('auction_id', overdueIds);
      if (overdueProductIds.length > 0) {
        await supabase.from('Products').update({ status: 'inactive' }).in('products_id', overdueProductIds);
      }

      // Notify seller for each newly ended auction (deduplicated — cron job may already have sent it)
      for (const auction of overdueAuctions) {
        const sellerUserId = auction.Seller?.user_id;
        if (!sellerUserId) continue;
        const { data: existing } = await supabase
          .from('Notifications')
          .select('notification_id')
          .eq('user_id', sellerUserId)
          .eq('type', 'auction_overdue')
          .eq('reference_id', auction.auction_id)
          .maybeSingle();
        if (!existing) {
          const { data: prod } = await supabase
            .from('Products').select('name').eq('products_id', auction.products_id).maybeSingle();
          const productName = prod?.name || 'your item';
          await supabase.from('Notifications').insert([{
            user_id: sellerUserId,
            type: 'auction_overdue',
            payload: {
              auction_id: auction.auction_id,
              title: '⚠️ Auction Ended — Not Streamed',
              message: `"${productName}" was not streamed live and has been marked as Ended. You can reschedule it from My Auctions.`,
            },
            reference_id: auction.auction_id,
            reference_type: 'auction',
            created_at: new Date().toISOString(),
            read_at: '2099-12-31T23:59:59.000Z'
          }]);
        }
      }
    }

    // Build query to fetch auctions
    let query = supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'completed') {
        // 'completed' = successful auctions: had a winner (winner_user_id is set)
        query = query.in('status', ['ended', 'completed']).not('winner_user_id', 'is', null);
      } else if (status === 'ended') {
        // 'ended' = unsuccessful auctions: status=ended and no winner
        query = query.eq('status', 'ended').is('winner_user_id', null);
      } else {
        query = query.eq('status', status);
      }
    }

    // Add pagination (we'll apply it after search filtering for now)
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: auctionsData, error: auctionsError } = await query;

    if (auctionsError) {
      console.error('Error fetching auctions:', auctionsError);
      return res.status(500).json({ error: auctionsError.message || 'Failed to fetch auctions' });
    }

    if (!auctionsData || auctionsData.length === 0) {
      return res.json({ count: 0, data: [] });
    }

    // If search query is provided, first get matching product IDs
    let searchProductIds = null;
    if (search && search.trim()) {
      const searchLower = `%${search.toLowerCase().trim()}%`;
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
        try {
          // Try view first, fall back to Products table directly
          let productData = null;
          const { data: viewData, error: viewError } = await supabase
            .from('vw_product_details')
            .select('*')
            .eq('products_id', auction.products_id)
            .maybeSingle();

          if (!viewError && viewData) {
            productData = viewData;
          } else if (auction.products_id) {
            // Fallback: query Products + Product_Images directly
            const { data: prodData } = await supabase
              .from('Products')
              .select('products_id, name, description, Product_Images(image_url, is_primary)')
              .eq('products_id', auction.products_id)
              .maybeSingle();
            if (prodData) {
              productData = {
                ...prodData,
                images: prodData.Product_Images || []
              };
            }
          }

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
            live_started_at: auction.live_started_at || null,
            live_ended_at: auction.live_ended_at || null,
            winner_user_id: auction.winner_user_id || null,
            buy_now_price: auction.buy_now_price || 0,
            reserve_price: auction.reserve_price || 0,
            incremental_bid_step: auction.incremental_bid_step || 0,
            current_price: auction.current_price || auction.reserve_price || 0,
            final_price: auction.final_price || null,
            status: auction.status,
            product_status: productData?.status || 'active',
            availability: productData?.availability || 1,
            created_at: auction.created_at,
          };
        } catch (mapErr) {
          console.error('Error mapping auction', auction.auction_id, mapErr);
          return {
            auction_id: auction.auction_id,
            product_id: auction.products_id,
            product_name: 'Unknown Product',
            product_image: null,
            status: auction.status,
            created_at: auction.created_at,
          };
        }
      })
    );

    // Apply search filter if provided
    if (searchProductIds !== null) {
      transformedData = transformedData.filter(auction =>
        searchProductIds.has(auction.product_id)
      );
    }

    res.json({ count: transformedData.length, data: transformedData });
  } catch (err) {
    const msg = err?.message || err?.details || err?.hint || (typeof err === 'string' ? err : null) || JSON.stringify(err) || 'Unexpected server error';
    console.error('getSellerAuctions error:', JSON.stringify(err), err?.stack);
    res.status(500).json({ error: msg });
  }
};

// Get all active/scheduled auctions for discovery
export const getAllAuctions = async (req, res) => {
  try {
    const { status, sale_type, seller_id, limit = 50, offset = 0, category, search } = req.query;

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

    // sale_type is derived from buy_now_price (no DB column); filter here if requested
    if (sale_type === 'sale') {
      query = query.gt('buy_now_price', 0);
    } else if (sale_type === 'bid') {
      query = query.or('buy_now_price.eq.0,buy_now_price.is.null');
    }

    if (seller_id) {
      query = query.eq('seller_id', seller_id);
    }

    if (status) {
      if (status !== 'all') {
        query = query.eq('status', status);
      }
    } else {
      query = query.in('status', ['active', 'scheduled', 'completed']);
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: auctionsData, error: auctionsError } = await query;

    if (auctionsError) throw auctionsError;

    const auctionIds = auctionsData.map(a => a.auction_id);

    // Batch fetch: bid counts + reminder counts in parallel
    const [{ data: allBids }, { data: allReminders }] = await Promise.all([
      supabase.from('Bids').select('auction_id').in('auction_id', auctionIds),
      supabase.from('Notifications').select('payload').eq('type', 'auction_reminder')
    ]);

    // Build lookup maps in JS
    const bidCountMap = {};
    for (const b of allBids || []) {
      bidCountMap[b.auction_id] = (bidCountMap[b.auction_id] || 0) + 1;
    }
    const reminderCountMap = {};
    for (const n of allReminders || []) {
      const aid = n.payload?.auction_id;
      if (aid) reminderCountMap[aid] = (reminderCountMap[aid] || 0) + 1;
    }

    const getViewerCount = req.app.locals.getViewerCount || (() => 0);

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
        const bids_count = bidCountMap[auction.auction_id] || 0;
        const reminder_count = reminderCountMap[auction.auction_id] || 0;
        const live_viewers = auction.status === 'active' ? getViewerCount(auction.auction_id) : 0;

        const categoryStr = (productData?.categories || [])
          .map(c => c.category_name || '').join(' ');

        return {
          id: auction.auction_id,
          products_id: auction.products_id,
          seller_id: auction.seller_id,
          sale_type: auction.buy_now_price > 0 ? 'sale' : 'bid',
          title: productData?.name || 'Unknown Product',
          category: categoryStr,
          price: auction.buy_now_price || auction.reserve_price || 0,
          currentBid: auction.current_price || auction.reserve_price || 0,
          seller: auction.Seller?.store_name || 'Unknown Seller',
          seller_avatar: auction.Seller?.logo_url || auction.Seller?.User?.Avatar,
          seller_banner: auction.Seller?.banner_url,
          bids_count,
          reminder_count,
          live_viewers,
          timeLeft: auction.status === 'active' ? 'Active Now' : new Date(auction.start_time).toLocaleString(),
          image: primaryImage?.image_url || null,
          images: images.map(img => img.image_url).filter(Boolean),
          status: auction.status,
          product_status: productData?.status || 'active',
          availability: productData?.availability || 0,
        };
      })
    );

    const CATEGORY_KEYWORDS = {
      clothing:    ['cloth', 'shirt', 'dress', 'pants', 'wear', 'apparel', 'fashion', 'blouse', 'skirt', 'suit', 'jacket', 'coat', 'jeans'],
      shoes:       ['shoe', 'footwear', 'sneaker', 'boot', 'sandal', 'slipper', 'heel'],
      bags:        ['bag', 'purse', 'tote', 'pouch', 'backpack', 'luggage', 'satchel', 'handbag', 'clutch'],
      jewelry:     ['jewel', 'necklace', 'ring', 'watch', 'bracelet', 'gem', 'earring', 'pendant', 'luxury'],
      gadgets:     ['gadget', 'electron', 'phone', 'tablet', 'smartphone', 'laptop', 'computer', 'camera', 'gaming', 'headphone', 'audio', 'tv', 'charger', 'cable', 'tech'],
      appliances:  ['appliance', 'kitchen', 'laundry', 'refriger', 'vacuum', 'blender', 'oven', 'microwave'],
      furniture:   ['furniture', 'sofa', 'bed', 'dining', 'chair', 'storage', 'couch', 'decor', 'shelf', 'cabinet'],
      garden:      ['garden', 'plant', 'outdoor', 'lawn', 'tool', 'pot', 'soil'],
      instruments: ['instrument', 'music', 'guitar', 'piano', 'violin', 'drum', 'vinyl', 'bass', 'keyboard'],
    };

    // Filter by category and/or search on the assembled data
    let result = transformedData;
    if (category && category !== 'all') {
      const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [category.toLowerCase()];
      result = result.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return keywords.some(kw => cat.includes(kw));
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.seller?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    }

    // Exclude sold products for general discovery (unless seller is looking at their own items)
    if (!seller_id) {
      result = result.filter(a => a.product_status !== 'sold');
    }

    res.json({ count: result.length, data: result });
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
      reserve_price,
      buy_now_price,
      start_date,
      start_time,
      end_date,
      end_time,
      start_timestamp: client_start_timestamp,
      end_timestamp: client_end_timestamp,
      timezone = 'UTC',
      bid_increment,
      availability,
    } = req.body;

    // Validation
    if (!product_id || (!user_id && !seller_id)) {
      return res.status(400).json({ error: 'product_id and user_id/seller_id are required.' });
    }

    if (!client_start_timestamp && (!start_date || !start_time)) {
      return res.status(400).json({ error: 'start_date and start_time (or start_timestamp) are required.' });
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
        .select('products_id, seller_id, status, reserve_price, starting_price')
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

    // Combine date and time to ISO timestamp (fallback for old clients)
    let start_timestamp = client_start_timestamp;
    if (!start_timestamp) {
      const startDateTimeStr = `${start_date}T${start_time}:00`;
      start_timestamp = new Date(startDateTimeStr).toISOString();
    }

    let end_timestamp = client_end_timestamp;
    if (!end_timestamp) {
      if (end_date && end_time) {
        const endDateTimeStr = `${end_date}T${end_time}:00`;
        end_timestamp = new Date(endDateTimeStr).toISOString();
      } else {
        // Default: end at 23:59:59 of the same day as the start
        const d = new Date(start_timestamp);
        d.setHours(23, 59, 59, 0);
        end_timestamp = d.toISOString();
      }
    }

    const isBid = sale_type === 'bid';
    const startingBidAmount = parseFloat(starting_bid ?? productData.starting_price ?? 0) || 0;
    const reserveLimit = parseFloat(reserve_price ?? productData.reserve_price ?? startingBidAmount) || 0;
    const requestBidStep = parseFloat(bid_increment);
    const bidStep = Number.isFinite(requestBidStep) && requestBidStep > 0 ? requestBidStep : 0;

    if (isBid && reserveLimit > 0 && startingBidAmount > reserveLimit) {
      return res.status(400).json({ error: 'Starting bid cannot exceed the seller reserve price limit.' });
    }

    if (isBid && (!bidStep || bidStep <= 0)) {
      return res.status(400).json({ error: 'Bid increment is required and must be greater than 0.' });
    }

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
          reserve_price: isBid ? reserveLimit : 0,
          current_price: isBid ? startingBidAmount : 0,
          incremental_bid_step: isBid ? bidStep : 0,
          status: isBid ? 'scheduled' : 'active',
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

    // Update Product status and availability
    await supabase
      .from('Products')
      .update({ 
        status: isBid ? 'scheduled' : 'active',
        availability: availability !== undefined ? parseInt(availability) : 1
      })
      .eq('products_id', product_id);

    res.status(201).json({ message: 'Auction scheduled successfully', auction_id: auctionData.auction_id });
  } catch (err) {
    console.error('Unexpected error scheduling auction:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/auctions/:id
 * Update a scheduled auction without creating a new auction row.
 */
export const updateScheduledAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      start_date,
      start_time,
      end_date,
      end_time,
      start_timestamp: client_start_timestamp,
      end_timestamp: client_end_timestamp,
    } = req.body;
    const user_id = req.user?.user_id;

    if (!user_id) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { data: auction, error: fetchError } = await supabase
      .from('Auctions')
      .select('auction_id, status, products_id, seller_id, Seller(user_id)')
      .eq('auction_id', id)
      .maybeSingle();

    if (fetchError || !auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    if (auction.Seller?.user_id && auction.Seller.user_id !== user_id) {
      return res.status(403).json({ error: 'You do not have permission to edit this auction.' });
    }

    if (auction.status !== 'scheduled') {
      return res.status(400).json({ error: `Only scheduled auctions can be edited (current status: ${auction.status}).` });
    }

    let nextStartTime = client_start_timestamp;
    if (!nextStartTime) {
      if (!start_date || !start_time) {
        return res.status(400).json({ error: 'start_date and start_time (or start_timestamp) are required.' });
      }
      nextStartTime = new Date(`${start_date}T${start_time}:00`).toISOString();
    }

    if (Number.isNaN(new Date(nextStartTime).getTime())) {
      return res.status(400).json({ error: 'Invalid start date or time.' });
    }

    if (new Date(nextStartTime) <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future.' });
    }

    let nextEndTime = client_end_timestamp;
    if (!nextEndTime) {
      if (end_date && end_time) {
        nextEndTime = new Date(`${end_date}T${end_time}:00`).toISOString();
      } else {
        const d = new Date(nextStartTime);
        d.setHours(23, 59, 59, 0);
        nextEndTime = d.toISOString();
      }
    }

    if (Number.isNaN(new Date(nextEndTime).getTime())) {
      return res.status(400).json({ error: 'Invalid end date or time.' });
    }

    if (new Date(nextEndTime) <= new Date(nextStartTime)) {
      return res.status(400).json({ error: 'End time must be after the scheduled start time.' });
    }

    const { data: updatedAuction, error: updateError } = await supabase
      .from('Auctions')
      .update({
        start_time: nextStartTime,
        end_time: nextEndTime,
      })
      .eq('auction_id', id)
      .eq('status', 'scheduled')
      .select('auction_id, start_time, end_time, status')
      .single();

    if (updateError) {
      throw updateError;
    }

    if (auction.products_id) {
      await supabase
        .from('Products')
        .update({ status: 'scheduled' })
        .eq('products_id', auction.products_id);
    }

    res.json({
      success: true,
      message: 'Auction updated successfully.',
      data: updatedAuction,
    });
  } catch (err) {
    console.error('updateScheduledAuction error:', err);
    res.status(500).json({ error: err.message });
  }
};
// Start a scheduled auction
export const startAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterUserId = req.user?.user_id || req.user?.id;

    if (!requesterUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { data: existingAuction, error: lookupError } = await supabase
      .from('Auctions')
      .select('auction_id, products_id, buy_now_price, status, seller_id')
      .eq('auction_id', id)
      .single();

    if (lookupError || !existingAuction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const { data: sellerRow } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', requesterUserId)
      .maybeSingle();

    if (!sellerRow?.seller_id || String(sellerRow.seller_id) !== String(existingAuction.seller_id)) {
      return res.status(403).json({ error: 'You do not have permission to start this auction.' });
    }

    if (Number(existingAuction.buy_now_price || 0) > 0) {
      return res.status(400).json({ error: 'Fixed-price items cannot be started as live auctions.' });
    }

    if (existingAuction.status !== 'scheduled') {
      return res.status(400).json({ error: `Only scheduled auctions can be started (current status: ${existingAuction.status}).` });
    }

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
      .or('buy_now_price.eq.0,buy_now_price.is.null')
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
    const requesterUserId = req.user?.user_id || req.user?.id;

    if (!requesterUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

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

    if (!currentAuction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    if (String(currentAuction.Seller?.user_id) !== String(requesterUserId)) {
      return res.status(403).json({ error: 'You do not have permission to end this auction.' });
    }

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
    const normalizedReservePrice = Number(currentAuction?.reserve_price ?? auction.reserve_price ?? 0) || 0;

    if (winningBid) {
      const winningBidAmount = Number(winningBid.bid_amount || 0);

      // No reserve (0/null) means the highest valid bid wins automatically.
      if (normalizedReservePrice <= 0 || winningBidAmount >= normalizedReservePrice) {
        productStatus = 'sold';
        reserveMet = true;
      } else {
        productStatus = 'inactive'; // Reserve not met
        console.log(`⚠️ Reserve price not met. Winning bid: ${winningBid.bid_amount}, Reserve: ${normalizedReservePrice}`);
      }
    }

    // Update Product status and availability
    await supabase
      .from('Products')
      .update({ 
        status: productStatus,
        availability: productStatus === 'sold' ? 0 : auction.availability 
      })
      .eq('products_id', auction.products_id);

    // 5. Create notifications and order if there's a winner and reserve is met
    let orderId = null;
    let winnerOrderId = null;

    if (winningBid && reserveMet) {
      console.log('✅ Creating order for winner...');

      // Get product details for the order
      const { data: productData } = await supabase
        .from('vw_product_details')
        .select('*')
        .eq('products_id', auction.products_id)
        .maybeSingle();

      // Guard: skip if order already exists for this auction (idempotent)
      const { data: existingOrder } = await supabase
        .from('Orders')
        .select('order_id')
        .eq('auction_id', id)
        .eq('user_id', winningBid.user_id)
        .maybeSingle();

      let orderData = existingOrder;
      let orderError = null;

      if (!existingOrder) {
        // Create order for the winner
        const result = await supabase
          .from('Orders')
          .insert([{
            user_id: winningBid.user_id,
            seller_id: auction.seller_id,
            total_amount: winningBid.bid_amount,
            status: 'pending_payment',
            order_type: 'auction',
            auction_id: id
          }])
          .select('order_id')
          .single();
        orderData = result.data;
        orderError = result.error;
      } else {
        console.log(`ℹ️ Order already exists for auction ${id}: ${existingOrder.order_id}`);
      }

      if (orderError) {
        console.error('❌ ERROR creating order:', orderError);
        console.error('Order data attempted:', {
          user_id: winningBid.user_id,
          total_amount: winningBid.bid_amount,
          status: 'pending_payment',
          order_type: 'auction',
          auction_id: id
        });
        const isMissingAddressConstraint =
          /shipping_address_id/i.test(orderError.message || '') ||
          /Orders_shipping_address_id_fkey/i.test(orderError.message || '');

        if (!isMissingAddressConstraint) {
          throw new Error(orderError.message || 'Failed to create winner order.');
        }

        console.warn(`⚠️ Skipping immediate Orders row for auction ${id}; winner must complete checkout first.`);
        winnerOrderId = `pending_${id}`;
      } else {
        orderId = orderData.order_id;
        winnerOrderId = orderId;
        console.log(`✅ Order created successfully: ${orderId}`);

        // Create order item (only if none exists yet)
        const { data: existingItem } = await supabase
          .from('Order_items')
          .select('order_item_id')
          .eq('order_id', orderId)
          .maybeSingle();

        if (!existingItem) {
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

        // Create a 24-hour payment window for the winner
        try {
          await createPaymentWindow(id, winningBid.user_id, new Date().toISOString());
        } catch (pwErr) {
          console.warn('Payment_Windows insert skipped:', pwErr.message);
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
          payload: {
            title: `Auction Ended: Congratulations! You are the highest bidder with a bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')}.`,
            message: `Auction Ended: Congratulations! You are the highest bidder with a bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')}. Please proceed to Orders to process your payment.`,
            order_id: winnerOrderId,
            auction_id: id,
            product_id: auction.products_id,
            product_name: productData?.name
          },
          reference_id: id,
          reference_type: 'auction',
          read_at: '2099-12-31T23:59:59.000Z'
        }])
        .select();

      if (winnerNotifError) {
        console.error('❌ Failed to create winner notification:', winnerNotifError);
      } else {
        console.log(`🔔 Winner notification sent to user ${winningBid.user_id}`, winnerNotif);
      }

      const { data: otherBidders } = await supabase
        .from('Bids')
        .select('user_id')
        .eq('auction_id', id)
        .neq('user_id', winningBid.user_id);

      const loserIds = [...new Set((otherBidders || []).map(bid => bid.user_id).filter(Boolean))];
      if (loserIds.length > 0) {
        const loserNotifs = loserIds.map(userId => ({
          user_id: userId,
          type: 'auction_ended',
          payload: {
            title: `Auction Ended: Better luck next time! The winning price was ₱${winningBid.bid_amount.toLocaleString('en-PH')}.`,
            message: `Auction Ended: Better luck next time! The winning price was ₱${winningBid.bid_amount.toLocaleString('en-PH')}.`,
            auction_id: id,
            product_id: auction.products_id,
            product_name: productData?.name,
            winning_amount: winningBid.bid_amount,
            order_id: winnerOrderId
          },
          reference_id: id,
          reference_type: 'auction',
          read_at: '2099-12-31T23:59:59.000Z'
        }));

        const { error: loserNotifError } = await supabase
          .from('Notifications')
          .insert(loserNotifs);

        if (loserNotifError) {
          console.error('❌ Failed to create non-winner notifications:', loserNotifError);
        }
      }

      // Get seller info and notify seller about the sale
      const sellerUserId = currentAuction?.Seller?.user_id;

      if (sellerUserId) {
        const { data: sellerNotif, error: sellerNotifError } = await supabase
        .from('Notifications')
        .insert([{
          user_id: sellerUserId,
          type: 'auction_sold',
          payload: {
            title: `Auction Ended: ${winnerName} won with a bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')}`,
            message: `"${productData?.name}" has a winner. Review the auction results and continue order processing.`,
            order_id: winnerOrderId,
            auction_id: id,
            product_id: auction.products_id,
            winner_user_id: winningBid.user_id
          },
            reference_id: id,
            reference_type: 'auction',
            read_at: '2099-12-31T23:59:59.000Z'
          }])
          .select();

        if (sellerNotifError) {
          console.error('❌ Failed to create seller notification:', sellerNotifError);
        } else {
          console.log(`🔔 Seller notification sent to user ${sellerUserId}`, sellerNotif);
        }
      }
    } else if (winningBid && !reserveMet) {
      // Fetch product name for richer notification message
      const { data: noSaleProduct } = await supabase
        .from('vw_product_details')
        .select('name')
        .eq('products_id', auction.products_id)
        .maybeSingle();
      const noSaleProductName = noSaleProduct?.name || 'the auction item';

      // Notify buyer (highest bidder) that reserve wasn't met
      await supabase
        .from('Notifications')
        .insert([{
          user_id: winningBid.user_id,
          type: 'auction_reserve_not_met',
          payload: {
            title: 'Auction ended — Reserve not met',
            message: `The auction ended but the reserve price was not met. Your highest bid was ₱${winningBid.bid_amount.toLocaleString('en-PH')}.`,
            auction_id: id,
            product_id: auction.products_id,
            product_name: noSaleProductName
          },
          reference_id: id,
          reference_type: 'auction',
          read_at: '2099-12-31T23:59:59.000Z'
        }]);

      // Notify seller that their auction ended without meeting reserve
      const sellerUserIdNoSale = currentAuction?.Seller?.user_id;
      if (sellerUserIdNoSale) {
        await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserIdNoSale,
            type: 'auction_no_sale',
            payload: {
              title: 'Auction ended — Reserve not met',
              message: `"${noSaleProductName}" ended with a highest bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')} which did not meet your reserve price. You may reschedule or relist the item.`,
              auction_id: id,
              product_id: auction.products_id,
              product_name: noSaleProductName
            },
            reference_id: id,
            reference_type: 'auction',
            read_at: '2099-12-31T23:59:59.000Z'
          }]);
      }
    } else {
      // No bids placed — notify seller
      const { data: noBidsProduct } = await supabase
        .from('vw_product_details')
        .select('name')
        .eq('products_id', auction.products_id)
        .maybeSingle();
      const noBidsProductName = noBidsProduct?.name || 'the auction item';

      const sellerUserIdNoBids = currentAuction?.Seller?.user_id;
      if (sellerUserIdNoBids) {
        await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserIdNoBids,
            type: 'auction_no_sale',
            payload: {
              title: 'Auction ended — No bids placed',
              message: `"${noBidsProductName}" auction ended with no bids. You may reschedule or relist the item.`,
              auction_id: id,
              product_id: auction.products_id,
              product_name: noBidsProductName
            },
            reference_id: id,
            reference_type: 'auction',
            read_at: '2099-12-31T23:59:59.000Z'
          }]);
      }
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
        order_id: winnerOrderId
      } : null;

      req.app.locals.io.to(`auction:${id}`).emit('auction-ended', {
        auction_id: id,
        winner: winnerInfo,
        final_price: winningBid?.bid_amount || 0,
        product_status: productStatus,
        reserve_met: reserveMet,
        has_winner: !!(winningBid && reserveMet),
        has_bids: !!winningBid,
        reserve_price: normalizedReservePrice,
        highest_bidder: winningBid ? {
          user_id: winningBid.user_id,
          bid_amount: winningBid.bid_amount,
          bidder_name: winningBid.bidder
            ? `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
              winningBid.bidder.email?.split('@')[0] || 'Bidder'
            : 'Bidder'
        } : null
      });

      console.log('📡 Broadcast auction-ended event');
    }

    console.log(`✅ Auction ${id} ended successfully`);

    const bidderName = winningBid?.bidder
      ? `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
        winningBid.bidder.email?.split('@')[0] || 'Bidder'
      : 'Bidder';

    res.json({
      success: true,
      message: 'Auction ended successfully',
      data: auction,
      auction_id: id,
      winner: winningBid && reserveMet ? {
        user_id: winningBid.user_id,
        bid_amount: winningBid.bid_amount,
        bid_id: winningBid.bid_id,
        order_id: winnerOrderId,
        bidder_name: bidderName,
        bidder_avatar: winningBid.bidder?.Avatar || null
      } : null,
      has_bids: !!winningBid,
      highest_bidder: winningBid ? {
        user_id: winningBid.user_id,
        bid_amount: winningBid.bid_amount,
        bidder_name: bidderName
      } : null,
      reserve_price: normalizedReservePrice,
      product_status: productStatus,
      reserve_met: reserveMet,
      has_winner: !!(winningBid && reserveMet)
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

    const now = new Date();

    // Auto-transition: scheduled → active when start_time passes
    if (auction.status === 'scheduled' && auction.start_time && new Date(auction.start_time) <= now) {
      const { data: updated } = await supabase
        .from('Auctions')
        .update({ status: 'active', start_time: now.toISOString() })
        .eq('auction_id', id)
        .select()
        .maybeSingle();
      if (updated) Object.assign(auction, updated);
    }

    // Auto-expire: active → ended if end_time has passed
    if (auction.status === 'active' && auction.end_time && new Date(auction.end_time) <= now) {
      const { data: updated } = await supabase
        .from('Auctions')
        .update({ status: 'ended' })
        .eq('auction_id', id)
        .select()
        .maybeSingle();
      if (updated) Object.assign(auction, updated);
    }

    // Get product details — use view, then enrich with all images directly
    const { data: productData } = await supabase
      .from('vw_product_details')
      .select('*')
      .eq('products_id', auction.products_id)
      .maybeSingle();

    // Always fetch images directly from Product_Images to ensure all are returned
    const { data: rawImages } = await supabase
      .from('Product_Images')
      .select('image_url, is_primary')
      .eq('products_id', auction.products_id)
      .order('is_primary', { ascending: false });

    const allImages = (rawImages || []).map(img => ({ image_url: img.image_url, is_primary: img.is_primary }));

    const result = {
      ...auction,
      product: productData ? { ...productData, images: allImages } : { images: allImages },
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
      .select('auction_id, products_id, reserve_price, current_price, incremental_bid_step, status')
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

    // Anti-bogus: check if buyer is suspended/banned or has restrictions
    const { data: restriction } = await supabase
      .from('Account_Restrictions')
      .select('restriction_type, reason')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .in('restriction_type', ['bidding_disabled', 'suspended', 'banned'])
      .maybeSingle();

    if (restriction) {
      return res.status(403).json({
        error: restriction.restriction_type === 'banned'
          ? 'Your account has been permanently banned from bidding.'
          : 'Your bidding privileges are temporarily suspended. Please check your account status.',
        restriction_type: restriction.restriction_type
      });
    }

    let startingPriceFallback = 0;
    if (auction.current_price == null && auction.products_id) {
      const { data: productForPrice } = await supabase
        .from('Products')
        .select('starting_price')
        .eq('products_id', auction.products_id)
        .maybeSingle();
      startingPriceFallback = parseFloat(productForPrice?.starting_price || 0);
    }

    // Use current_price from Auctions table (kept up-to-date by DB trigger)
    const currentPrice = parseFloat(auction.current_price ?? startingPriceFallback ?? 0);
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

    const reserveLimit = parseFloat(auction.reserve_price || 0);
    if (reserveLimit > 0 && bidAmount > reserveLimit) {
      return res.status(400).json({
        error: `Bid cannot exceed the reserve price limit of ₱${reserveLimit.toLocaleString('en-PH')}`,
        bidLimit: reserveLimit,
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

    const bidEventPayload = {
      bid_id: bid.bid_id,
      user_id,
      bidder_name: fullName,
      bidder_avatar: userData?.Avatar || null,
      amount: bid.bid_amount,
      placed_at: bid.placed_at,
      timestamp: bid.placed_at,
      timeAgo: 'Just now',
      currentHighestBid: bidAmount,
      minNextBid,
      bidIncrement: step,
    };

    if (req.app.locals.io) {
      req.app.locals.io.to(`auction:${id}`).emit('bid-update', bidEventPayload);
    }

    // Return formatted bid data with user information and next minimum bid
    res.status(201).json({
      success: true,
      bid_id: bid.bid_id,
      user_id: user_id,
      amount: bid.bid_amount,
      placed_at: bid.placed_at,
      bidder_name: fullName,
      bidder_avatar: userData?.Avatar || null,
      bidIncrement: step,
      minNextBid,
      currentHighestBid: bidAmount,
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
        viewers: liveViewers,
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
    const requesterUserId = req.user?.user_id || req.user?.id;

    // Get auction with winner info
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id, status, winner_user_id, winning_bid_id, final_price, reserve_price, products_id, seller_id')
      .eq('auction_id', id)
      .single();

    if (auctionError) throw auctionError;

    if (!requesterUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: sellerRow } = await supabase
      .from('Seller')
      .select('seller_id')
      .eq('user_id', requesterUserId)
      .maybeSingle();

    const isSellerOwner = Boolean(sellerRow?.seller_id && String(sellerRow.seller_id) === String(auction.seller_id));
    const isAuctionWinner = Boolean(auction.winner_user_id && String(auction.winner_user_id) === String(requesterUserId));

    if (!isSellerOwner && !isAuctionWinner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!['ended', 'completed'].includes(auction.status)) {
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

    // Find associated order — match by auction_id for accuracy
    // Use select('*') so missing optional columns don't break the query
    const { data: orderData, error: orderFetchError } = await supabase
      .from('Orders')
      .select('*')
      .eq('auction_id', id)
      .maybeSingle();
    if (orderFetchError) console.error('Order fetch error in getAuctionWinner:', orderFetchError.message);
    const resolvedOrderData = orderData || {
      order_id: `pending_${id}`,
      status: 'pending_payment',
      total_amount: auction.final_price,
      placed_at: null,
      tracking_number: null,
      courier: null,
      payment_confirmed: false,
      payment_confirmed_at: null,
    };

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
      order: {
        order_id:             resolvedOrderData.order_id,
        status:               resolvedOrderData.status,
        total_amount:         resolvedOrderData.total_amount,
        placed_at:            resolvedOrderData.placed_at,
        tracking_number:      resolvedOrderData.tracking_number   || null,
        courier:              resolvedOrderData.courier            || null,
        payment_confirmed:    resolvedOrderData.payment_confirmed  ?? false,
        payment_confirmed_at: resolvedOrderData.payment_confirmed_at || null,
      },
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

/**
 * Delete an auction (only allowed if it has no associated orders)
 */
export const deleteAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteProduct } = req.query; // Check if user also wants to delete the product

    console.log(`🗑️ Deleting auction: ${id} (deleteProduct: ${deleteProduct})`);

    // 1. Fetch auction details
    const { data: auction, error: fetchError } = await supabase
      .from('Auctions')
      .select('status, products_id')
      .eq('auction_id', id)
      .maybeSingle();

    if (fetchError || !auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // 2. Check for Orders - Critical guard rail
    const { data: hasOrder } = await supabase
        .from('Orders')
        .select('order_id')
        .eq('auction_id', id)
        .maybeSingle();

    if (hasOrder) {
        return res.status(400).json({ error: 'This auction has an associated order. It cannot be deleted from records.' });
    }

    // 3. Deep cascading cleanup of metadata
    console.log(`📦 Cleaning up metadata for auction: ${id}`);
    
    // Break circular reference if any
    await supabase
        .from('Auctions')
        .update({ winning_bid_id: null })
        .eq('auction_id', id);

    await Promise.all([
        supabase.from('Bids').delete().eq('auction_id', id),
        supabase.from('Auction_Likes').delete().eq('auction_id', id),
        supabase.from('Auction_Shares').delete().eq('auction_id', id),
        supabase.from('Auction_Views').delete().eq('auction_id', id),
        supabase.from('Live_Comments').delete().eq('auction_id', id),
        supabase.from('Live_stream').delete().eq('auction_id', id),
        supabase.from('Auction_winners').delete().eq('auction_id', id),
        supabase.from('Auction_schedules').delete().eq('auction_id', id),
        supabase.from('Notifications').delete().eq('reference_id', id).eq('reference_type', 'auction'),
        // Cleanup violation-related data if any
        supabase.from('payment_windows').delete().eq('auction_id', id),
        supabase.from('Order_Cancellations').delete().eq('auction_id', id),
        supabase.from('Seller_Reports').delete().eq('auction_id', id)
    ]);

    // 4. Delete the Auction itself
    const { error: deleteError } = await supabase
      .from('Auctions')
      .delete()
      .eq('auction_id', id);

    if (deleteError) {
      console.error('❌ Error deleting auction record:', deleteError);
      return res.status(500).json({ error: `System Error: ${deleteError.message}` });
    }

    let productDeleted = false;
    let message = 'Auction and all associated data permanently removed.';

    // 5. Handle Product (Back to draft or delete)
    if (auction.products_id) {
        if (deleteProduct === 'true') {
            // Delete the product as well
            console.log(`📦 User requested to delete product ${auction.products_id} as well.`);
            
            // Re-using product cleanup logic
            const { data: hasOrderProduct } = await supabase
              .from('Order_items')
              .select('orderItem_id')
              .eq('products_id', auction.products_id)
              .maybeSingle();

            if (!hasOrderProduct) {
                await Promise.all([
                    supabase.from('Cart_items').delete().eq('product_id', auction.products_id),
                    supabase.from('Product_Categories').delete().eq('products_id', auction.products_id),
                    supabase.from('Product_Images').delete().eq('products_id', auction.products_id)
                ]);
                
                await supabase.from('Products').delete().eq('products_id', auction.products_id);
                productDeleted = true;
                message = 'Auction, Product, and all associated history permanently removed.';
            } else {
                message = 'Auction removed, but Product remains because it was part of previous sales.';
            }
        } else {
            // Move back to draft
            await supabase
                .from('Products')
                .update({ status: 'draft' })
                .eq('products_id', auction.products_id);
            message = 'Auction removed. Product has been moved back to drafts.';
        }
    }

    res.json({ 
        success: true, 
        message,
        productDeleted
    });
  } catch (err) {
    console.error('🔥 Unexpected error in deleteAuction:', err);
    res.status(500).json({ error: 'Internal server error occurred during deletion.' });
  }
};

// ── Helper: fetch all auction_reminder notifications for a user, filter in JS ─
// We avoid JSONB .contains() queries because PostgREST JSONB containment
// is unreliable for lookup; instead we pull all of the user's auction reminders
// and match client-side.
const getUserReminders = async (user_id) => {
  const { data } = await supabase
    .from('Notifications')
    .select('notification_id, payload')
    .eq('user_id', user_id)
    .eq('type', 'auction_reminder');
  return data || [];
};

// Count all reminders for a given auction across all users (pull & filter in JS)
const countReminders = async (auctionId) => {
  const { data } = await supabase
    .from('Notifications')
    .select('payload')
    .eq('type', 'auction_reminder');
  return (data || []).filter(n => n.payload?.auction_id === auctionId).length;
};

/**
 * GET /api/auctions/:id/reminder-count
 */
export const getAuctionReminderCount = async (req, res) => {
  try {
    const count = await countReminders(req.params.id);
    return res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/auctions/:id/remind
 * Check whether the current user already set a reminder.
 */
export const checkAuctionReminder = async (req, res) => {
  try {
    const { id } = req.params;
    // Always read user_id from the verified JWT — never trust the client-supplied value
    const user_id = req.user?.user_id;
    if (!user_id) return res.status(401).json({ error: 'Not authenticated' });

    const reminders = await getUserReminders(user_id);
    const exists = reminders.some(n => n.payload?.auction_id === id);
    return res.json({ reminder_set: exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/auctions/:id/remind
 * Save buyer reminder, notify seller, broadcast count via Socket.IO.
 */
export const setAuctionReminder = async (req, res) => {
  try {
    const { id } = req.params;
    // Always read user_id from the verified JWT — never trust the client-supplied value
    const user_id = req.user?.user_id;
    if (!user_id) return res.status(401).json({ error: 'Not authenticated' });

    // Fetch auction
    const { data: auction, error: auctionErr } = await supabase
      .from('Auctions')
      .select('auction_id, start_time, products_id, status, seller_id')
      .eq('auction_id', id)
      .maybeSingle();

    if (auctionErr) throw auctionErr;
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status !== 'scheduled') return res.status(400).json({ error: 'Auction is no longer scheduled' });

    // Check duplicate (client-side filter — avoids JSONB contains quirks)
    const existingReminders = await getUserReminders(user_id);
    const alreadySet = existingReminders.some(n => n.payload?.auction_id === id);
    if (alreadySet) {
      const count = await countReminders(id);
      return res.json({ success: true, already_set: true, reminderCount: count });
    }

    // Fetch product name and buyer name (non-critical, failures won't block the reminder)
    const [{ data: product }, { data: buyer }] = await Promise.all([
      supabase.from('Products').select('name').eq('products_id', auction.products_id).maybeSingle(),
      supabase.from('User').select('Fname, Lname').eq('user_id', user_id).maybeSingle()
    ]);

    const productName = product?.name || 'an auction';
    const buyerName = buyer ? `${buyer.Fname || ''} ${buyer.Lname || ''}`.trim() || 'A buyer' : 'A buyer';
    const startFormatted = new Date(auction.start_time).toLocaleString('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Save buyer reminder — insert directly so errors are not swallowed
    const { error: insertError } = await supabase
      .from('Notifications')
      .insert([{
        user_id,
        type: 'auction_reminder',
        payload: {
          auction_id: id,
          title: '🔔 Reminder Set!',
          message: `We'll notify you before "${productName}" starts on ${startFormatted}.`
        },
        created_at: new Date().toISOString(),
        read_at: '2099-12-31T23:59:59.000Z' // far-future = unread sentinel
      }]);

    if (insertError) {
      console.error('Notification insert failed:', JSON.stringify(insertError));
      return res.status(500).json({ error: `DB insert failed: ${insertError.message || insertError.code || JSON.stringify(insertError)}` });
    }

    const newCount = await countReminders(id);

    // Notify seller (non-blocking — a failure here should not fail the request)
    try {
      const { data: seller } = await supabase
        .from('Seller')
        .select('user_id')
        .eq('seller_id', auction.seller_id)
        .maybeSingle();

      if (seller?.user_id) {
        await createNotification(seller.user_id, 'auction_interest', {
          auction_id: id,
          title: '👥 New Buyer Interested',
          message: `${buyerName} set a reminder for "${productName}". Total interested: ${newCount}.`
        });
      }
    } catch (sellerErr) {
      console.error('Seller notification error (non-fatal):', sellerErr);
    }

    // Broadcast real-time count to the auction room
    const io = req.app.locals.io;
    if (io) io.to(`auction:${id}`).emit('reminder-count-update', { auction_id: id, count: newCount });

    return res.json({ success: true, already_set: false, reminderCount: newCount });
  } catch (err) {
    console.error('setAuctionReminder error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/auctions/:id/promoted
 * Check whether the authenticated seller already promoted this auction.
 */
export const checkAuctionPromoted = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.user_id;
    if (!user_id) return res.status(401).json({ error: 'Not authenticated' });

    const { data } = await supabase
      .from('Notifications')
      .select('notification_id')
      .eq('user_id', user_id)
      .eq('type', 'auction_promoted')
      .eq('reference_id', id)
      .maybeSingle();

    return res.json({ promoted: !!data });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Server error' });
  }
};

/**
 * POST /api/auctions/:id/reschedule
 * Reschedule a never-went-live ended auction to a new start_time.
 */
export const rescheduleAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, bid_increment } = req.body;
    const user_id = req.user?.user_id;

    if (!start_time) {
      return res.status(400).json({ error: 'start_time is required.' });
    }
    if (new Date(start_time) <= new Date()) {
      return res.status(400).json({ error: 'New schedule time must be in the future.' });
    }

    const { data: auction, error: fetchErr } = await supabase
      .from('Auctions')
      .select('auction_id, status, live_started_at, winner_user_id, products_id, seller_id, Seller(user_id)')
      .eq('auction_id', id)
      .maybeSingle();

    if (fetchErr || !auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    // Only allow rescheduling auctions that had no successful winner
    const isReschedulable = ['ended', 'completed'].includes(auction.status) && !auction.winner_user_id;
    if (!isReschedulable) {
      if (!['ended', 'completed'].includes(auction.status)) {
        return res.status(400).json({ error: `Cannot reschedule an auction with status "${auction.status}".` });
      }
      return res.status(400).json({ error: 'This auction had a winner and cannot be rescheduled.' });
    }

    // Verify seller ownership
    if (user_id && auction.Seller?.user_id && user_id !== auction.Seller.user_id) {
      return res.status(403).json({ error: 'You do not have permission to reschedule this auction.' });
    }

    // Default end_time to end of day of start_time
    let newEndTime = end_time;
    if (!newEndTime) {
      const d = new Date(start_time);
      d.setHours(23, 59, 59, 0);
      newEndTime = d.toISOString();
    }

    const updateData = {
      status: 'scheduled',
      start_time,
      end_time: newEndTime,
      // Clear winner fields so the auction is treated as fresh
      winner_user_id: null,
      winning_bid_id: null,
      final_price: null,
      live_started_at: null,
      live_ended_at: null,
    };
    if (bid_increment && parseFloat(bid_increment) > 0) {
      updateData.incremental_bid_step = parseFloat(bid_increment);
    }

    const { error: updateErr } = await supabase
      .from('Auctions')
      .update(updateData)
      .eq('auction_id', id);

    if (updateErr) throw updateErr;

    // Reset auction activity so a rescheduled stream starts clean with no stale
    // bids, bidders, live chat, or engagement stats from the previous session.
    const cleanupTasks = [
      supabase.from('Bids').delete().eq('auction_id', id),
      supabase.from('Live_Comments').delete().eq('auction_id', id),
      supabase.from('Auction_Likes').delete().eq('auction_id', id),
      supabase.from('Auction_Shares').delete().eq('auction_id', id),
      supabase.from('Auction_Views').delete().eq('auction_id', id),
      supabase.from('Auction_winners').delete().eq('auction_id', id),
      supabase.from('Payment_Windows').delete().eq('auction_id', id),
      supabase.from('Order_Cancellations').delete().eq('auction_id', id),
    ];

    const cleanupResults = await Promise.allSettled(cleanupTasks);
    const cleanupErrors = cleanupResults.flatMap(result => {
      if (result.status === 'rejected') {
        return [result.reason?.message || 'Unknown cleanup failure'];
      }
      return result.value?.error ? [result.value.error.message] : [];
    });

    if (cleanupErrors.length > 0) {
      throw new Error(`Auction was rescheduled but cleanup failed: ${cleanupErrors.join('; ')}`);
    }

    // Reset product status back to scheduled and restore availability
    if (auction.products_id) {
      await supabase
        .from('Products')
        .update({ status: 'scheduled', availability: 1 })
        .eq('products_id', auction.products_id);
    }

    res.json({ success: true, message: 'Auction rescheduled successfully.' });
  } catch (err) {
    console.error('rescheduleAuction error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/auctions/:id/promote
 * Notify all followers of this seller about the upcoming scheduled auction.
 * Can only be promoted once per auction (tracked via Notifications type='auction_promoted').
 */
export const promoteAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.user_id;
    if (!user_id) return res.status(401).json({ error: 'Not authenticated' });

    // Get the auction + seller info
    const { data: auction, error: auctionErr } = await supabase
      .from('Auctions')
      .select('auction_id, status, seller_id, products_id, start_time, Seller(user_id, store_name)')
      .eq('auction_id', id)
      .maybeSingle();

    if (auctionErr || !auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status !== 'scheduled') return res.status(400).json({ error: 'Only scheduled auctions can be promoted' });

    // Verify the requester owns this auction
    if (auction.Seller?.user_id !== user_id) {
      return res.status(403).json({ error: 'You do not own this auction' });
    }

    // Check if already promoted (look for an existing auction_promoted tracking record)
    const { data: existing } = await supabase
      .from('Notifications')
      .select('notification_id')
      .eq('user_id', user_id)
      .eq('type', 'auction_promoted')
      .eq('reference_id', id)
      .maybeSingle();

    if (existing) {
      return res.json({ success: false, already_promoted: true, notified: 0 });
    }

    // Get product name for the notification message
    const { data: product } = await supabase
      .from('Products')
      .select('name')
      .eq('products_id', auction.products_id)
      .maybeSingle();

    const productName = product?.name || 'an item';
    const storeName = auction.Seller?.store_name || 'A seller';
    const startDate = new Date(auction.start_time).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    // Fetch all followers of this seller
    const { data: followers, error: followErr } = await supabase
      .from('Follows')
      .select('follower_id')
      .eq('followed_seller_id', auction.seller_id);

    if (followErr) throw followErr;

    const followerIds = (followers || []).map(f => f.follower_id);

    // Send notification to each follower
    if (followerIds.length > 0) {
      const now = new Date().toISOString();
      const UNREAD_SENTINEL = '2099-12-31T23:59:59.000Z';
      const notifRows = followerIds.map(fid => ({
        user_id: fid,
        type: 'auction_upcoming',
        reference_id: id,
        payload: {
          auction_id: id,
          seller_name: storeName,
          item_name: productName,
          start_time: auction.start_time,
          title: `🔔 Upcoming Auction: ${productName}`,
          message: `${storeName} is going live with "${productName}" on ${startDate}. Don't miss it!`,
        },
        created_at: now,
        read_at: UNREAD_SENTINEL
      }));

      const { error: bulkErr } = await supabase.from('Notifications').insert(notifRows);
      if (bulkErr) throw bulkErr;
    }

    // Record that this auction was promoted AND notify the seller
    const UNREAD_SENTINEL = '2099-12-31T23:59:59.000Z';
    const notifiedMsg = followerIds.length === 0
      ? 'Your auction is promoted. Head to your dashboard to go live!'
      : `${followerIds.length} follower${followerIds.length === 1 ? '' : 's'} have been notified. Head to your dashboard to go live!`;
    await supabase.from('Notifications').insert([{
      user_id,
      type: 'auction_promoted',
      reference_id: id,
      payload: {
        auction_id: id,
        notified_count: followerIds.length,
        title: `Auction Promoted — ${productName}`,
        message: notifiedMsg,
      },
      created_at: new Date().toISOString(),
      read_at: UNREAD_SENTINEL
    }]);

    await recordValueAddedEarning(supabase, {
      sellerId: auction.seller_id,
      serviceType: 'highlighted_auction',
      amount: VALUE_ADDED_SERVICE_FEES.highlighted_auction
    });

    return res.json({
      success: true,
      already_promoted: false,
      notified: followerIds.length,
      service_fee: VALUE_ADDED_SERVICE_FEES.highlighted_auction
    });
  } catch (err) {
    console.error('promoteAuction error:', err);
    res.status(500).json({ error: err?.message || JSON.stringify(err) });
  }
};

