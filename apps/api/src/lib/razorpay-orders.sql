-- =============================================================================
-- migrations/manual/004_razorpay_orders.sql
-- Adds RLS to the razorpay_orders table managed by Prisma.
-- Prisma created this table with camelCase column names; column references
-- here use quoted identifiers to match.
-- =============================================================================

-- Prisma already created the table; just enable RLS on it.
ALTER TABLE razorpay_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY razorpay_orders_tenant ON razorpay_orders
  FOR ALL TO billing_app
  USING ("tenantId" = current_tenant_id());

COMMENT ON TABLE razorpay_orders IS
  'Tracks Razorpay payment link lifecycle. A row here does not mean money was received — only the webhook-confirmed status=paid does. Real ledger entries live in payments, created via recordPayment() when the webhook fires.';
