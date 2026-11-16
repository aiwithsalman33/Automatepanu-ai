-- Up Migration
--
-- Checkpoint 1b: tables for Better Auth (decision D2), in the `auth`
-- schema. Better Auth connects with search_path = auth, public and
-- SET ROLE wacrm_service (src/lib/auth/native/db.ts).
--
--   Better Auth model   table               notes
--   user                auth.users          extended below (name, image, email_verified)
--   session             auth.sessions       revocable server-side sessions
--   account             auth.identities     credential + OAuth identities; renamed so it
--                                           can never be confused with public.accounts
--                                           (tenants). Password hashes live here.
--   verification        auth.verifications  email-verify / reset tokens
--
-- Only wacrm_service may touch these tables; no client role has access.
--
-- Ids default to gen_random_uuid(): with advanced.database.generateId =
-- "uuid", Better Auth leaves id generation to the database.

ALTER TABLE auth.users
  ADD COLUMN name text NOT NULL DEFAULT '',
  ADD COLUMN image text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

-- Superseded: Better Auth tracks verification as a boolean, and password
-- hashes live on auth.identities (one row per provider).
ALTER TABLE auth.users DROP COLUMN email_verified_at, DROP COLUMN password_hash;

CREATE TABLE auth.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON auth.sessions (user_id);

CREATE TABLE auth.identities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider_id               text NOT NULL,  -- 'credential', 'google', …
  account_id                text NOT NULL,  -- provider's subject; = user id for 'credential'
  password                  text,           -- credential only: scrypt (new) or bcrypt (migrated)
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX identities_user_id_idx ON auth.identities (user_id);

CREATE TABLE auth.verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_identifier_idx ON auth.verifications (identifier);

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth.sessions, auth.identities, auth.verifications FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE auth.sessions, auth.identities, auth.verifications TO wacrm_service;

-- Signup bootstrap: same behaviour as the Supabase version (a personal
-- account + owner profile per new user), but the display name now comes
-- from Better Auth's `name`, falling back to the Supabase-era metadata
-- for imported users. Kept SECURITY DEFINER and error-swallowing exactly
-- like the original, so a bootstrap failure never blocks the auth insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.name, ''), NEW.raw_user_meta_data->>'full_name', '');
  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;
  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Down Migration
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;
  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
DROP TABLE IF EXISTS auth.verifications;
DROP TABLE IF EXISTS auth.identities;
DROP TABLE IF EXISTS auth.sessions;
ALTER TABLE auth.users ADD COLUMN email_verified_at timestamptz, ADD COLUMN password_hash text;
ALTER TABLE auth.users DROP COLUMN email_verified, DROP COLUMN image, DROP COLUMN name;
