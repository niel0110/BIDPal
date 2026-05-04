import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('🚀 Running Cart Hoarding Migration...');
    
    const sql = `
        ALTER TABLE "Cart_items" ADD COLUMN IF NOT EXISTS "is_stashed" BOOLEAN DEFAULT FALSE;
        
        -- Ensure added_at exists
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Cart_items' AND column_name='added_at') THEN
                ALTER TABLE "Cart_items" ADD COLUMN "added_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            END IF;
        END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Error executing SQL:', error.message);
        console.log('\n⚠️ If exec_sql is missing, please run this in Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.log('✅ Column is_stashed added successfully!');
    }
}

run();
