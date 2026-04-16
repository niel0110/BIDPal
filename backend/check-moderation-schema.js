import { supabase } from './config/supabase.js';

async function checkModerationSchema() {
    try {
        const { data, error } = await supabase
            .from('Moderation_Cases')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('❌ Error querying Moderation_Cases:', error);
        } else if (data && data.length > 0) {
            console.log('✅ Moderation_Cases Columns:', Object.keys(data[0]));
        } else {
            // Try to get columns even if empty
            console.log('⚠️ No data, columns might exist but table empty.');
        }
    } catch (err) {
        console.error('💥 Unexpected error:', err.message);
    }
}

checkModerationSchema();
