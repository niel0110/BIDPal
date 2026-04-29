import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    // Try selecting commission columns from Orders (no rows needed)
    const { data, error } = await supabase
      .from('Orders')
      .select('commission_rate, commission_amount')
      .limit(1);
    if (error) {
      console.error('Column check error (Orders):', error.message);
    } else {
      console.log('Orders commission columns exist. Sample row:', data);
    }
  } catch (e) {
    console.error('Exception during Orders column check:', e);
  }
}

async function checkPlatformEarnings() {
  try {
    const { data, error } = await supabase
      .from('Platform_Earnings')
      .select('order_id, commission_amount')
      .limit(1);
    if (error) {
      console.error('Platform_Earnings check error:', error.message);
    } else {
      console.log('Platform_Earnings table exists. Sample row:', data);
    }
  } catch (e) {
    console.error('Exception during Platform_Earnings check:', e);
  }
}

(async () => {
  await checkColumns();
  await checkPlatformEarnings();
})();
