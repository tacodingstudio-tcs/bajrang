-- =============================================================================
-- migrations/manual/003_idempotency_keys.sql
-- Run after prisma migrate dev — same pattern as invoice-sequences.sql
--
-- WHY a dedicated table instead of just a unique constraint on invoices:
--   A unique constraint alone would reject the duplicate request with an
--   error — but the client (mobile app retrying after a timeout) still
--   doesn't know whether the FIRST attempt actually succeeded. It needs
--   the original response back, not just "409 duplicate."
--
--   This table stores the key -> response_body mapping so a retried
--   request with the same key gets the EXACT same response as the
--   original successful request, as if it only ran once.
--
-- LIFECYCLE:
--   1. Request arrives with Idempotency-Key header (or aiMeta.localUuid
--      from mobile, see invoice.service.ts)
--   2. Check this table — if key exists and status='completed', return
--      the stored response immediately, skip all business logic
--   3. If key exists and status='processing', another request with the
--      same key is currently in flight (race) — reject with 409
--   4. If key doesn't exist, insert a 'processing' row, run the real
--      logic, then update to 'completed' with the response body
--   5. Keys expire after 24h (cleaned by pg_cron) — long enough to cover
--      any realistic retry window, short enough to not bloat the table
-- =============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  endpoint        TEXT NOT NULL,           -- e.g. 'POST /invoices' — scopes key reuse across different endpoints
  status          TEXT NOT NULL DEFAULT 'processing',  -- processing | completed | failed
  response_status INTEGER,                 -- HTTP status code of the original response
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- A key is unique per tenant + endpoint, not globally — this allows the
-- same UUID to theoretically be reused for a different operation type
-- without collision (defense in depth; in practice UUIDs won't collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_unique
  ON idempotency_keys (tenant_id, endpoint, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup
  ON idempotency_keys (created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_tenant ON idempotency_keys
  FOR ALL TO billing_app
  USING (tenant_id = current_tenant_id());

COMMENT ON TABLE idempotency_keys IS
  'Tracks in-flight and completed requests keyed by client-supplied idempotency key. Prevents duplicate invoice/payment creation from network retries.';

-- pg_cron is not installed in this setup; run this cleanup manually if needed:
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
