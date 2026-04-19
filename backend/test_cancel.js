import { supabase } from './config/supabase.js';
import { processCancellation } from './services/cancellationService.js';

async function testCancel() {
  try {
    // get a recent order
    const { data: orders, error: ordersErr } = await supabase
      .from('Orders')
      .select('*')
      .neq('status', 'cancelled')
      .limit(1);
      
    if (ordersErr) throw ordersErr;
    if (!orders || orders.length === 0) {
      console.log('No orders to test');
      return;
    }
    
    const order = orders[0];
    console.log('Testing payload:', {
      user_id: order.user_id,
      auction_id: order.auction_id,
      order_id: order.order_id,
      reason: 'test error'
    });

    const res = await processCancellation({
      user_id: order.user_id,
      auction_id: order.auction_id,
      order_id: order.order_id,
      reason: 'test error'
    });
    console.log('Success:', res);
  } catch(e) {
    console.error('Error caught during cancellation:', e);
  }
  process.exit(0);
}

testCancel();
