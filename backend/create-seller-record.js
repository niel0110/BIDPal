import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';

async function createSellerRecord() {
    const userId = '43e6d0f9-a279-4db6-963d-e2e7ff2ec3db';

    console.log('🔄 Creating Seller record for user_id:', userId);

    try {
        // First update user role to seller
        const { data: updatedUser, error: roleError } = await supabase
            .from('User')
            .update({ role: 'seller' })
            .eq('user_id', userId)
            .select()
            .single();

        if (roleError) {
            console.error('❌ Error updating user role:', roleError);
            return;
        }

        console.log('✅ Updated user role to seller');

        // Create Seller record
        const { data: seller, error: sellerError } = await supabase
            .from('Seller')
            .insert([
                {
                    user_id: userId,
                    store_name: 'My Store', // Default store name
                    store_handle: 'my-store-' + Date.now(), // Unique handle
                    store_description: 'Welcome to my store!',
                    business_category: 'general',
                    logo_url: null,
                    banner_url: null
                }
            ])
            .select()
            .single();

        if (sellerError) {
            console.error('❌ Error creating Seller:', sellerError);
            return;
        }

        console.log('✅ Seller record created successfully:');
        console.log(JSON.stringify(seller, null, 2));

        console.log('\n✅ Done! You can now access the seller dashboard.');

    } catch (err) {
        console.error('💥 Unexpected error:', err);
    }
}

createSellerRecord();
