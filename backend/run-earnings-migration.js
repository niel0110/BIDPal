import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const migrationPath = path.join(__dirname, 'migrations', 'add_platform_earnings.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Supabase JS doesn't support raw SQL execution directly except via RPC.
    // If exec_sql RPC exists, use it. If not, this might fail.
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Error executing SQL via RPC:', error);
        console.log('\n--- PLEASE RUN THIS SQL IN THE SUPABASE SQL EDITOR MANUALLY ---');
        console.log(sql);
    } else {
        console.log('Migration executed successfully.');
    }
}

run();
