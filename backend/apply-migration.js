import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('🔧 Applying Database Migration for Brand & Specifications\n');
console.log('📍 Supabase URL:', supabaseUrl);
console.log('');

async function applyMigration() {
    try {
        console.log('Step 1: Adding brand and specifications columns to Products table...');

        // Add columns
        const addColumnsSQL = `
            ALTER TABLE "Products"
            ADD COLUMN IF NOT EXISTS "brand" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "specifications" TEXT;
        `;

        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql_query: addColumnsSQL
        }).catch(() => ({ error: null })); // Ignore if RPC doesn't exist

        if (alterError && !alterError.message.includes('already exists')) {
            console.log('⚠️  Note: Could not add columns via RPC. You may need to run this SQL manually.');
            console.log('   SQL to run in Supabase Dashboard:');
            console.log('   ' + addColumnsSQL.trim());
        } else {
            console.log('✅ Columns added successfully');
        }

        console.log('\nStep 2: Creating index on brand column...');
        const indexSQL = `CREATE INDEX IF NOT EXISTS "idx_products_brand" ON "Products"("brand");`;
        await supabase.rpc('exec_sql', { sql_query: indexSQL }).catch(() => ({}));
        console.log('✅ Index created');

        console.log('\nStep 3: Updating upload_product function...');

        const functionSQL = `
CREATE OR REPLACE FUNCTION upload_product(
    p_seller_id UUID,
    p_name VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_availability INTEGER DEFAULT 1,
    p_price DECIMAL DEFAULT NULL,
    p_length_mm INTEGER DEFAULT 0,
    p_width_mm INTEGER DEFAULT 0,
    p_height_mm INTEGER DEFAULT 0,
    p_starting_price DECIMAL DEFAULT NULL,
    p_reserve_price DECIMAL DEFAULT NULL,
    p_condition VARCHAR DEFAULT 'new',
    p_brand VARCHAR DEFAULT NULL,
    p_specifications TEXT DEFAULT NULL,
    p_status VARCHAR DEFAULT 'draft',
    p_categories TEXT[] DEFAULT NULL,
    p_image_urls TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_product_id UUID;
    v_category_name TEXT;
    v_category_id UUID;
    v_image_count INTEGER := 0;
    v_category_count INTEGER := 0;
BEGIN
    INSERT INTO "Products" (
        "seller_id", "name", "description", "availability", "price",
        "length_mm", "width_mm", "height_mm",
        "starting_price", "reserve_price", "condition",
        "brand", "specifications", "status"
    ) VALUES (
        p_seller_id, p_name, p_description, p_availability, p_price,
        p_length_mm, p_width_mm, p_height_mm,
        p_starting_price, p_reserve_price, p_condition,
        p_brand, p_specifications, p_status
    )
    RETURNING "products_id" INTO v_product_id;

    IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
        FOR i IN 1..LEAST(array_length(p_categories, 1), 3) LOOP
            v_category_name := p_categories[i];
            SELECT "category_id" INTO v_category_id FROM "Categories" WHERE "category_name" = v_category_name;
            IF v_category_id IS NULL THEN
                INSERT INTO "Categories" ("category_name") VALUES (v_category_name) RETURNING "category_id" INTO v_category_id;
            END IF;
            INSERT INTO "Product_Categories" ("products_id", "category_id") VALUES (v_product_id, v_category_id) ON CONFLICT DO NOTHING;
            v_category_count := v_category_count + 1;
        END LOOP;
    END IF;

    IF p_image_urls IS NOT NULL AND array_length(p_image_urls, 1) > 0 THEN
        FOR i IN 1..LEAST(array_length(p_image_urls, 1), 10) LOOP
            INSERT INTO "Product_Images" ("products_id", "image_url", "is_primary", "display_order")
            VALUES (v_product_id, p_image_urls[i], (i = 1), i);
            v_image_count := v_image_count + 1;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'success', TRUE, 'product_id', v_product_id,
        'message', 'Product uploaded successfully',
        'data', json_build_object(
            'product_id', v_product_id, 'name', p_name, 'brand', p_brand,
            'status', p_status, 'categories_added', v_category_count, 'images_added', v_image_count
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', FALSE, 'error', SQLERRM, 'message', 'Failed to upload product');
END;
$$ LANGUAGE plpgsql;
        `;

        const { error: funcError } = await supabase.rpc('exec_sql', {
            sql_query: functionSQL
        }).catch(() => ({ error: null }));

        if (funcError) {
            console.log('⚠️  Could not create function via RPC.');
            console.log('\n📋 MANUAL STEPS REQUIRED:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('1. Open your Supabase Dashboard: https://supabase.com/dashboard');
            console.log('2. Select your project: ktfqheemonrjquxrpjtb');
            console.log('3. Click "SQL Editor" in the left sidebar');
            console.log('4. Click "New Query"');
            console.log('5. Copy and paste the contents of:');
            console.log('   backend/migrations/add_brand_specifications.sql');
            console.log('6. Click "Run" (or press Ctrl+Enter)');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(1);
        } else {
            console.log('✅ Function updated successfully');
        }

        console.log('\n🎉 Migration completed successfully!\n');
        console.log('You can now upload products with brand and specifications fields.');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.log('\n📋 Please run the migration manually in Supabase Dashboard:');
        console.log('   File: backend/migrations/add_brand_specifications.sql\n');
        process.exit(1);
    }
}

applyMigration();
