ALTER TABLE public."Products"
ADD COLUMN IF NOT EXISTS "bid_increment" NUMERIC(12,2) NOT NULL DEFAULT 1.00;

COMMENT ON COLUMN public."Products"."bid_increment" IS 'Minimum increment required between bids for this product.';
