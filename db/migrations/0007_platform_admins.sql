-- Up Migration
--
-- Platform administrators: the operators of this deployment (not
-- account owners). They can open /admin, which lists every account and
-- user. Lives in the auth schema next to users/sessions: only the
-- service role can read or write it; tenants (wacrm_app) never see it,
-- and it is not reachable through PostgREST's public schema.

CREATE TABLE auth.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth.platform_admins FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE auth.platform_admins TO wacrm_service;

-- Down Migration

DROP TABLE IF EXISTS auth.platform_admins;
