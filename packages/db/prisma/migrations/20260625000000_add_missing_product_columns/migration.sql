-- Add missing columns to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weightGrams" DECIMAL(10,3);

-- product_variants table is managed by a later migration; skip here
-- ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "domainAttrs" JSONB NOT NULL DEFAULT '{}';

-- Add missing columns to invoice_items table
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "itemMeta" JSONB NOT NULL DEFAULT '{}';
