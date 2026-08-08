-- Migration: invoice engine gaps
-- Adds linkedInvoiceId to invoices for credit notes, delivery challans, proforma conversions

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "linkedInvoiceId" UUID REFERENCES invoices(id);
CREATE INDEX IF NOT EXISTS invoices_linked_invoice_id_idx ON invoices("linkedInvoiceId");
