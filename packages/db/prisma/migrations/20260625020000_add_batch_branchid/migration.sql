-- Add branchId to batches table (was in schema but missing from initial migration)
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "branchId" UUID;

-- Back-fill branchId from the product's branchId for existing rows
UPDATE "batches" b
SET "branchId" = p."branchId"
FROM "products" p
WHERE p.id = b."productId"
  AND b."branchId" IS NULL
  AND p."branchId" IS NOT NULL;

-- Add index for expiry-alert and low-stock queries
CREATE INDEX IF NOT EXISTS "batches_branchId_expDate_idx" ON "batches"("branchId", "expDate");
