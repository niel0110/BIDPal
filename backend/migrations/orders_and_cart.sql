-- =====================================================
-- ORDERS AND CART SQL STRUCTURE
-- =====================================================

-- STEP 1: Create Cart Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Cart" (
    "cart_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "User"("user_id") ON DELETE CASCADE,
    "products_id" UUID NOT NULL REFERENCES "Products"("products_id") ON DELETE CASCADE,
    "quantity" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE("user_id", "products_id"),
    CONSTRAINT "quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_cart_user_id" ON "Cart"("user_id");

-- STEP 2: Create Orders Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Orders" (
    "order_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "buyer_id" UUID NOT NULL REFERENCES "User"("user_id") ON DELETE CASCADE,
    "address_id" UUID REFERENCES "Addresses"("address_id") ON DELETE SET NULL,
    "status" VARCHAR(50) DEFAULT 'pay' CHECK ("status" IN ('pay', 'ship', 'receive', 'completed', 'cancelled')),
    "total_amount" DECIMAL(12, 2) NOT NULL,
    "shipping_fee" DECIMAL(12, 2) DEFAULT 0,
    "payment_method" VARCHAR(50) DEFAULT 'cod',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "total_amount_positive" CHECK ("total_amount" >= 0),
    CONSTRAINT "shipping_fee_positive" CHECK ("shipping_fee" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_orders_buyer_id" ON "Orders"("buyer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "Orders"("status");

-- STEP 3: Create Order Items Table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Order_Items" (
    "order_item_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL REFERENCES "Orders"("order_id") ON DELETE CASCADE,
    "products_id" UUID NOT NULL REFERENCES "Products"("products_id") ON DELETE CASCADE,
    "quantity" INTEGER NOT NULL,
    "price_at_purchase" DECIMAL(12, 2) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "order_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "purchase_price_positive" CHECK ("price_at_purchase" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "Order_Items"("order_id");

-- STEP 4: Update Timestamp Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "update_cart_timestamp" ON "Cart";
CREATE TRIGGER "update_cart_timestamp"
    BEFORE UPDATE ON "Cart"
    FOR EACH ROW
    EXECUTE FUNCTION update_order_cart_timestamp();

DROP TRIGGER IF EXISTS "update_orders_timestamp" ON "Orders";
CREATE TRIGGER "update_orders_timestamp"
    BEFORE UPDATE ON "Orders"
    FOR EACH ROW
    EXECUTE FUNCTION update_order_cart_timestamp();
