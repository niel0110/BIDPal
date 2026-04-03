import { supabase } from '../config/supabase.js';

// Fetch auction wins for a buyer (items they won)
export const getAuctionWinsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Fetch auctions where this user is the winner
    const { data, error } = await supabase
      .from('Auctions')
      .select(`
        auction_id,
        final_price,
        live_ended_at,
        status,
        Products (
          products_id,
          name,
          Product_Images (
            image_url
          )
        )
      `)
      .eq('winner_user_id', user_id)
      .in('status', ['ended', 'completed'])
      .order('live_ended_at', { ascending: false });

    if (error) {
      console.error('Auction wins fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Format as order-like objects for the frontend
    const formattedWins = data.map(auction => ({
      id: auction.auction_id,
      date: new Date(auction.live_ended_at).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      }),
      status: 'pending_payment', // Default status for auction wins
      total: auction.final_price,
      order_type: 'auction',
      auction_id: auction.auction_id,
      items: [{
        name: auction.Products?.name || 'Auction Item',
        qty: 1,
        price: auction.final_price,
        image: auction.Products?.Product_Images?.[0]?.image_url || null
      }],
      seller: 'Auction Seller'
    }));

    res.json(formattedWins);
  } catch (err) {
    console.error('Error fetching auction wins:', err);
    res.status(500).json({ error: err.message });
  }
};

// Fetch all orders for a buyer
export const getOrdersByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    // First, fetch basic order data
    const { data, error } = await supabase
      .from('Orders')
      .select(`
        *,
        Order_items (
            *,
            Products (
                name,
                Product_Images (
                    image_url
                )
            )
        )
      `)
      .eq('user_id', user_id)
      .order('placed_at', { ascending: false });

    if (error) {
      console.error('Orders fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Format for frontend - enrich with auction data if needed
    const formattedData = await Promise.all(data.map(async (order) => {
      const isAuction = order.order_type === 'auction';
      const shippingFields = {
        tracking_number: order.tracking_number || null,
        courier: order.courier || null,
      };

      // For auction orders, fetch auction details separately
      if (isAuction && order.auction_id) {
        try {
          const { data: auctionData } = await supabase
            .from('Auctions')
            .select(`
              auction_id,
              Products (
                name,
                Product_Images (image_url)
              )
            `)
            .eq('auction_id', order.auction_id)
            .single();

          return {
            id: order.order_id,
            date: new Date(order.placed_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric'
            }),
            status: order.status,
            total: order.total_amount,
            order_type: 'auction',
            auction_id: order.auction_id,
            ...shippingFields,
            items: [{
              name: auctionData?.Products?.name || 'Auction Item',
              qty: 1,
              price: order.total_amount,
              image: auctionData?.Products?.Product_Images?.[0]?.image_url || null
            }],
            seller: 'Auction Seller'
          };
        } catch (err) {
          console.error('Error fetching auction data:', err);
          return {
            id: order.order_id,
            date: new Date(order.placed_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric'
            }),
            status: order.status,
            total: order.total_amount,
            order_type: 'auction',
            auction_id: order.auction_id,
            ...shippingFields,
            items: [{
              name: 'Auction Item',
              qty: 1,
              price: order.total_amount,
              image: null
            }],
            seller: 'Auction Seller'
          };
        }
      }

      // For regular orders
      return {
        id: order.order_id,
        date: new Date(order.placed_at).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        }),
        status: order.status,
        total: order.total_amount,
        order_type: 'regular',
        ...shippingFields,
        items: order.Order_items?.map(item => ({
          name: item.Products?.name || 'Unknown Product',
          qty: item.quantity,
          price: item.unit_price,
          image: item.Products?.Product_Images?.[0]?.image_url || null
        })) || [],
        seller: 'Various Sellers'
      };
    }));

    res.json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch single order details
export const getOrderById = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { data, error } = await supabase
      .from('Orders')
      .select(`
        *,
        Order_items (
            *,
            Products (
                name,
                Product_Images (
                    image_url
                )
            )
        )
      `)
      .eq('order_id', order_id)
      .single();

    if (error) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new order
