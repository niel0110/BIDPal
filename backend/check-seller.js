import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';

async function checkSeller() {
    const userId = '43e6d0f9-a279-4db6-963d-e2e7ff2ec3db';

    console.log('🔍 Checking Seller record for user_id:', userId);

    try {
        // Check if seller exists
        const { data: seller, error } = await supabase
            .from('Seller')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('❌ Error querying Seller:', error);
            return;
        }

        if (seller) {
            console.log('✅ Seller found:');
            console.log(JSON.stringify(seller, null, 2));
        } else {
            console.log('⚠️  No Seller record found for this user_id');

            // Check if user exists
            const { data: user, error: userError } = await supabase
                .from('User')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (userError) {
                console.error('❌ Error querying User:', userError);
                return;
            }

            if (user) {
                console.log('✅ User exists:', JSON.stringify(user, null, 2));
                console.log('\n💡 You need to create a Seller record for this user.');
            } else {
                console.log('❌ User not found with this user_id');
            }
        }
    } catch (err) {
        console.error('💥 Unexpected error:', err);
    }
}

checkSeller();
