import { supabase } from '../config/supabase.js';

async function cleanupTestData() {
  console.log('🧹 Starting test data cleanup...');

  try {
    // 1. Delete all order-related data
    console.log('🗑 Deleting order items...');
    await supabase.from('Order_items').delete().gte('orderItem_id', 0);
    
    console.log('🗑 Deleting orders...');
    await supabase.from('Orders').delete().neq('order_id', '00000000-0000-0000-0000-000000000000');
    
    console.log('🗑 Deleting cancellations...');
    await supabase.from('Order_Cancellations').delete().gte('cancellation_id', 0);
    
    console.log('🗑 Deleting payment windows...');
    await supabase.from('payment_windows').delete().gte('payment_window_id', 0);

    console.log('🗑 Deleting auction winners...');
    await supabase.from('Auction_winners').delete().gte('winner_id', 0);

    // 2. Reset Products
    console.log('🔄 Resetting all products to status="active" and availability=1...');
    const { error: productError } = await supabase
      .from('Products')
      .update({ 
        status: 'active', 
        availability: 1 
      })
      .neq('products_id', '00000000-0000-0000-0000-000000000000');

    if (productError) throw productError;

    // 3. Reset Auctions that were completed/ended back to scheduled or active if they have products
    console.log('🔄 Resetting auctions...');
    await supabase
      .from('Auctions')
      .update({ 
        status: 'scheduled',
        winner_user_id: null,
        winning_bid_id: null,
        final_price: null,
        current_price: null
      })
      .neq('auction_id', 0);

    // 4. Clear Carts?
    console.log('🗑 Clearing all carts...');
    await supabase.from('Cart_items').delete().gte('cart_id', 0);

    console.log('✅ Cleanup complete!');
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
  }
}

cleanupTestData();
