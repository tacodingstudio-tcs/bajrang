-- Add variantId to stock_ledger if not already present
ALTER TABLE "stock_ledger" ADD COLUMN IF NOT EXISTS "variantId" UUID;
