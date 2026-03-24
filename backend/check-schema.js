import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';

async function checkSchema() {
    console.log('🔍 Checking Auctions table schema...');
    try {
        // Query one record to see columns
        const { data, error } = await supabase
            .from('Auctions')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('❌ Error querying Auctions:', error);
            return;
        }
        
        if (data && data.length > 0) {
            console.log('✅ Columns found:', Object.keys(data[0]));
        } else {
            // If no data, try to get column names via an empty query result or system catalogs
            // This is harder with Supabase JS, so I'll try to just select * from information_schema if possible
            const { data: cols, error: colError } = await supabase
                .rpc('get_table_columns', { table_name: 'Auctions' });
            
            if (colError) {
                console.log('⚠️ Could not fetch columns via RPC, trying another way...');
                // Try a generic query
                const { data: sample } = await supabase.from('Auctions').select('*').limit(0);
                // Supabase doesn't return headers easily in JS without meta: true
            } else {
                 console.log('✅ Columns found via RPC:', cols);
            }
        }
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

checkSchema();
