/**
 * fix-availability.js
 * Resets availability to 1 for all fixed-price products that are not sold/draft
 * and currently have availability != 1.
 *
 * Run: node fix-availability.js
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // 1. Show current state
    const { data: products, error: fetchErr } = await supabase
        .from('Products')
        .select('products_id, name, status, availability, price')
        .not('price', 'is', null)     // fixed-price = has a price
        .not('status', 'in', '("sold","draft")');

    if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

    console.log('\n=== Current fixed-price product availability ===');
    console.table(products.map(p => ({
        id: p.products_id.slice(0, 8),
        name: p.name,
        status: p.status,
        availability: p.availability,
        price: p.price
    })));

    const toFix = products.filter(p => p.availability !== 1);
    if (toFix.length === 0) {
        console.log('\n✅ All fixed-price products already have availability = 1. Nothing to fix.');
        return;
    }

    console.log(`\n⚠️  Found ${toFix.length} product(s) with wrong availability. Fixing...`);

    // 2. Reset each one to availability = 1
    for (const p of toFix) {
        const { error: upErr } = await supabase
            .from('Products')
            .update({ availability: 1 })
            .eq('products_id', p.products_id);

        if (upErr) {
            console.error(`  ❌ Failed to update "${p.name}": ${upErr.message}`);
        } else {
            console.log(`  ✅ Fixed "${p.name}" — was ${p.availability}, now 1`);
        }
    }

    // 3. Verify
    const { data: after } = await supabase
        .from('Products')
        .select('products_id, name, availability')
        .not('price', 'is', null)
        .not('status', 'in', '("sold","draft")');

    console.log('\n=== After fix ===');
    console.table(after.map(p => ({
        id: p.products_id.slice(0, 8),
        name: p.name,
        availability: p.availability
    })));

    console.log('\n✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
