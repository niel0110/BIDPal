import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env before importing supabase config
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

// Now import supabase (it will use the loaded env)
import { supabase } from './backend/config/supabase.js';
import fs from 'fs';

async function runMigration() {
    console.log('🚀 Running Admin Migration...');
    
    const sqlPath = path.join(process.cwd(), 'backend', 'migrations', 'admin_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements for easier execution if needed, 
    // or run as a single string via a helper if available.
    // Since 'exec_sql' is a custom RPC usually found in these projects:
    
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.error('❌ Migration failed:', error.message);
            
            // Fallback: try running statements one by one if exec_sql fails
            console.log('Attempting manual execution of individual statements...');
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
                
            for (const statement of statements) {
                console.log(`Running: ${statement.substring(0, 50)}...`);
                const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement });
                if (stmtError) console.error(`   Failed: ${stmtError.message}`);
                else console.log('   ✅ Success');
            }
        } else {
            console.log('✅ Migration completed successfully!');
        }
    } catch (err) {
        console.error('💥 Unexpected error:', err.message);
    }
}

runMigration();
