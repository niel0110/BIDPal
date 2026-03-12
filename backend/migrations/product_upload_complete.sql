-- =====================================================
-- PRODUCT UPLOAD SQL - COMPLETE STRUCTURE
-- Based on BIDPal Add Product Form
-- =====================================================

-- STEP 1: Create Products Table with All Attributes
-- =====================================================
CREATE TABLE IF NOT EXISTS "Products" (
    -- Primary Key
    "products_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Seller Reference
    "seller_id" UUID NOT NULL REFERENCES "Seller"("seller_id") ON DELETE CASCADE,

    -- Basic Information (Step 1: Description)
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "availability" INTEGER DEFAULT 1,
    "price" DECIMAL(12, 2),

    -- Dimensions (Optional)
    "length_mm" INTEGER DEFAULT 0,
    "width_mm" INTEGER DEFAULT 0,
    "height_mm" INTEGER DEFAULT 0,

    -- Additional Product Details
    "sku" VARCHAR(100) UNIQUE,
    "condition" VARCHAR(50) DEFAULT 'new' CHECK ("condition" IN ('new', 'like_new', 'good', 'fair', 'poor')),
    "status" VARCHAR(50) DEFAULT 'draft' CHECK ("status" IN ('draft', 'active', 'inactive', 'sold', 'archived')),

    -- Auction Pricing
    "starting_price" DECIMAL(12, 2),
    "reserve_price" DECIMAL(12, 2),

    -- Timestamps
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT "price_positive" CHECK ("price" >= 0),
    CONSTRAINT "availability_positive" CHECK ("availability" >= 0),
    CONSTRAINT "dimensions_positive" CHECK ("length_mm" >= 0 AND "width_mm" >= 0 AND "height_mm" >= 0)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS "idx_products_seller_id" ON "Products"("seller_id");
CREATE INDEX IF NOT EXISTS "idx_products_status" ON "Products"("status");
CREATE INDEX IF NOT EXISTS "idx_products_created_at" ON "Products"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_products_name_search" ON "Products" USING GIN(to_tsvector('english', "name"));

COMMENT ON TABLE "Products" IS 'Stores all product information for BIDPal marketplace';


-- STEP 2: Create Product Images Table (Step 3: Photos)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Product_Images" (
    "image_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "products_id" UUID NOT NULL REFERENCES "Products"("products_id") ON DELETE CASCADE,
    "image_url" TEXT NOT NULL,
    "file_name" VARCHAR(255),
    "file_size" BIGINT,
    "is_primary" BOOLEAN DEFAULT FALSE,
    "display_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_size_limit" CHECK ("file_size" IS NULL OR "file_size" <= 26214400) -- 25MB limit
);

CREATE INDEX IF NOT EXISTS "idx_product_images_products_id" ON "Product_Images"("products_id");
CREATE INDEX IF NOT EXISTS "idx_product_images_display_order" ON "Product_Images"("products_id", "display_order");


