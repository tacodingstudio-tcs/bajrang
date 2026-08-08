-- =============================================================================
-- migrations/manual/002_ai_suggestions.sql
-- Run after prisma migrate dev — same pattern as invoice_sequences.sql
-- Stores AI-drafted content (payment reminders, future: insights, forecasts)
-- pending human review/approval before any side effect happens.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  type        TEXT NOT NULL,            -- 'payment_reminder' | future types
  payload     JSONB NOT NULL,
  accepted    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_tenant_type
  ON ai_suggestions (tenant_id, type, accepted);

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_suggestions_tenant ON ai_suggestions
  FOR ALL TO billing_app
  USING (tenant_id = current_tenant_id());

COMMENT ON TABLE ai_suggestions IS
  'AI-drafted content awaiting human review. Nothing here has taken effect yet.';
