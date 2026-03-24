import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';

async function checkSellerSchema() {
    console.log('🔍 Checking Seller table schema...');
    try {
        // Query one record to see columns
        const { data, error } = await supabase
            .from('Seller')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Error querying Seller:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('✅ Columns found:', Object.keys(data[0]));
        } else {
            console.log('⚠️  No data found in Seller table, trying to insert a test record to see required fields...');
        }
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

checkSellerSchema();
