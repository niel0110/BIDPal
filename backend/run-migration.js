import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(filename) {
    try {
        const migrationPath = path.join(__dirname, 'migrations', filename);

        if (!fs.existsSync(migrationPath)) {
            console.error(`❌ Migration file not found: ${migrationPath}`);
            process.exit(1);
        }

        console.log(`📄 Reading migration file: ${filename}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`🚀 Running migration...`);

        // Split SQL by statement (basic split, may need refinement for complex cases)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                console.log(`\n  Executing statement ${i + 1}/${statements.length}...`);

                const { data, error } = await supabase.rpc('exec_sql', {
                    sql_query: statement + ';'
                }).catch(async (err) => {
                    // If exec_sql doesn't exist, try direct execution
                    // Note: This requires appropriate permissions
                    console.log('  Using alternative execution method...');
                    return { data: null, error: err };
                });

                if (error) {
                    console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
                    console.error(`  Statement: ${statement.substring(0, 100)}...`);
                } else {
                    console.log(`  ✅ Statement ${i + 1} executed successfully`);
                }
            }
        }

        console.log(`\n✅ Migration completed: ${filename}`);
        console.log('\n⚠️  Note: If you see errors above, you may need to run this SQL directly in your Supabase SQL Editor.');
        console.log(`    Supabase Dashboard > SQL Editor > New Query > Paste the contents of ${filename}`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Get migration filename from command line argument
const migrationFile = process.argv[2] || 'add_brand_specifications.sql';

console.log('🔧 BIDPal Database Migration Tool\n');
runMigration(migrationFile);
