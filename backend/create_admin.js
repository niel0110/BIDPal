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
    const email = 'bidpal.support@gmail.com';
    const typoEmail = 'bidpal.suppor@gmail.com';
    const previousEmail = 'adminBidpal@gmail.com';
    const password = 'bidpal2026';
    
    console.log(`Creating admin user: ${email}...`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const { data: existingUser } = await supabase
        .from('User')
        .select('user_id')
        .ilike('email', email)
        .maybeSingle();

    const { data: typoAdmin } = await supabase
        .from('User')
        .select('user_id')
        .ilike('email', typoEmail)
        .maybeSingle();

    const { data: previousAdmin } = await supabase
        .from('User')
        .select('user_id')
        .ilike('email', previousEmail)
        .maybeSingle();
        
    if (existingUser) {
        console.log('User already exists, updating role and password...');
        const { error: updateError } = await supabase
            .from('User')
            .update({ 
                role: 'Admin',
                password: hashedPassword
            })
            .eq('user_id', existingUser.user_id);
            
        if (updateError) {
            console.error('Error updating user:', updateError);
        } else {
            console.log('✅ User updated successfully!');
        }
    } else if (typoAdmin || previousAdmin) {
        console.log('Previous admin found, updating email, role, and password...');
        const { error: updateError } = await supabase
            .from('User')
            .update({
                email,
                role: 'Admin',
                password: hashedPassword,
                Fname: 'BIDPal',
                Lname: 'Support'
            })
            .eq('user_id', (typoAdmin || previousAdmin).user_id);

        if (updateError) {
            console.error('Error updating previous admin:', updateError);
        } else {
            console.log('Admin account updated successfully!');
        }
    } else {
        console.log('User does not exist, inserting...');
        const { error: insertError } = await supabase
            .from('User')
            .insert([{
                email,
                password: hashedPassword,
                role: 'Admin',
                Fname: 'BIDPal',
                Lname: 'Support'
            }]);
            
        if (insertError) {
            console.error('Error inserting user:', insertError);
        } else {
            console.log('✅ Admin user created successfully!');
        }
    }
}

createAdmin();
