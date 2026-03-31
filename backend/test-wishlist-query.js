import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
    const { data, error } = await supabase
        .from('Auction_Likes')
        .select(`
            auction_id,
            liked_at,
            Auctions (
                auction_id,
                products_id,
                seller_id,
                status,
                Seller (
                    store_name
                )
            )
        `)
        .limit(1);

    if (error) {
        console.error('Supabase Error:', error);
    } else {
        console.log('Success:', JSON.stringify(data, null, 2));
    }
}

testQuery();
