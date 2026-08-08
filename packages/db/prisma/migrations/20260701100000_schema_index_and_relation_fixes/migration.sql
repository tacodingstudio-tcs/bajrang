-- Migration: schema index coverage + relation fixes
-- Adds missing indexes, fixes StockSummary null-unique bug, and PaymentAllocation cascade

-- ── 1. Indexes on parties ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "parties_branchId_idx"      ON parties ("branchId");
CREATE INDEX IF NOT EXISTS "parties_branchId_type_idx" ON parties ("branchId", type);

-- ── 2. Indexes on invoices ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "invoices_branchId_status_idx"       ON invoices ("branchId", status);
CREATE INDEX IF NOT EXISTS "invoices_branchId_txnType_date_idx" ON invoices ("branchId", "txnType", date DESC);

-- ── 3. Index on invoice_items (batch trace) ───────────────────────────────────
CREATE INDEX IF NOT EXISTS "invoice_items_batchId_idx" ON invoice_items ("batchId");

-- ── 4. Index on payments (type filter) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "payments_branchId_type_idx" ON payments ("branchId", type);

-- ── 5. Index on stock_ledger (invoice reversal lookup) ────────────────────────
CREATE INDEX IF NOT EXISTS "stock_ledger_refId_idx" ON stock_ledger ("refId");

-- ── 6. Index on goods_receipt_items (PO fulfillment tracking) ─────────────────
CREATE INDEX IF NOT EXISTS "goods_receipt_items_purchaseOrderItemId_idx"
  ON goods_receipt_items ("purchaseOrderItemId");

-- ── 7. Index on memberships (party detail page) ───────────────────────────────
CREATE INDEX IF NOT EXISTS "memberships_partyId_idx" ON memberships ("partyId");

-- ── 8. Index on attendance_logs (member check-in history) ────────────────────
CREATE INDEX IF NOT EXISTS "attendance_logs_partyId_idx" ON attendance_logs ("partyId");

-- ── 9. Index on lab_reports (invoice detail join) ─────────────────────────────
CREATE INDEX IF NOT EXISTS "lab_reports_invoiceId_idx" ON lab_reports ("invoiceId");

-- ── 10. Index on service_visits (invoice detail join) ────────────────────────
CREATE INDEX IF NOT EXISTS "service_visits_invoiceId_idx" ON service_visits ("invoiceId");

-- ── 11. Fix StockSummary unique constraint for nullable variantId ──────────────
-- PostgreSQL treats NULLs as distinct in unique constraints, so
-- @@unique([branchId, productId, variantId]) does NOT prevent two rows
-- with the same branchId+productId when variantId IS NULL.
-- We add a partial unique index to cover that case.
CREATE UNIQUE INDEX IF NOT EXISTS "stock_summary_base_product_unique"
  ON stock_summary ("branchId", "productId")
  WHERE "variantId" IS NULL;

-- ── 12. PaymentAllocation: add ON DELETE CASCADE for both FKs ─────────────────
-- Prisma added the FKs without cascade; alter them now.
ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS "payment_allocations_paymentId_fkey",
  ADD  CONSTRAINT "payment_allocations_paymentId_fkey"
       FOREIGN KEY ("paymentId") REFERENCES payments(id) ON DELETE CASCADE;

ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS "payment_allocations_invoiceId_fkey",
  ADD  CONSTRAINT "payment_allocations_invoiceId_fkey"
       FOREIGN KEY ("invoiceId") REFERENCES invoices(id) ON DELETE CASCADE;
