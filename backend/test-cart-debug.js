import { supabase } from './config/supabase.js';

async function debugCartFetch() {
    try {
        // 1. Get a test user
        const { data: users, error: userError } = await supabase.from('User').select('user_id, email').limit(1);
        if (userError) throw userError;
        if (!users || users.length === 0) {
            console.log('No users found in database');
            return;
        }
        const user = users[0];
        console.log(`Testing with user: ${user.email} (${user.user_id})`);

        // Test with invalid UUID format
        console.log('\nTesting with invalid UUID format (user_id = "1")...');
        const { data: invalidCart, error: invalidError } = await supabase
            .from('Carts')
            .select('cart_id')
            .eq('user_id', '1')
            .maybeSingle();
        
        if (invalidError) {
            console.log('Error for invalid UUID format:', invalidError.code, invalidError.message);
        } else {
            console.log('No error for invalid UUID format (unexpected)', invalidCart);
        }

        // 3. Try the join query from cartController.js
        console.log('Testing join query...');
        const { data, error } = await supabase
            .from('Cart_items')
            .select(`
                cartItem_id,
                product_id,
                quantity,
                Products (
                    name,
                    price,
                    condition,
                    description,
                    Product_Images (
                        image_url
                    ),
                    Seller (
                        store_name
                    )
                )
            `)
            .limit(5);

        if (error) {
            console.error('Join query error:', error);
            if (error.hint) console.log('Hint:', error.hint);
            if (error.details) console.log('Details:', error.details);
        } else {
            console.log('Join query successful. Results:', data.length);
            if (data.length > 0) {
                console.log('Example item:', JSON.stringify(data[0], null, 2));
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

debugCartFetch();
