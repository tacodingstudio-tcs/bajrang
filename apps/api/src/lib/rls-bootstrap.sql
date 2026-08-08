-- Extensions and RLS helpers needed after a db reset.
-- billing_app is POSTGRES_USER so it has superuser rights inside Docker.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_branch_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_role', true), '')
$$ LANGUAGE sql STABLE;
