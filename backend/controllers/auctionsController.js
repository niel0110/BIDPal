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

    // Build query to fetch auctions
    let query = supabase
      .from('Auctions')
      .select('*')
      .eq('seller_id', final_seller_id)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'completed') {
        // 'ended' = auction finished (awaiting/processing payment), 'completed' = order done
        query = query.in('status', ['ended', 'completed']);
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
            live_ended_at: auction.live_ended_at,
            buy_now_price: auction.buy_now_price || 0,
            reserve_price: auction.reserve_price || 0,
            current_price: auction.current_price || auction.reserve_price || 0,
            final_price: auction.final_price || null,
            status: auction.status,
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
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['active', 'scheduled']);
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
          timeLeft: auction.status === 'active' ? 'Active Now' : new Date(auction.start_time).toLocaleString(),
          image: primaryImage?.image_url || null,
          images: images.map(img => img.image_url).filter(Boolean),
          status: auction.status
        };
      })
    );

    const CATEGORY_KEYWORDS = {
      clothing:    ['cloth', 'shirt', 'dress', 'pants', 'top', 'wear', 'apparel', 'fashion', 'blouse', 'skirt', 'suit', 'jacket', 'coat', 'jeans'],
      shoes:       ['shoe', 'footwear', 'sneaker', 'boot', 'sandal', 'slipper', 'heel'],
      bags:        ['bag', 'purse', 'tote', 'pouch', 'backpack', 'luggage', 'satchel', 'handbag', 'clutch'],
      jewelry:     ['jewel', 'necklace', 'ring', 'watch', 'bracelet', 'gem', 'earring', 'pendant', 'luxury'],
      gadgets:     ['gadget', 'electron', 'phone', 'tablet', 'laptop', 'computer', 'camera', 'gaming', 'headphone', 'audio', 'tv', 'charger', 'cable', 'tech'],
      appliances:  ['appliance', 'kitchen', 'laundry', 'refriger', 'vacuum', 'blender', 'oven', 'microwave'],
      furniture:   ['furniture', 'sofa', 'bed', 'dining', 'table', 'chair', 'storage', 'couch', 'decor', 'shelf', 'cabinet'],
      garden:      ['garden', 'plant', 'outdoor', 'lawn', 'tool', 'pot', 'soil'],
      instruments: ['instrument', 'music', 'guitar', 'piano', 'violin', 'drum', 'vinyl', 'bass', 'keyboard'],
    };

    // Filter by category and/or search on the assembled data
    let result = transformedData;
    if (category && category !== 'all') {
      const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [category.toLowerCase()];
      result = result.filter(a => {
        const cat = (a.category || a.title || '').toLowerCase();
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
      buy_now_price,
      start_date,
      start_time,
      end_date,
      end_time,
      timezone = 'UTC',
      bid_increment,
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
      // Default: end at 23:59:59 of the same day as the start
      const d = new Date(startDateTimeStr);
      d.setHours(23, 59, 59, 0);
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
          incremental_bid_step: isBid ? (parseFloat(bid_increment) || 50) : 0,
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
      } else {
        orderId = orderData.order_id;
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
            title: '🎉 Congratulations! You won the auction',
            message: `You won "${productData?.name}" with a bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')}. Please proceed to payment within 24 hours.`,
            order_id: orderId,
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

      // Get seller info and notify seller about the sale
      const sellerUserId = currentAuction?.Seller?.user_id;

      if (sellerUserId) {
        const { data: sellerNotif, error: sellerNotifError } = await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserId,
            type: 'auction_sold',
            payload: {
              title: '🏆 Auction Sold — Awaiting Payment',
              message: `"${productData?.name}" sold to ${winnerName} for ₱${winningBid.bid_amount.toLocaleString('en-PH')}. The buyer has 24 hours to complete payment.`,
              order_id: orderId,
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
      // Notify bidder that reserve wasn't met
      await supabase
        .from('Notifications')
        .insert([{
          user_id: winningBid.user_id,
          type: 'auction_reserve_not_met',
          payload: {
            title: 'Auction ended — Reserve not met',
            message: `The auction ended but the reserve price was not met. Your bid of ₱${winningBid.bid_amount.toLocaleString('en-PH')} was the highest.`
          },
          reference_id: id,
          reference_type: 'auction',
          read_at: '2099-12-31T23:59:59.000Z'
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
        order_id: orderId,
        bidder_name: winningBid.bidder ?
          `${winningBid.bidder.Fname || ''} ${winningBid.bidder.Lname || ''}`.trim() ||
          winningBid.bidder.email?.split('@')[0] || 'Winner' : 'Winner',
        bidder_avatar: winningBid.bidder?.Avatar || null
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

    const reservePrice = parseFloat(auction.reserve_price || 0);
    const maxBid = reservePrice * 10;
    if (reservePrice > 0 && bidAmount > maxBid) {
      return res.status(400).json({
        error: `Bid cannot exceed ₱${maxBid.toLocaleString('en-PH')} (10× the reserve price)`,
        maxBid
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
        order_id:             orderData.order_id,
        status:               orderData.status,
        total_amount:         orderData.total_amount,
        placed_at:            orderData.placed_at,
        tracking_number:      orderData.tracking_number   || null,
        courier:              orderData.courier            || null,
        payment_confirmed:    orderData.payment_confirmed  ?? false,
        payment_confirmed_at: orderData.payment_confirmed_at || null,
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

    // Record that this auction was promoted (so we can block duplicate promotions)
    const UNREAD_SENTINEL = '2099-12-31T23:59:59.000Z';
    await supabase.from('Notifications').insert([{
      user_id,
      type: 'auction_promoted',
      reference_id: id,
      payload: { auction_id: id, notified_count: followerIds.length },
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

