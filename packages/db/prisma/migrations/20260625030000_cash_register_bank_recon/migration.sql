-- Migration: cash_register_entries + bank_accounts
-- Supports day-end cash reconciliation and bank reconciliation features.

-- ─── cash_register_entries ────────────────────────────────────────────────────
-- One row per branch per date — stores the cashier's physical cash count
-- vs. what the system expected (computed from payments + invoices).
CREATE TABLE IF NOT EXISTS cash_register_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"      UUID        NOT NULL,
  date            DATE        NOT NULL,
  "systemCash"    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- computed by system
  "countedCash"   NUMERIC(14,2) NOT NULL DEFAULT 0,   -- entered by cashier
  difference      NUMERIC(14,2) GENERATED ALWAYS AS ("countedCash" - "systemCash") STORED,
  notes           TEXT,
  "closedBy"      TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("branchId", date)
);

CREATE INDEX IF NOT EXISTS idx_cash_register_branch_date
  ON cash_register_entries ("branchId", date DESC);

-- ─── bank_accounts ────────────────────────────────────────────────────────────
-- Simple bank account registry per branch.
-- Used to scope bank reconciliation entries.
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"      UUID        NOT NULL,
  name            TEXT        NOT NULL,   -- "HDFC Current A/C"
  "bankName"      TEXT,
  "accountNumber" TEXT,
  "openingBalance" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_branch
  ON bank_accounts ("branchId");

-- ─── bank_reconciliation_entries ─────────────────────────────────────────────
-- Monthly statement balance entry — one row per account per month.
-- The "book balance" is computed from payments; "statement balance" is user-entered.
CREATE TABLE IF NOT EXISTS bank_reconciliation_entries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"          UUID        NOT NULL,
  "bankAccountId"     UUID        REFERENCES bank_accounts(id) ON DELETE CASCADE,
  month               CHAR(7)     NOT NULL,   -- 'YYYY-MM'
  "statementBalance"  NUMERIC(14,2) NOT NULL DEFAULT 0,
  "bookBalance"       NUMERIC(14,2) NOT NULL DEFAULT 0,
  difference          NUMERIC(14,2) GENERATED ALWAYS AS ("statementBalance" - "bookBalance") STORED,
  notes               TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("branchId", "bankAccountId", month)
);

CREATE INDEX IF NOT EXISTS idx_bank_recon_branch_month
  ON bank_reconciliation_entries ("branchId", month DESC);
