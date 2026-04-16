import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdminPassword() {
    const email = 'adminBidpal@gmail.com';
    const newPassword = 'admin123';
    
    console.log(`Resetting password for ${email} to "${newPassword}"...`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const { data, error } = await supabase
        .from('User')
        .update({ password: hashedPassword })
        .eq('email', email)
        .select();

    if (error) {
        console.error('Error resetting password:', error);
        return;
    }

    if (data.length === 0) {
        console.log(`User ${email} not found.`);
    } else {
        console.log('✅ Password reset successfully!');
    }
}

resetAdminPassword();
