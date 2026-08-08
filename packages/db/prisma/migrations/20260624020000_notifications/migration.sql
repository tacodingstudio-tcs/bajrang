-- Migration: add notifications table to each tenant schema
-- Run this via: psql -c "SELECT public.run_on_all_tenant_schemas('...')" or apply per-tenant

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "branchId"   UUID        NOT NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  payload      JSONB       NOT NULL DEFAULT '{}',
  "isRead"     BOOLEAN     NOT NULL DEFAULT false,
  "readAt"     TIMESTAMPTZ,
  approved     BOOLEAN,
  "approvedAt" TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_branch_read_idx ON notifications("branchId", "isRead");
CREATE INDEX IF NOT EXISTS notifications_branch_type_idx ON notifications("branchId", type);
CREATE INDEX IF NOT EXISTS notifications_branch_date_idx ON notifications("branchId", "createdAt" DESC);