-- STEP 3: Create Categories Table (Step 2: Categories)
-- =====================================================
CREATE TABLE IF NOT EXISTS "Categories" (
    "category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "category_name" VARCHAR(100) NOT NULL UNIQUE,
    "parent_category" VARCHAR(100),
    "category_group" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_categories_name" ON "Categories"("category_name");
CREATE INDEX IF NOT EXISTS "idx_categories_group" ON "Categories"("category_group");


-- STEP 4: Create Product-Category Junction Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Product_Categories" (
    "product_category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "products_id" UUID NOT NULL REFERENCES "Products"("products_id") ON DELETE CASCADE,
    "category_id" UUID NOT NULL REFERENCES "Categories"("category_id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE("products_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "idx_product_categories_products_id" ON "Product_Categories"("products_id");
CREATE INDEX IF NOT EXISTS "idx_product_categories_category_id" ON "Product_Categories"("category_id");


-- STEP 5: Auto-Update Timestamp Trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "update_products_timestamp" ON "Products";
CREATE TRIGGER "update_products_timestamp"
    BEFORE UPDATE ON "Products"
    FOR EACH ROW
    EXECUTE FUNCTION update_product_timestamp();


-- STEP 6: Auto-Generate SKU if Not Provided
-- =====================================================
CREATE OR REPLACE FUNCTION generate_product_sku()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."sku" IS NULL OR NEW."sku" = '' THEN
        NEW."sku" = 'PRD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CURRENT_TIMESTAMP::TEXT) FROM 1 FOR 12));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "auto_generate_product_sku" ON "Products";
CREATE TRIGGER "auto_generate_product_sku"
    BEFORE INSERT ON "Products"
    FOR EACH ROW
    EXECUTE FUNCTION generate_product_sku();


-- STEP 7: Validate Seller Exists
-- =====================================================
CREATE OR REPLACE FUNCTION validate_product_seller()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "Seller" WHERE "seller_id" = NEW."seller_id") THEN
        RAISE EXCEPTION 'Seller with ID % does not exist', NEW."seller_id";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "validate_product_seller_trigger" ON "Products";
CREATE TRIGGER "validate_product_seller_trigger"
    BEFORE INSERT ON "Products"
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_seller();


-- STEP 8: Main Stored Procedure - Upload Product
-- =====================================================
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
    -- Insert the product
    INSERT INTO "Products" (
        "seller_id",
        "name",
        "description",
        "availability",
        "price",
        "length_mm",
        "width_mm",
        "height_mm",
        "starting_price",
        "reserve_price",
        "condition",
        "status"
    ) VALUES (
        p_seller_id,
        p_name,
        p_description,
        p_availability,
        p_price,
        p_length_mm,
        p_width_mm,
        p_height_mm,
        p_starting_price,
        p_reserve_price,
        p_condition,
        p_status
    )
    RETURNING "products_id" INTO v_product_id;

    -- Insert categories (max 3)
    IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
        FOR i IN 1..LEAST(array_length(p_categories, 1), 3) LOOP
            v_category_name := p_categories[i];

            -- Get or create category
            SELECT "category_id" INTO v_category_id
            FROM "Categories"
            WHERE "category_name" = v_category_name;

            IF v_category_id IS NULL THEN
                INSERT INTO "Categories" ("category_name")
                VALUES (v_category_name)
                RETURNING "category_id" INTO v_category_id;
            END IF;

            -- Link product to category
            INSERT INTO "Product_Categories" ("products_id", "category_id")
            VALUES (v_product_id, v_category_id)
            ON CONFLICT DO NOTHING;

            v_category_count := v_category_count + 1;
        END LOOP;
    END IF;

    -- Insert images (max 10)
    IF p_image_urls IS NOT NULL AND array_length(p_image_urls, 1) > 0 THEN
        FOR i IN 1..LEAST(array_length(p_image_urls, 1), 10) LOOP
            INSERT INTO "Product_Images" (
                "products_id",
                "image_url",
                "is_primary",
                "display_order"
            ) VALUES (
                v_product_id,
                p_image_urls[i],
                (i = 1), -- First image is primary
                i
            );
            v_image_count := v_image_count + 1;
        END LOOP;
    END IF;

    -- Return success response
    RETURN json_build_object(
        'success', TRUE,
        'product_id', v_product_id,
        'message', 'Product uploaded successfully',
        'data', json_build_object(
            'product_id', v_product_id,
            'name', p_name,
            'status', p_status,
            'categories_added', v_category_count,
            'images_added', v_image_count
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'message', 'Failed to upload product'
        );
END;
$$ LANGUAGE plpgsql;


-- STEP 9: Function to Add Images to Existing Product
-- =====================================================
CREATE OR REPLACE FUNCTION add_product_images(
    p_product_id UUID,
    p_image_urls TEXT[]
)
RETURNS JSON AS $$
DECLARE
    v_image_count INTEGER := 0;
    v_existing_count INTEGER;
    v_max_order INTEGER;
BEGIN
    -- Check if product exists
    IF NOT EXISTS (SELECT 1 FROM "Products" WHERE "products_id" = p_product_id AND "deleted_at" IS NULL) THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Product not found'
        );
    END IF;

    -- Get current image count
    SELECT COUNT(*), COALESCE(MAX("display_order"), 0)
    INTO v_existing_count, v_max_order
    FROM "Product_Images"
    WHERE "products_id" = p_product_id;

    -- Check if we can add more images (max 10 total)
    IF v_existing_count >= 10 THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Maximum 10 images allowed per product'
        );
    END IF;

    -- Insert new images
    IF p_image_urls IS NOT NULL AND array_length(p_image_urls, 1) > 0 THEN
        FOR i IN 1..LEAST(array_length(p_image_urls, 1), 10 - v_existing_count) LOOP
            INSERT INTO "Product_Images" (
                "products_id",
                "image_url",
                "is_primary",
                "display_order"
            ) VALUES (
                p_product_id,
                p_image_urls[i],
                FALSE, -- Don't override existing primary
                v_max_order + i
            );
            v_image_count := v_image_count + 1;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'success', TRUE,
        'images_added', v_image_count,
        'total_images', v_existing_count + v_image_count,
        'message', 'Images added successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- STEP 10: Function to Update Product Status
