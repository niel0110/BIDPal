import { supabase } from './config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🚀 Running Admin Migration (from backend subfolder)...');
    
    const sqlPath = path.join(__dirname, 'migrations', 'admin_migration.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error('❌ SQL file not found at:', sqlPath);
        return;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.error('❌ Migration failed:', error.message);
            
            // Fallback: try running statements one by one
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