export const createOrder = async (req, res) => {
  try {
    const { buyer_id: user_id, address_id, total_amount, items } = req.body;

    if (!user_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Create Order record
    const { data: orderData, error: orderError } = await supabase
      .from('Orders')
      .insert([{
          user_id,
          shipping_address_id: address_id,
          total_amount,
          status: 'pay'
      }])
      .select('*')
      .single();

    if (orderError) return res.status(400).json({ error: orderError.message });

    // 2. Create Order Items
    const orderItems = items.map(item => ({
        order_id: orderData.order_id,
        products_id: item.products_id || item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('Order_items')
      .insert(orderItems);

    if (itemsError) {
        return res.status(400).json({ error: 'Order created but items failed: ' + itemsError.message });
    }

    res.status(201).json({ 
        message: 'Order placed successfully', 
        order_id: orderData.order_id 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from('Orders')
      .update({ status })
      .eq('order_id', order_id)
      .select('*');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Order status updated', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Process payment for auction win
export const processAuctionPayment = async (req, res) => {
  try {
    const { auction_id } = req.params;
    const { user_id, payment_method, shipping_address_id, shipping_fee, total_amount } = req.body;

    console.log(`💳 Processing payment for auction: ${auction_id}`);

    // 1. Verify the user is the winner
    const { data: auction, error: auctionError } = await supabase
      .from('Auctions')
      .select('*, Products(products_id, name), seller_id')
      .eq('auction_id', auction_id)
      .eq('winner_user_id', user_id)
      .single();

    if (auctionError || !auction) {
      return res.status(404).json({ error: 'Auction not found or you are not the winner' });
    }

    // 2. Create or update order
    const { data: existingOrder } = await supabase
      .from('Orders')
      .select('order_id')
      .eq('auction_id', auction_id)
      .eq('user_id', user_id)
      .maybeSingle();

    let orderId;

    if (existingOrder) {
      // Update existing order
      orderId = existingOrder.order_id;
      await supabase
        .from('Orders')
        .update({
          seller_id: auction.seller_id,
          status: 'processing',
          payment_method: payment_method || 'cash_on_delivery',
          shipping_address_id: shipping_address_id || null,
          shipping_fee: shipping_fee || 0,
          total_amount: total_amount || auction.final_price
        })
        .eq('order_id', orderId);
    } else {
      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('Orders')
        .insert([{
          user_id,
          seller_id: auction.seller_id,
          total_amount: total_amount || auction.final_price,
          status: 'processing',
          order_type: 'auction',
          auction_id,
          payment_method: payment_method || 'cash_on_delivery',
          shipping_address_id: shipping_address_id || null,
          shipping_fee: shipping_fee || 0
        }])
        .select('order_id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        return res.status(500).json({ error: orderError.message || 'Failed to create order' });
      }

      orderId = newOrder.order_id;

      // Create order item
      await supabase
        .from('Order_items')
        .insert([{
          order_id: orderId,
          products_id: auction.Products.products_id,
          quantity: 1,
          unit_price: auction.final_price,
          subtotal: auction.final_price
        }]);
    }

    // 3. Update auction status
    await supabase
      .from('Auctions')
      .update({ status: 'completed' })
      .eq('auction_id', auction_id);

    // 4. Send notification to seller
    const { data: sellerProfile } = await supabase
      .from('Products')
      .select('seller_id, Seller!inner(user_id)')
      .eq('products_id', auction.Products.products_id)
      .single();

    if (sellerProfile?.Seller?.user_id) {
      await supabase
        .from('Notifications')
        .insert([{
          user_id: sellerProfile.Seller.user_id,
          type: 'order_update',
          title: '💰 Payment Received',
          message: `Payment received for auction: ${auction.Products.name}`,
          reference_id: auction_id,
          reference_type: 'auction'
        }]);
    }

    console.log(`✅ Payment processed successfully for order: ${orderId}`);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      order_id: orderId,
      status: 'processing'
    });

  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(500).json({ error: err.message });
  }
};

// Full transaction detail for a single order (seller view)
export const getSellerOrderDetail = async (req, res) => {
  try {
    const { order_id } = req.params;

    // Order + buyer info
    const { data: order, error: orderError } = await supabase
      .from('Orders')
      .select(`
        *,
        User!user_id (
          user_id, Fname, Lname, email, Avatar
        ),
        Auctions!auction_id (
          auction_id,
          final_price,
          live_ended_at,
          winning_bid_id,
          Products (
            products_id,
            name,
            description,
            Product_Images ( image_url )
          )
        )
      `)
      .eq('order_id', order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Winning bid (to show bid amount vs final price)
    let winningBid = null;
    if (order.Auctions?.winning_bid_id) {
      const { data: bid } = await supabase
        .from('Bids')
        .select('bid_amount, placed_at')
        .eq('bid_id', order.Auctions.winning_bid_id)
        .single();
      winningBid = bid;
    }

    // Review for this order
    const { data: review } = await supabase
      .from('Reviews')
      .select('review_id, rating, comment, created_at')
      .eq('order_id', order_id)
      .maybeSingle();

    // Shipping address details
    let shippingAddress = null;
    if (order.shipping_address_id) {
      const { data: addr } = await supabase
        .from('Addresses')
        .select('*')
        .eq('address_id', order.shipping_address_id)
        .single();
      shippingAddress = addr;
    }

    const product   = order.Auctions?.Products;
    const auctionAt = order.Auctions?.live_ended_at;

    res.json({
      order_id:       order.order_id,
      status:         order.status,
      placed_at:      order.placed_at,
      auction_id:     order.auction_id,
      auction_ended_at: auctionAt,
      payment_method: order.payment_method,
      shipping_fee:   order.shipping_fee,
      total_amount:   order.total_amount,
      tracking_number:      order.tracking_number,
      courier:              order.courier,
      payment_confirmed:    order.payment_confirmed || false,
      payment_confirmed_at: order.payment_confirmed_at || null,
      buyer: order.User ? {
        user_id: order.User.user_id,
        name:    `${order.User.Fname || ''} ${order.User.Lname || ''}`.trim(),
        email:   order.User.email,
        avatar:  order.User.Avatar
      } : null,
      product: product ? {
        products_id: product.products_id,
        name:        product.name,
        description: product.description,
        image:       product.Product_Images?.[0]?.image_url || null
      } : null,
      winning_bid:     winningBid,
      final_price:     order.Auctions?.final_price,
      shipping_address: shippingAddress,
      review:          review || null
    });
  } catch (err) {
    console.error('Error fetching seller order detail:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all orders for a seller's auctions
export const getSellerOrders = async (req, res) => {
  try {
    const { seller_id } = req.params;

    // Get all auction IDs for this seller
    const { data: sellerAuctions, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id')
      .eq('seller_id', seller_id);

    if (auctionError) return res.status(500).json({ error: auctionError.message });
    if (!sellerAuctions.length) return res.json([]);

    const auctionIds = sellerAuctions.map(a => a.auction_id);

    // Fetch orders for those auctions
    const { data, error } = await supabase
      .from('Orders')
      .select(`
        order_id,
        auction_id,
        user_id,
        status,
        total_amount,
        payment_method,
        shipping_fee,
        tracking_number,
        courier,
        placed_at,
        payment_confirmed,
        payment_confirmed_at,
        User!user_id (
          user_id,
          Fname,
          Lname,
          email,
          Avatar
        ),
        Auctions!auction_id (
          auction_id,
          final_price,
          Products (
            products_id,
            name,
            Product_Images ( image_url )
          )
        )
      `)
      .in('auction_id', auctionIds)
      .order('placed_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(order => ({
      order_id: order.order_id,
      auction_id: order.auction_id,
      status: order.status,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      shipping_fee: order.shipping_fee,
      tracking_number:      order.tracking_number,
      courier:              order.courier,
      payment_confirmed:    order.payment_confirmed || false,
      payment_confirmed_at: order.payment_confirmed_at || null,
      placed_at: order.placed_at,
      buyer: order.User ? {
        user_id: order.User.user_id,
        name: `${order.User.Fname || ''} ${order.User.Lname || ''}`.trim(),
        email: order.User.email,
        avatar: order.User.Avatar
      } : null,
      product: {
        products_id: order.Auctions?.Products?.products_id,
        name: order.Auctions?.Products?.name || 'Auction Item',
        image: order.Auctions?.Products?.Product_Images?.[0]?.image_url || null,
        final_price: order.Auctions?.final_price
      }
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching seller orders:', err);
    res.status(500).json({ error: err.message });
  }
};

// Seller confirms payment received — unlocks shipping
export const confirmPayment = async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data: order, error: fetchError } = await supabase
      .from('Orders')
      .select('order_id, status, user_id, auction_id, payment_confirmed')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'processing') {
      return res.status(400).json({ error: `Order must be in processing state to confirm payment (current: ${order.status})` });
    }

    if (order.payment_confirmed) {
      return res.status(409).json({ error: 'Payment already confirmed' });
    }

    const { error: updateError } = await supabase
      .from('Orders')
      .update({
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString()
      })
      .eq('order_id', order_id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    // Notify buyer that payment was confirmed and seller is preparing the item
    let productName = 'your item';
    if (order.auction_id) {
      const { data: auctionData } = await supabase
        .from('Auctions')
        .select('Products(name)')
        .eq('auction_id', order.auction_id)
        .single();
      productName = auctionData?.Products?.name || productName;
    }

    await supabase
      .from('Notifications')
      .insert([{
        user_id: order.user_id,
        type: 'order_update',
        title: '✅ Payment Confirmed',
        message: `The seller has confirmed your payment for ${productName}. Your item is being prepared for shipping.`,
        reference_id: order_id,
        reference_type: 'order'
      }]);

    res.json({ success: true, message: 'Payment confirmed. You can now proceed with shipping.' });
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).json({ error: err.message });
  }
};

// Seller marks order as shipped with tracking info
export const shipOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { tracking_number, courier } = req.body;

    if (!tracking_number || !courier) {
      return res.status(400).json({ error: 'Tracking number and courier are required' });
    }

    // Verify order is in 'processing' state (payment received)
    const { data: order, error: fetchError } = await supabase
      .from('Orders')
      .select('order_id, status, user_id, auction_id, payment_confirmed')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'processing') {
      return res.status(400).json({ error: `Cannot ship order with status: ${order.status}. Order must be in processing state.` });
    }
    if (!order.payment_confirmed) {
      return res.status(400).json({ error: 'You must confirm payment received before marking the order as shipped.' });
    }

    // Update order with tracking info and change status to shipped
    const { data: updated, error: updateError } = await supabase
      .from('Orders')
      .update({ status: 'shipped', tracking_number, courier })
      .eq('order_id', order_id)
      .select('*')
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });

    // Get product name for notification
    let productName = 'your item';
    if (order.auction_id) {
      const { data: auctionData } = await supabase
        .from('Auctions')
        .select('Products(name)')
        .eq('auction_id', order.auction_id)
        .single();
      productName = auctionData?.Products?.name || productName;
    }

    // Notify buyer
    await supabase
      .from('Notifications')
      .insert([{
        user_id: order.user_id,
        type: 'order_update',
        title: '🚚 Your order has been shipped!',
        message: `${productName} is on its way. Courier: ${courier}, Tracking: ${tracking_number}`,
        reference_id: order_id,
        reference_type: 'order'
      }]);

    res.json({ success: true, message: 'Order marked as shipped', order: updated });
  } catch (err) {
    console.error('Error shipping order:', err);
    res.status(500).json({ error: err.message });
  }
};

// Buyer confirms order received (marks as completed)
export const confirmDelivery = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { user_id } = req.body;

    // Verify order belongs to user and is in 'shipped' state
    const { data: order, error: fetchError } = await supabase
      .from('Orders')
      .select('order_id, status, user_id, auction_id')
      .eq('order_id', order_id)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'shipped') {
      return res.status(400).json({ error: `Cannot confirm delivery for order with status: ${order.status}` });
    }

    // Mark as completed
    await supabase
      .from('Orders')
      .update({ status: 'completed' })
      .eq('order_id', order_id);

    // Get seller user_id to notify them
    if (order.auction_id) {
      const { data: auctionData } = await supabase
        .from('Auctions')
        .select('Products(name, Seller(user_id))')
        .eq('auction_id', order.auction_id)
        .single();

      const sellerUserId = auctionData?.Products?.Seller?.user_id;
      const productName = auctionData?.Products?.name || 'your item';

      if (sellerUserId) {
        await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserId,
            type: 'order_update',
            title: '✅ Order Completed',
            message: `Buyer confirmed receipt of ${productName}. Order is now complete.`,
            reference_id: order_id,
            reference_type: 'order'
          }]);
      }
    }

    res.json({ success: true, message: 'Order marked as completed' });
  } catch (err) {
    console.error('Error confirming delivery:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get seller information for an auction
export const getAuctionSeller = async (req, res) => {
  try {
    const { auction_id } = req.params;

    const { data: auction, error } = await supabase
      .from('Auctions')
      .select(`
        auction_id,
        Products (
          products_id,
          name,
          seller_id,
          Seller (
            seller_id,
            store_name,
            user_id,
            User (
              user_id,
              email,
              Fname,
              Lname
            )
          )
        )
      `)
      .eq('auction_id', auction_id)
      .single();

    if (error || !auction) {
      console.error('Error fetching auction:', error);
      return res.status(404).json({ error: 'Auction not found' });
    }

    const seller = auction.Products?.Seller;
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json({
      seller_id: seller.seller_id,
      shop_name: seller.store_name,
      seller_user_id: seller.user_id,
      seller_name: `${seller.User?.Fname || ''} ${seller.User?.Lname || ''}`.trim(),
      seller_email: seller.User?.email,
      product_name: auction.Products?.name
    });

  } catch (err) {
    console.error('Error fetching seller info:', err);
    res.status(500).json({ error: err.message });
  }
};