-- =====================================================
CREATE OR REPLACE FUNCTION update_product_status(
    p_product_id UUID,
    p_status VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_old_status VARCHAR;
BEGIN
    -- Validate status
    IF p_status NOT IN ('draft', 'active', 'inactive', 'sold', 'archived') THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Invalid status. Must be: draft, active, inactive, sold, or archived'
        );
    END IF;

    -- Update status
    UPDATE "Products"
    SET "status" = p_status
    WHERE "products_id" = p_product_id
      AND "deleted_at" IS NULL
    RETURNING "status" INTO v_old_status;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Product not found'
        );
    END IF;

    RETURN json_build_object(
        'success', TRUE,
        'product_id', p_product_id,
        'new_status', p_status,
        'message', 'Product status updated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- STEP 11: View for Product Details
-- =====================================================
CREATE OR REPLACE VIEW "vw_product_details" AS
SELECT
    p."products_id",
    p."seller_id",
    s."store_name" as seller_store_name,
    p."name",
    p."description",
    p."availability",
    p."price",
    p."length_mm",
    p."width_mm",
    p."height_mm",
    p."sku",
    p."condition",
    p."status",
    p."starting_price",
    p."reserve_price",
    p."created_at",
    p."updated_at",
    (
        SELECT json_agg(
            json_build_object(
                'image_id', pi."image_id",
                'image_url', pi."image_url",
                'file_name', pi."file_name",
                'is_primary', pi."is_primary",
                'display_order', pi."display_order"
            ) ORDER BY pi."display_order"
        )
        FROM "Product_Images" pi
        WHERE pi."products_id" = p."products_id"
    ) as images,
    (
        SELECT json_agg(
            json_build_object(
                'category_id', c."category_id",
                'category_name', c."category_name",
                'category_group', c."category_group"
            )
        )
        FROM "Product_Categories" pc
        JOIN "Categories" c ON c."category_id" = pc."category_id"
        WHERE pc."products_id" = p."products_id"
    ) as categories
FROM "Products" p
LEFT JOIN "Seller" s ON s."seller_id" = p."seller_id"
WHERE p."deleted_at" IS NULL;


-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

/*

-- Example 1: Upload a complete product
SELECT upload_product(
    p_seller_id := 'your-seller-uuid-here',
    p_name := 'Graphic card GIGABYTE GeForce RTX 3050',
    p_description := 'The NVIDIA RTX 3050 graphics card with 8GB GDDR6 memory',
    p_availability := 5,
    p_price := 15000.00,
    p_length_mm := 250,
    p_width_mm := 120,
    p_height_mm := 40,
    p_starting_price := 12000.00,
    p_reserve_price := 15000.00,
    p_condition := 'new',
    p_status := 'draft',
    p_categories := ARRAY['Laptop components', 'Desktop Computers'],
    p_image_urls := ARRAY[
        'https://example.com/gpu-front.jpg',
        'https://example.com/gpu-back.jpg'
    ]
);


-- Example 2: Upload minimal product (draft)
SELECT upload_product(
    p_seller_id := 'your-seller-uuid',
    p_name := 'Vintage Camera',
    p_description := 'Classic camera from the 1980s',
    p_price := 5000.00
);


-- Example 3: Add images to existing product
SELECT add_product_images(
    p_product_id := 'your-product-uuid',
    p_image_urls := ARRAY[
        'https://example.com/additional1.jpg',
        'https://example.com/additional2.jpg'
    ]
);


-- Example 4: Update product status (publish)
SELECT update_product_status(
    p_product_id := 'your-product-uuid',
    p_status := 'active'
);


-- Example 5: Query product with all details
SELECT * FROM vw_product_details
WHERE seller_id = 'your-seller-uuid'
ORDER BY created_at DESC;


-- Example 6: Get all active products
SELECT * FROM vw_product_details
WHERE status = 'active'
ORDER BY created_at DESC;

*/
