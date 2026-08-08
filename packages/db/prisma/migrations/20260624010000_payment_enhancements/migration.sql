-- Migration: payment enhancements
-- Adds type, status, voided fields to payments table

ALTER TABLE payments ADD COLUMN IF NOT EXISTS "type"       TEXT NOT NULL DEFAULT 'receipt';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "status"     TEXT NOT NULL DEFAULT 'active';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "voidedAt"   TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

CREATE INDEX IF NOT EXISTS payments_branch_status_idx ON payments("branchId", "status");
