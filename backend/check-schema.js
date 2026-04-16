import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';

async function checkSchema() {
    console.log('🔍 Checking Violation_Records table schema...');
    try {
        const { data, error } = await supabase
            .from('Violation_Records')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('❌ Error querying Violation_Records:', error);
        } else if (data && data.length > 0) {
            console.log('✅ Violation_Records Columns:', Object.keys(data[0]));
        } else {
            console.log('⚠️ No data in Violation_Records to infer columns.');
        }

        console.log('\n🔍 Checking User table schema...');
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('*')
            .limit(1);
        
        if (userError) {
            console.error('❌ Error querying User:', userError);
        } else if (userData && userData.length > 0) {
            console.log('✅ User Columns:', Object.keys(userData[0]));
        }
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

checkSchema();
