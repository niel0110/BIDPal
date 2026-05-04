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

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = 'adminBidpal@gmail.com';
    const password = 'admin123';
    
    console.log(`Creating admin user: ${email}...`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('email', email)
        .single();
        
    if (existingUser) {
        console.log('User already exists, updating role and password...');
        const { error: updateError } = await supabase
            .from('User')
            .update({ 
                role: 'Admin',
                password: hashedPassword
            })
            .eq('id', existingUser.id);
            
        if (updateError) {
            console.error('Error updating user:', updateError);
        } else {
            console.log('✅ User updated successfully!');
        }
    } else {
        console.log('User does not exist, inserting...');
        const { error: insertError } = await supabase
            .from('User')
            .insert([{
                email,
                password: hashedPassword,
                role: 'Admin',
                Fname: 'Platform',
                Lname: 'Admin'
            }]);
            
        if (insertError) {
            console.error('Error inserting user:', insertError);
        } else {
            console.log('✅ Admin user created successfully!');
        }
    }
}

createAdmin();
