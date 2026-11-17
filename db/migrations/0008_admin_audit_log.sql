-- Up Migration
--
-- Audit trail for the platform admin panel (/admin): every change an
-- operator makes to another user (password set, disable/enable, verify,
-- admin grant/revoke, delete) is recorded here. Service role only, like
-- the rest of the auth schema.
--
-- target_email is copied (not joined) so the row still says who was
-- affected after that user is deleted; both user columns are SET NULL
-- for the same reason.
--
-- auth.users.disabled_at (0001) is what "disable" sets. A non-NULL value
-- blocks new sessions (src/lib/auth/native/auth.ts, session create hook).

CREATE TABLE auth.admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  admin_email    text NOT NULL,
  action         text NOT NULL,
  target_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  target_email   text,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_at_idx ON auth.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON auth.admin_audit_log (target_user_id);

ALTER TABLE auth.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth.admin_audit_log FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE auth.admin_audit_log TO wacrm_service;

-- Down Migration

DROP TABLE IF EXISTS auth.admin_audit_log;
