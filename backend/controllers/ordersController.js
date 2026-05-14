import { supabase } from '../config/supabase.js';
import {
  calculateSellerCommission,
  recordPlatformEarning
} from '../services/revenueService.js';
import { assertCanCheckout } from '../services/accountStatusService.js';

const generatePaymentReference = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BDP-${date}-${rand}`;
};

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
      .in('status', ['success', 'ended', 'completed'])
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

    // ── Step 1: fetch all auction wins for this user ─────────────────────────
    const { data: wonAuctions } = await supabase
      .from('Auctions')
      .select(`
        auction_id,
        seller_id,
        final_price,
        products_id,
        live_ended_at,
        status,
        Products (
          name,
          Product_Images ( image_url )
        )
      `)
      .eq('winner_user_id', user_id)
      .in('status', ['success', 'ended', 'completed']);

    // ── Step 2: find which wins already have an order ────────────────────────
    // ── Step 4: fetch all actual orders from DB ──────────────────────────────
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

    // If DB says cancelled but order was shipped/delivered, restore the real status.
    // A tracking_number proves the seller fulfilled it — DB cancellation is stale/wrong.
    const resolveStatus = (order) => {
      if (order.status === 'cancelled' && order.tracking_number) {
        return order.status_before_cancel || 'completed';
      }
      return order.status;
    };

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
            placed_at_raw: order.placed_at,
            status: resolveStatus(order),
            total: order.total_amount,
            order_type: 'auction',
            auction_id: order.auction_id,
            payment_method: order.payment_method || null,
            payment_confirmed: order.payment_confirmed || false,
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
            placed_at_raw: order.placed_at,
            status: resolveStatus(order),
            total: order.total_amount,
            order_type: 'auction',
            auction_id: order.auction_id,
            payment_method: order.payment_method || null,
            payment_confirmed: order.payment_confirmed || false,
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
        status: resolveStatus(order),
        total: order.total_amount,
        order_type: 'regular',
        seller_id: order.seller_id || null,
        payment_method: order.payment_method || null,
        payment_confirmed: order.payment_confirmed || false,
        ...shippingFields,
        items: order.Order_items?.map(item => ({
          products_id: item.products_id,
          name: item.Products?.name || 'Unknown Product',
          qty: item.quantity,
          price: item.unit_price,
          image: item.Products?.Product_Images?.[0]?.image_url || null
        })) || [],
        seller: 'Various Sellers'
      };
    }));

    // ── Step 4b: detect cascaded wins via Payment_Windows (Orders may not exist before checkout) ──
    // If another user had a Payment_Window for the same auction, this is a cascaded win.
    const allAuctionIds = formattedData
      .filter(o => o.order_type === 'auction' && o.auction_id)
      .map(o => o.auction_id);

    // Also include won auctions that have no Order yet — needed so their payment window is found
    const wonAuctionIdsNoOrder = (wonAuctions || [])
      .filter(a => !formattedData.some(o => o.auction_id === a.auction_id))
      .map(a => a.auction_id);

    const allCheckIds = [...new Set([...allAuctionIds, ...wonAuctionIdsNoOrder])];

    let cascadedAuctionIds = new Set();
    let windowMap = {};

    if (allCheckIds.length) {
      const { data: allWindows } = await supabase
        .from('Payment_Windows')
        .select('auction_id, winner_user_id, payment_deadline, payment_window_id, payment_completed, violation_triggered')
        .in('auction_id', allCheckIds);

      for (const w of (allWindows || [])) {
        // Cascaded = another user (not me) had a window for this auction
        if (w.winner_user_id !== user_id) {
          cascadedAuctionIds.add(w.auction_id);
        }
        // Collect the active (incomplete and non-violated) window for this user for payment deadline
        if (w.winner_user_id === user_id && !w.payment_completed && !w.violation_triggered) {
          windowMap[w.auction_id] = {
            payment_deadline: w.payment_deadline,
            payment_window_id: w.payment_window_id
          };
        }
      }

      for (const order of formattedData) {
        if (!order.auction_id) continue;
        if (cascadedAuctionIds.has(order.auction_id)) order.is_cascaded = true;
        
        // Only show payment info if window hasn't expired/violated
        if (order.status === 'pending_payment' && windowMap[order.auction_id]) {
          order.payment_deadline = windowMap[order.auction_id].payment_deadline;
          order.payment_window_id = windowMap[order.auction_id].payment_window_id;
        }
      }
    }

    // ── Step 5: fallback — auction wins that have no Order row yet (pre-checkout) ─
    const coveredInResponse = new Set(formattedData.map(o => o.auction_id).filter(Boolean));
    const now = Date.now();
    const fallbackItems = (wonAuctions || [])
      .filter(a => {
        if (coveredInResponse.has(a.auction_id) || !a.final_price) return false;
        // Hide stale fallbacks: no active payment window AND auction ended > 24h ago
        const hasActiveWindow = !!windowMap[a.auction_id];
        const auctionAge = a.live_ended_at ? now - new Date(a.live_ended_at).getTime() : 0;
        if (!hasActiveWindow && auctionAge > 24 * 60 * 60 * 1000) return false;
        return true;
      })
      .map(a => ({
        id: a.auction_id,
        date: a.live_ended_at
          ? new Date(a.live_ended_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          : '',
        placed_at_raw: a.live_ended_at,
        status: 'pending_payment',
        total: a.final_price,
        order_type: 'auction',
        auction_id: a.auction_id,
        is_cascaded: cascadedAuctionIds.has(a.auction_id),
        payment_deadline: windowMap[a.auction_id]?.payment_deadline || null,
        payment_window_id: windowMap[a.auction_id]?.payment_window_id || null,
        tracking_number: null,
        courier: null,
        items: [{
          name: a.Products?.name || 'Auction Item',
          qty: 1,
          price: a.final_price,
          image: a.Products?.Product_Images?.[0]?.image_url || null
        }],
        seller: 'Auction Seller'
      }));

    // ── Step 6: cancelled fallback orders — auctions cancelled before checkout ──
    // These have no Order row (FK constraint prevents creation without shipping_address_id),
    // so we pull the most-recent Order_Cancellations record per auction_id instead.
    const allCoveredAuctionIds = new Set([
      ...formattedData.map(o => o.auction_id).filter(Boolean),
      ...fallbackItems.map(o => o.auction_id).filter(Boolean)
    ]);

    const { data: cancellationRecords } = await supabase
      .from('Order_Cancellations')
      .select('*, Auctions(auction_id, final_price, live_ended_at, winner_user_id, Products(name, Product_Images(image_url)))')
      .eq('user_id', user_id)
      .is('order_id', null)          // only fallback cancellations (no real Order row)
      .order('cancelled_at', { ascending: false });

    // One card per auction — pick the latest cancellation record.
    // Exclude any auction where this user is now the CURRENT winner (stale record from
    // a previous cascade test or data correction — they're the winner now, not a canceller).
    const seenCancelledAuctions = new Set();
    const cancelledFallbacks = (cancellationRecords || [])
      .filter(c => {
        if (!c.auction_id || allCoveredAuctionIds.has(c.auction_id)) return false;
        if (seenCancelledAuctions.has(c.auction_id)) return false;
        // If this user is currently the winner of the auction, the record is stale — skip it
        if (c.Auctions?.winner_user_id === user_id) return false;
        seenCancelledAuctions.add(c.auction_id);
        return true;
      })
      .map(c => ({
        id: c.cancellation_id,
        date: c.cancelled_at
          ? new Date(c.cancelled_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          : '',
        placed_at_raw: c.cancelled_at,
        status: 'cancelled',
        total: c.Auctions?.final_price || 0,
        order_type: 'auction',
        auction_id: c.auction_id,
        tracking_number: null,
        courier: null,
        items: [{
          name: c.Auctions?.Products?.name || 'Auction Item',
          qty: 1,
          price: c.Auctions?.final_price || 0,
          image: c.Auctions?.Products?.Product_Images?.[0]?.image_url || null
        }],
        seller: 'Auction Seller'
      }));

    res.json([...formattedData, ...fallbackItems, ...cancelledFallbacks]);
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
    const { 
      buyer_id: user_id, 
      seller_id, 
      address_id, 
      total_amount, 
      items,
      payment_method,
      payment_reference,
      paid_at,
      status: requestedStatus,
      payment_confirmed,
      shipping_fee
    } = req.body;

    if (!user_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await assertCanCheckout(user_id);

    // 0. Check product availability for fixed-price orders
    const productIdsToCheck = [...new Set(items.map(item => item.products_id || item.id).filter(Boolean))];
    if (productIdsToCheck.length > 0) {
      const { data: currentProducts, error: checkError } = await supabase
        .from('Products')
        .select('products_id, status, availability, name')
        .in('products_id', productIdsToCheck);

      if (checkError) return res.status(500).json({ error: 'Failed to verify item availability' });

      for (const product of currentProducts) {
        if (product.status === 'sold' || product.availability <= 0) {
          return res.status(400).json({ 
            error: `Sorry, "${product.name}" has already been sold or is no longer available.` 
          });
        }
      }
    }

    const itemSubtotal = items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 1);
      return sum + Number(item.price || 0) * quantity;
    }, 0);
    const commission = await calculateSellerCommission(supabase, {
      sellerId: seller_id,
      saleAmount: itemSubtotal || Number(total_amount || 0) - Number(shipping_fee || 0)
    });

    // 1. Create Order record
    const orderRecord = {
      user_id,
      total_amount,
      status: requestedStatus || 'pending_payment',
      shipping_address_id: address_id || null,
      payment_method: payment_method || null,
      payment_reference: payment_reference || null,
      paid_at: paid_at || null,
      shipping_fee: shipping_fee || 0,
      order_type: 'regular',
      payment_confirmed: payment_confirmed ?? payment_method === 'cash_on_delivery',
      payment_confirmed_at: (payment_confirmed ?? payment_method === 'cash_on_delivery') ? new Date().toISOString() : null,
      commission_rate: commission.commissionRate,
      commission_amount: commission.commissionAmount
    };
    if (seller_id) orderRecord.seller_id = seller_id;

    const { data: orderData, error: orderError } = await supabase
      .from('Orders')
      .insert([orderRecord])
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

    const orderedProductIds = [...new Set(orderItems.map(item => item.products_id).filter(Boolean))];
    if (orderedProductIds.length > 0) {
      // Update product status and availability
      const { error: productStatusError } = await supabase
        .from('Products')
        .update({ status: 'sold', availability: 0 })
        .in('products_id', orderedProductIds);
      
      if (productStatusError) {
        console.error('⚠️ Product status update error:', productStatusError.message);
      } else {
        console.log(`✅ Successfully marked ${orderedProductIds.length} products as sold.`);
      }

      // Also update any associated Buy Now auctions to 'completed'
      const { error: auctionStatusError } = await supabase
        .from('Auctions')
        .update({ status: 'completed' })
        .in('products_id', orderedProductIds)
        .gt('buy_now_price', 0)
        .in('status', ['active', 'scheduled', 'live']);

      if (auctionStatusError) {
        console.warn('Fixed-price listing completion update failed:', auctionStatusError.message);
      }
    }

    await recordPlatformEarning(supabase, {
      orderId: orderData.order_id,
      sellerId: seller_id,
      totalAmount: commission.grossSaleAmount,
      commissionRate: commission.commissionRate,
      commissionAmount: commission.commissionAmount
    });

    res.status(201).json({ 
        message: 'Order placed successfully', 
        order_id: orderData.order_id,
        commission: {
          rate: commission.commissionRate,
          amount: commission.commissionAmount,
          seller_net_amount: commission.sellerNetAmount
        }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message,
      code: err.code,
      accountStatus: err.accountStatus,
    });
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

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    await assertCanCheckout(user_id);

    // 1b. Check if payment window is still valid
    const { data: vPaymentWindow } = await supabase
      .from('Payment_Windows')
      .select('violation_triggered, payment_deadline')
      .eq('auction_id', auction_id)
      .eq('winner_user_id', user_id)
      .maybeSingle();

    if (vPaymentWindow?.violation_triggered) {
      return res.status(403).json({ error: 'Payment window has expired and this order has been cancelled.' });
    }
    
    if (vPaymentWindow && new Date() > new Date(vPaymentWindow.payment_deadline)) {
       return res.status(403).json({ error: 'Payment window has expired.' });
    }

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
    const totalAmt = total_amount || Number(auction.final_price || 0) + Number(shipping_fee || 0);
    const commission = await calculateSellerCommission(supabase, {
      sellerId: auction.seller_id,
      saleAmount: auction.final_price
    });

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
          total_amount: totalAmt,
          commission_rate: commission.commissionRate,
          commission_amount: commission.commissionAmount
        })
        .eq('order_id', orderId);
    } else {
      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('Orders')
        .insert([{
          user_id,
          seller_id: auction.seller_id,
          total_amount: totalAmt,
          status: 'processing',
          order_type: 'auction',
          auction_id,
          payment_method: payment_method || 'cash_on_delivery',
          shipping_address_id: shipping_address_id || null,
          shipping_fee: shipping_fee || 0,
          commission_rate: commission.commissionRate,
          commission_amount: commission.commissionAmount
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

    // 3. Update auction and product status
    await Promise.all([
      supabase
        .from('Auctions')
        .update({ status: 'completed' })
        .eq('auction_id', auction_id),
      supabase
        .from('Products')
        .update({ status: 'sold', availability: 0 })
        .eq('products_id', auction.Products.products_id)
    ]);

    // 4. Generate payment reference
    const payment_reference = generatePaymentReference();
    const paid_at = new Date().toISOString();

    // Best-effort: save payment_reference to Orders (column may not exist yet)
    try {
      await supabase
        .from('Orders')
        .update({ payment_reference, paid_at })
        .eq('order_id', orderId);
    } catch (_) {}

    // 5. Send notification to seller
    let sellerNotifUserId = null;
    try {
      const { data: sellerProfile } = await supabase
        .from('Products')
        .select('seller_id, Seller(user_id)')
        .eq('products_id', auction.Products.products_id)
        .single();
      sellerNotifUserId = sellerProfile?.Seller?.user_id || null;
      // Fallback: look up directly by seller_id if join returned nothing
      if (!sellerNotifUserId && sellerProfile?.seller_id) {
        const { data: sellerRow } = await supabase
          .from('Seller').select('user_id').eq('seller_id', sellerProfile.seller_id).maybeSingle();
        sellerNotifUserId = sellerRow?.user_id || null;
      }
    } catch (_) {}

    if (sellerNotifUserId) {
      await supabase
        .from('Notifications')
        .insert([{
          user_id: sellerNotifUserId,
          type: 'order_update',
          payload: {
            title: '💰 Payment Received — Prepare to Ship',
            message: `Buyer has paid for "${auction.Products.name}". Ref: ${payment_reference}. Please confirm payment and prepare the item for shipping.`,
            payment_reference,
            order_id: orderId,
            auction_id,
            product_id: auction.Products.products_id,
            product_name: auction.Products.name
          },
          reference_id: auction_id,
          reference_type: 'auction',
          read_at: '2099-12-31T23:59:59.000Z'
        }]);
      console.log(`🔔 Seller notified of payment (user ${sellerNotifUserId})`);
    } else {
      console.warn(`⚠️ Could not resolve seller user_id for payment notification (auction ${auction_id})`);
    }

    console.log(`✅ Payment processed successfully for order: ${orderId}`);

    // Record successful transaction for anti-bogus system
    try {
      const { data: violRecord } = await supabase
        .from('Violation_Records')
        .select('user_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (violRecord) {
        await supabase.rpc('increment_successful_transactions', { p_user_id: user_id }).catch(() => {});
      }

      await supabase
        .from('Payment_Windows')
        .update({ payment_completed: true, payment_completed_at: paid_at, order_id: orderId })
        .eq('auction_id', auction_id);
    } catch (_) {}

    // 6. Record Platform Earnings for this transaction
    try {
      await recordPlatformEarning(supabase, {
        orderId,
        sellerId: auction.seller_id,
        totalAmount: commission.grossSaleAmount,
        commissionRate: commission.commissionRate,
        commissionAmount: commission.commissionAmount
      });
      console.log(`Commission recorded for order: ${orderId} (Amount: PHP ${commission.commissionAmount})`);
    } catch (e) {
      console.error('Error recording platform earnings:', e);
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      order_id: orderId,
      payment_reference,
      paid_at,
      status: 'processing',
      commission: {
        rate: commission.commissionRate,
        amount: commission.commissionAmount,
        seller_net_amount: commission.sellerNetAmount
      }
    });

  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(err.statusCode || 500).json({
      error: err.message,
      code: err.code,
      accountStatus: err.accountStatus,
    });
  }
};

// Full transaction detail for a single order (seller view)
export const getSellerOrderDetail = async (req, res) => {
  try {
    const { order_id } = req.params;

    // ── Pending-payment virtual orders: no Order row exists yet ──
    // The list page uses "pending_<auction_id>" as a synthetic order_id.
    if (order_id.startsWith('pending_')) {
      const auctionId = order_id.replace(/^pending_/, '');

      const { data: auction, error: aErr } = await supabase
        .from('Auctions')
        .select(`
          auction_id, winner_user_id, final_price, seller_id, status,
          Products (
            products_id, name, description,
            Product_Images ( image_url )
          )
        `)
        .eq('auction_id', auctionId)
        .single();

      if (aErr || !auction) return res.status(404).json({ error: 'Auction not found' });

      // Buyer info
      let buyer = null;
      if (auction.winner_user_id) {
        const { data: u } = await supabase
          .from('User')
          .select('user_id, Fname, Lname, email, Avatar')
          .eq('user_id', auction.winner_user_id)
          .maybeSingle();
        if (u) buyer = { user_id: u.user_id, name: `${u.Fname || ''} ${u.Lname || ''}`.trim(), email: u.email, avatar: u.Avatar };
      }

      // Active payment window (for deadline)
      const { data: pw } = await supabase
        .from('Payment_Windows')
        .select('payment_deadline, payment_window_id')
        .eq('auction_id', auctionId)
        .eq('winner_user_id', auction.winner_user_id)
        .eq('payment_completed', false)
        .maybeSingle();

      const product = auction.Products;
      return res.json({
        order_id:             `pending_${auctionId}`,
        status:               'pending_payment',
        placed_at:            null,
        auction_id:           auctionId,
        auction_ended_at:     null,
        payment_method:       null,
        shipping_fee:         0,
        total_amount:         auction.final_price || 0,
        tracking_number:      null,
        courier:              null,
        payment_confirmed:    false,
        payment_confirmed_at: null,
        payment_deadline:     pw?.payment_deadline || null,
        buyer,
        product: product ? {
          products_id: product.products_id,
          name:        product.name,
          description: product.description,
          image:       product.Product_Images?.[0]?.image_url || null
        } : null,
        winning_bid:     null,
        final_price:     auction.final_price || 0,
        shipping_address: null,
        review:          null
      });
    }

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
        ),
        Order_items (
          products_id, quantity, unit_price, subtotal,
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

    const regularItem = order.Order_items?.[0];
    const product   = order.Auctions?.Products || regularItem?.Products;
    const auctionAt = order.Auctions?.live_ended_at;

    // If order is 'cancelled' but was actually shipped/delivered, show real status.
    // Legacy fixed-price COD orders may still be pending_payment, but sellers can ship them.
    const resolvedStatus = (() => {
      if (order.status === 'cancelled' && order.tracking_number) return 'completed';
      if (
        order.status === 'pending_payment' &&
        order.payment_method === 'cash_on_delivery' &&
        (order.order_type === 'regular' || !order.auction_id)
      ) {
        return 'processing';
      }
      return order.status;
    })();

    res.json({
      order_id:       order.order_id,
      status:         resolvedStatus,
      placed_at:      order.placed_at,
      auction_id:     order.auction_id,
      order_type:     order.order_type || (order.auction_id ? 'auction' : 'regular'),
      auction_ended_at: auctionAt,
      payment_method: order.payment_method,
      shipping_fee:   order.shipping_fee,
      total_amount:   order.total_amount,
      tracking_number:      order.tracking_number,
      courier:              order.courier,
      payment_confirmed:    order.payment_confirmed || (order.payment_method === 'cash_on_delivery' && (order.order_type === 'regular' || !order.auction_id)),
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
      final_price:     order.Auctions?.final_price || regularItem?.unit_price || order.total_amount,
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

    // If order is 'cancelled' but was actually shipped/delivered, restore real status
    const resolveStatus = (order) => {
      if (order.status === 'cancelled' && order.tracking_number) return 'completed';
      if (
        order.status === 'pending_payment' &&
        order.payment_method === 'cash_on_delivery' &&
        (order.order_type === 'regular' || !order.auction_id)
      ) {
        return 'processing';
      }
      return order.status;
    };

    // Fetch all auctions for this seller (including winner info for pending-payment detection)
    const { data: sellerAuctions, error: auctionError } = await supabase
      .from('Auctions')
      .select('auction_id, winner_user_id, final_price, status, Products(products_id, name, Product_Images(image_url))')
      .eq('seller_id', seller_id);

    if (auctionError) return res.status(500).json({ error: auctionError.message });

    const auctionIds = (sellerAuctions || []).map(a => a.auction_id);

    // Fetch actual Orders for those auctions
    let data = [];
    if (auctionIds.length > 0) {
      const { data: auctionOrders, error } = await supabase
        .from('Orders')
        .select(`
          order_id, auction_id, user_id, status, total_amount,
          payment_method, shipping_fee, tracking_number, courier,
          placed_at, payment_confirmed, payment_confirmed_at, order_type,
          User!user_id ( user_id, Fname, Lname, email, Avatar ),
          Auctions!auction_id (
            auction_id, final_price,
            Products ( products_id, name, Product_Images ( image_url ) )
          )
        `)
        .in('auction_id', auctionIds)
        .order('placed_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      data = auctionOrders || [];
    }

    const formattedAuctionOrders = data.map(order => ({
      order_id:            order.order_id,
      auction_id:          order.auction_id,
      order_type:          order.order_type || 'auction',
      status:              resolveStatus(order),
      total_amount:        order.total_amount,
      payment_method:      order.payment_method,
      shipping_fee:        order.shipping_fee,
      tracking_number:     order.tracking_number,
      courier:             order.courier,
      payment_confirmed:   order.payment_confirmed || false,
      payment_confirmed_at: order.payment_confirmed_at || null,
      placed_at:           order.placed_at,
      buyer: order.User ? {
        user_id: order.User.user_id,
        name: `${order.User.Fname || ''} ${order.User.Lname || ''}`.trim(),
        email: order.User.email,
        avatar: order.User.Avatar
      } : null,
      product: {
        products_id: order.Auctions?.Products?.products_id,
        name:        order.Auctions?.Products?.name || 'Auction Item',
        image:       order.Auctions?.Products?.Product_Images?.[0]?.image_url || null,
        final_price: order.Auctions?.final_price
      }
    }));

    // Fixed-price/cart orders are regular Orders rows with seller_id.
    const { data: regularOrders, error: regularError } = await supabase
      .from('Orders')
      .select(`
        order_id, user_id, seller_id, status, total_amount,
        payment_method, shipping_fee, tracking_number, courier,
        placed_at, payment_confirmed, payment_confirmed_at, order_type,
        User!user_id ( user_id, Fname, Lname, email, Avatar ),
        Order_items (
          products_id, quantity, unit_price, subtotal,
          Products ( products_id, name, Product_Images ( image_url ) )
        )
      `)
      .eq('seller_id', seller_id)
      .or('auction_id.is.null,order_type.eq.regular')
      .order('placed_at', { ascending: false });

    if (regularError) return res.status(500).json({ error: regularError.message });

    const formattedRegularOrders = (regularOrders || []).map(order => {
      const firstItem = order.Order_items?.[0];
      const extraCount = Math.max((order.Order_items?.length || 0) - 1, 0);
      const productName = firstItem?.Products?.name || 'Fixed Price Item';
      return {
        order_id:            order.order_id,
        auction_id:          null,
        order_type:          order.order_type || 'regular',
        status:              resolveStatus(order),
        total_amount:        order.total_amount,
        payment_method:      order.payment_method,
        shipping_fee:        order.shipping_fee,
        tracking_number:     order.tracking_number,
        courier:             order.courier,
        payment_confirmed:   order.payment_confirmed || order.payment_method === 'cash_on_delivery',
        payment_confirmed_at: order.payment_confirmed_at || null,
        placed_at:           order.placed_at,
        buyer: order.User ? {
          user_id: order.User.user_id,
          name: `${order.User.Fname || ''} ${order.User.Lname || ''}`.trim(),
          email: order.User.email,
          avatar: order.User.Avatar
        } : null,
        product: {
          products_id: firstItem?.Products?.products_id || firstItem?.products_id,
          name: extraCount > 0 ? `${productName} +${extraCount} more` : productName,
          image: firstItem?.Products?.Product_Images?.[0]?.image_url || null,
          final_price: order.total_amount
        }
      };
    });

    // ── Also surface auctions that have a winner but no Order row yet (pending payment) ──
    const orderedAuctionIds = new Set(data.filter(o => o.status !== 'cancelled').map(o => o.auction_id));
    const pendingAuctions = (sellerAuctions || []).filter(
      a => a.winner_user_id && !orderedAuctionIds.has(a.auction_id) && ['success', 'ended'].includes(a.status)
    );

    const pendingOrders = [];
    if (pendingAuctions.length > 0) {
      const winnerIds = [...new Set(pendingAuctions.map(a => a.winner_user_id))];
      const { data: winners } = await supabase
        .from('User')
        .select('user_id, Fname, Lname, email, Avatar')
        .in('user_id', winnerIds);
      const winnerMap = Object.fromEntries((winners || []).map(w => [w.user_id, w]));

      for (const auction of pendingAuctions) {
        const winner = winnerMap[auction.winner_user_id];
        const { data: pw } = await supabase
          .from('Payment_Windows')
          .select('payment_deadline')
          .eq('auction_id', auction.auction_id)
          .eq('winner_user_id', auction.winner_user_id)
          .eq('payment_completed', false)
          .maybeSingle();

        // Only surface as pending if there is an active payment window for the current winner.
        // This prevents stale/test auctions with no live window from appearing.
        if (!pw) continue;

        pendingOrders.push({
          order_id:          `pending_${auction.auction_id}`,
          auction_id:        auction.auction_id,
          status:            'pending_payment',
          total_amount:      auction.final_price,
          payment_method:    null,
          tracking_number:   null,
          courier:           null,
          payment_confirmed: false,
          placed_at:         null,
          payment_deadline:  pw?.payment_deadline || null,
          buyer: winner ? {
            user_id: winner.user_id,
            name: `${winner.Fname || ''} ${winner.Lname || ''}`.trim(),
            email: winner.email,
            avatar: winner.Avatar
          } : null,
          product: {
            products_id: auction.Products?.products_id,
            name:        auction.Products?.name || 'Auction Item',
            image:       auction.Products?.Product_Images?.[0]?.image_url || null,
            final_price: auction.final_price
          }
        });
      }
    }

    const realOrders = [...formattedAuctionOrders, ...formattedRegularOrders]
      .sort((a, b) => new Date(b.placed_at || 0) - new Date(a.placed_at || 0));

    // Pending payment orders first, then real orders newest-first
    res.json([...pendingOrders, ...realOrders]);
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
    } else {
      const { data: itemData } = await supabase
        .from('Order_items')
        .select('Products(name)')
        .eq('order_id', order_id)
        .limit(1)
        .maybeSingle();
      productName = itemData?.Products?.name || productName;
    }

    await supabase
      .from('Notifications')
      .insert([{
        user_id: order.user_id,
        type: 'order_update',
        payload: {
          title: '✅ Payment Confirmed',
          message: `The seller has confirmed your payment for "${productName}". Your item is being prepared for shipping.`,
          order_id,
          auction_id: order.auction_id || null,
          product_name: productName
        },
        reference_id: order_id,
        reference_type: 'order',
        read_at: '2099-12-31T23:59:59.000Z'
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
      .select('order_id, status, user_id, auction_id, order_type, payment_method, payment_confirmed, payment_confirmed_at')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !order) return res.status(404).json({ error: 'Order not found' });
    const isLegacyCodRegular =
      order.status === 'pending_payment' &&
      order.payment_method === 'cash_on_delivery' &&
      (order.order_type === 'regular' || !order.auction_id);

    if (order.status !== 'processing' && !isLegacyCodRegular) {
      return res.status(400).json({ error: `Cannot ship order with status: ${order.status}. Order must be in processing state.` });
    }
    if (!order.payment_confirmed && !isLegacyCodRegular) {
      return res.status(400).json({ error: 'You must confirm payment received before marking the order as shipped.' });
    }

    // Update order with tracking info and change status to shipped
    const { data: updated, error: updateError } = await supabase
      .from('Orders')
      .update({
        status: 'shipped',
        tracking_number,
        courier,
        payment_confirmed: true,
        payment_confirmed_at: order.payment_confirmed_at || new Date().toISOString()
      })
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
    } else {
      const { data: itemData } = await supabase
        .from('Order_items')
        .select('Products(name)')
        .eq('order_id', order_id)
        .limit(1)
        .maybeSingle();
      productName = itemData?.Products?.name || productName;
    }

    // Notify buyer of shipment
    await supabase
      .from('Notifications')
      .insert([{
        user_id: order.user_id,
        type: 'order_update',
        payload: {
          title: '🚚 Your order has been shipped!',
          message: `"${productName}" is on its way. Courier: ${courier} · Tracking #: ${tracking_number}`,
          order_id,
          auction_id: order.auction_id || null,
          product_name: productName
        },
        reference_id: order_id,
        reference_type: 'order',
        read_at: '2099-12-31T23:59:59.000Z'
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
        .select('seller_id, Products(name)')
        .eq('auction_id', order.auction_id)
        .single();

      const productName = auctionData?.Products?.name || 'your item';

      // Resolve seller user_id directly via seller_id (avoid nested join null issues)
      let sellerUserId = null;
      if (auctionData?.seller_id) {
        const { data: sellerRow } = await supabase
          .from('Seller').select('user_id').eq('seller_id', auctionData.seller_id).maybeSingle();
        sellerUserId = sellerRow?.user_id || null;
      }

      if (sellerUserId) {
        await supabase
          .from('Notifications')
          .insert([{
            user_id: sellerUserId,
            type: 'order_update',
            payload: {
              title: '✅ Order Completed',
              message: `Buyer confirmed receipt of "${productName}". The transaction is complete.`,
              order_id,
              auction_id: order.auction_id,
              product_name: productName
            },
            reference_id: order.auction_id,
            reference_type: 'auction',
            read_at: '2099-12-31T23:59:59.000Z'
          }]);
        console.log(`🔔 Seller notified of completion (user ${sellerUserId})`);
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

// Fetch receipt data for a single order (accessible by buyer and seller)
export const getOrderReceipt = async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data: order, error } = await supabase
      .from('Orders')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found' });

    // Buyer info
    const { data: buyer } = await supabase
      .from('User')
      .select('user_id, Fname, Lname, email')
      .eq('user_id', order.user_id)
      .maybeSingle();

    // Auction + product
    const { data: auction } = await supabase
      .from('Auctions')
      .select('auction_id, final_price, Products(name, Product_Images(image_url))')
      .eq('auction_id', order.auction_id)
      .maybeSingle();

    // Seller store info
    const { data: seller } = await supabase
      .from('Seller')
      .select('seller_id, store_name, logo_url')
      .eq('seller_id', order.seller_id)
      .maybeSingle();

    // Shipping address
    let shippingAddress = null;
    if (order.shipping_address_id) {
      const { data: addr } = await supabase
        .from('Addresses')
        .select('*')
        .eq('address_id', order.shipping_address_id)
        .maybeSingle();
      shippingAddress = addr;
    }

    res.json({
      order_id:          order.order_id,
      payment_reference: order.payment_reference || null,
      paid_at:           order.paid_at || null,
      payment_method:    order.payment_method,
      total_amount:      order.total_amount,
      shipping_fee:      order.shipping_fee,
      status:            order.status,
      placed_at:         order.placed_at,
      tracking_number:   order.tracking_number || null,
      courier:           order.courier || null,
      auction_id:        order.auction_id,
      buyer: buyer ? {
        name:  `${buyer.Fname || ''} ${buyer.Lname || ''}`.trim(),
        email: buyer.email
      } : null,
      seller: seller ? {
        name:  seller.store_name,
        logo:  seller.logo_url || null
      } : null,
      product: auction?.Products ? {
        name:  auction.Products.name,
        image: auction.Products.Product_Images?.[0]?.image_url || null,
        price: auction.final_price
      } : null,
      shipping_address: shippingAddress
    });
  } catch (err) {
    console.error('getOrderReceipt error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
