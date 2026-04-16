import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAdmin() {
    console.log('Searching for users with role "Admin"...');
    const { data, error } = await supabase
        .from('User')
        .select('email, role')
        .eq('role', 'Admin');

    if (error) {
        console.error('Error fetching admins:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No users with Admin role found.');
        
        // Try without case sensitivity or different role names
        console.log('Searching for any users to see role formatting...');
        const { data: anyUsers } = await supabase.from('User').select('email, role').limit(5);
        if (anyUsers) {
            console.log('Sample users:');
            anyUsers.forEach(u => console.log(`- Email: ${u.email}, Role: ${u.role}`));
        }
    } else {
        console.log('Admin users found:');
        data.forEach(user => {
            console.log(`- Email: ${user.email}, Role: ${user.role}`);
        });
    }
}

findAdmin();
