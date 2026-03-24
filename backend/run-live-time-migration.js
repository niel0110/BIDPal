import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './config/supabase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    console.log('🚀 Running live time tracking migration...');

    try {
        // Read the SQL file
        const sqlPath = join(__dirname, 'migrations', 'add_live_time_tracking.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        console.log('📝 SQL Migration:');
        console.log(sql);
        console.log('\n🔄 Executing migration...\n');

        // Execute the SQL via RPC (you may need to execute this directly in Supabase SQL editor)
        // Since Supabase JS client doesn't support direct DDL, we'll need to run this manually
        // or use a SQL execution RPC function

        console.log('⚠️  NOTE: Supabase JS client does not support direct DDL execution.');
        console.log('📋 Please run the above SQL in your Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
        console.log('\n✅ After running the SQL, verify the schema by running: node check-schema.js');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

runMigration();
