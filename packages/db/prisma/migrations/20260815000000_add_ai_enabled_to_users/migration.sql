-- Per-user toggle: lets a super_user grant AI Assistant access to individual
-- staff members. Owners and super_users always have AI access regardless of
-- this flag (enforced in code, not here).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
