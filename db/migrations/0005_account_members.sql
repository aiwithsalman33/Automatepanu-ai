-- Up Migration
--
-- Decision D10: the membership table is `account_members` (one row per
-- user, UNIQUE (user_id) unchanged), so it can later grow into
-- many-accounts-per-user by dropping that one constraint.
--
-- `public.profiles` stays as a compatibility VIEW so the ~450 existing
-- query sites (supabase-js / PostgREST, RPC bodies, triggers) keep
-- working unchanged; they move to account_members as their modules are
-- rewritten. The rename carries along every policy, trigger, index,
-- constraint and the deals.assigned_to FK.
--
-- SECURITY: the view MUST be security_invoker. A plain view runs with
-- its owner's rights, and the owner bypasses RLS, so `profiles` would
-- expose every tenant's members. tests/db pins this.
--
-- Note: `SELECT *` fixes the view's column list at creation. A column
-- added to account_members later must be added to the view too (or the
-- view dropped once nothing uses it).

ALTER TABLE public.profiles RENAME TO account_members;
ALTER INDEX IF EXISTS public.profiles_pkey RENAME TO account_members_pkey;
ALTER INDEX IF EXISTS public.profiles_user_id_key RENAME TO account_members_user_id_key;
ALTER INDEX IF EXISTS public.idx_profiles_account_role RENAME TO idx_account_members_account_role;

CREATE VIEW public.profiles
  WITH (security_invoker = true)
  AS SELECT * FROM public.account_members;

REVOKE ALL ON public.profiles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO wacrm_app, wacrm_service;

COMMENT ON TABLE public.account_members IS
  'Account membership: one row per user (UNIQUE user_id). Formerly public.profiles.';
COMMENT ON VIEW public.profiles IS
  'Compatibility view over account_members (security_invoker). Do not use in new code.';

-- Down Migration
DROP VIEW IF EXISTS public.profiles;
ALTER INDEX IF EXISTS public.idx_account_members_account_role RENAME TO idx_profiles_account_role;
ALTER INDEX IF EXISTS public.account_members_user_id_key RENAME TO profiles_user_id_key;
ALTER INDEX IF EXISTS public.account_members_pkey RENAME TO profiles_pkey;
ALTER TABLE public.account_members RENAME TO profiles;
COMMENT ON TABLE public.profiles IS NULL;
