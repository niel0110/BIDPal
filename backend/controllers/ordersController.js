import { supabase } from '../config/supabase.js';

// Fetch all orders for a buyer
export const getOrdersByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
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

    if (error) return res.status(500).json({ error: error.message });

    // Format for frontend
    const formattedData = data.map(order => ({
        id: order.order_id,
        date: new Date(order.placed_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: '2-digit', 
            year: 'numeric' 
        }),
        status: order.status,
        total: order.total_amount,
        items: order.Order_items.map(item => ({
            name: item.Products?.name || 'Unknown Product',
            qty: item.quantity,
            price: item.unit_price,
            image: item.Products?.Product_Images?.[0]?.image_url || null
        })),
        seller: 'Various Sellers'
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
    const { buyer_id: user_id, address_id, total_amount, items, payment_method = 'cod' } = req.body;

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
