-- =============================================================================
-- migrations/manual/005_refresh_tokens.sql
-- Run after prisma migrate dev — same pattern as other manual migrations.
--
-- WHY a database table, not just a longer-lived JWT:
--   A pure JWT refresh token would be stateless and unrevocable — if a
--   cashier's phone is stolen, there is no way to invalidate their
--   refresh token short of rotating the server's signing secret (which
--   would log out EVERY user, not just the compromised one).
--
--   Storing refresh tokens server-side (hashed, never plaintext) means:
--     - Logout actually invalidates the session, not just deletes a
--       client-side cookie that could be replayed
--     - A specific device can be revoked without affecting others
--     - You can see and manage "active sessions" per user later
--
-- TOKEN ROTATION: every time a refresh token is used, it is invalidated
-- and a NEW refresh token is issued. This means a stolen refresh token
-- only works ONCE before the legitimate user's next refresh fails,
-- immediately signalling token theft (see routes/auth.ts /refresh handler).
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  branch_id     UUID NOT NULL,         -- branch active at issuance; refreshed token preserves it
  token_hash    TEXT NOT NULL UNIQUE,  -- SHA-256 of the actual token — never store the raw token
  device_info   TEXT,                  -- optional: user agent / app version, for session listing later
  revoked       BOOLEAN NOT NULL DEFAULT false,
  revoked_reason TEXT,                 -- 'rotated' | 'logout' | 'manual_revoke' | null
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup
  ON refresh_tokens (token_hash) WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (tenant_id, user_id, revoked);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup
  ON refresh_tokens (expires_at);

-- No RLS on refresh_tokens: access is already gated by the token hash
-- (cryptographically random, SHA-256 stored). RLS would create a
-- chicken-and-egg problem — you need to read the token to learn the
-- tenant_id, but RLS would require knowing the tenant_id first.

COMMENT ON TABLE refresh_tokens IS
  'Server-side refresh token store enabling revocation. Tokens are rotated on every use — a reused/stolen token immediately fails on its second use, signalling compromise.';

-- pg_cron is not installed in this setup; run this cleanup manually if needed:
-- DELETE FROM refresh_tokens
--   WHERE expires_at < NOW() - INTERVAL '7 days'
--      OR (revoked = true AND created_at < NOW() - INTERVAL '7 days');
