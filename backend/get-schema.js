import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getTables() {
    let { data: tables, error: tablesErr } = await supabase.from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
        
    if(tablesErr) { console.error(tablesErr); return; }
    
    for (let table of tables) {
        let { data: columns } = await supabase.from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_schema', 'public')
            .eq('table_name', table.table_name);
            
        console.log('\nTable:', table.table_name);
        console.log(columns.map(c => `  ${c.column_name} (${c.data_type})`).join('\n'));
    }
}

getTables();
