-- Up Migration
--
-- Minimal `auth` schema that replaces Supabase Auth's tables for the
-- rest of the schema (FKs to auth.users, the signup trigger) and the
-- temporary auth.uid() shim the RLS policies call (137 call sites; see
-- docs/saas-migration-plan.md C3). Checkpoint 1b points Better Auth at
-- auth.users; policies move from auth.uid() to app.uid() later, module
-- by module, under the isolation suite.
--
-- The `auth` schema itself is created by the bootstrap (db/migrate.mjs)
-- so its ownership and USAGE grants are set before any migration runs.

CREATE TABLE auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text,
  email_verified_at  timestamptz,
  password_hash      text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_platform_admin  boolean NOT NULL DEFAULT false,
  disabled_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_key
  ON auth.users (lower(email)) WHERE email IS NOT NULL;

-- Nobody but the service role touches credentials. wacrm_app reads user
-- display data through public.profiles, exactly as on Supabase.
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth.users FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth.users TO wacrm_service;

-- The current user, from (in order):
--   app.user_id          set by withTenant() (SET LOCAL, per transaction)
--   request.jwt.claim.sub / request.jwt.claims->>'sub'
--                        set by PostgREST from the JWT the server mints
-- Returns NULL when neither is set (anon / service role).
CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  SET search_path = ''
AS $$
  SELECT coalesce(
    nullif(current_setting('app.user_id', true), ''),
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO wacrm_app, wacrm_service, wacrm_anon;

-- Down Migration
DROP FUNCTION IF EXISTS auth.uid();
DROP TABLE IF EXISTS auth.users;
