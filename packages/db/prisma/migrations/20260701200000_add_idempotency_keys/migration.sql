-- Migration: add idempotency_keys table
-- Supports server-side idempotency for invoice creation and payment recording.
-- Keys are stored in the public schema and scoped by (branch_id, endpoint, key).
-- Keys older than 24 hours are treated as expired and not replayed.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id       UUID        NOT NULL,
  endpoint        TEXT        NOT NULL,
  idempotency_key TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  response_status INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  CONSTRAINT uq_idempotency_keys UNIQUE (branch_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_branch_created
  ON idempotency_keys (branch_id, created_at DESC);
