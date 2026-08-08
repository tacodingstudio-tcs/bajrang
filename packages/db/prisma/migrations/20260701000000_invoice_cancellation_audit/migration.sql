-- Migration: invoice cancellation audit trail
-- Adds cancelledBy / cancelledAt to invoices so the service can record
-- who cancelled an invoice and when, without an `as any` cast.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "cancelledBy" UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
