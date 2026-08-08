-- =============================================================================
-- migrations/manual/001_invoice_sequences.sql
-- Run this AFTER prisma migrate dev
-- Creates the sequence counter table used by invoice-number.ts
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_sequences (
  branch_id   UUID    NOT NULL,
  txn_type    TEXT    NOT NULL,
  fy          TEXT    NOT NULL,          -- "25" for FY 2025-26
  current_val INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (branch_id, txn_type, fy)
);

-- RLS: tenants can only see their own sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_sequences_tenant ON invoice_sequences
  FOR ALL TO billing_app
  USING (
    branch_id IN (
      SELECT id FROM branches
      WHERE "tenantId" = current_tenant_id()
    )
  );

COMMENT ON TABLE invoice_sequences IS
  'Branch-scoped sequential invoice number counters. Reset per financial year.';
