-- Up Migration
--
-- Intentional privilege changes on top of the behaviour-identical
-- baseline. Each one is pinned by tests/db (adapter "app").

-- F3 — anon no longer reaches the SECURITY DEFINER membership RPCs.
-- Each refused callers without a user already (tested), but that relied
-- on every function's own auth.uid() check. Invitation *peek* stays
-- public: /join/<token> renders before sign-in.
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, public.account_role_enum) FROM wacrm_anon;
REVOKE EXECUTE ON FUNCTION public.remove_account_member(uuid) FROM wacrm_anon;
REVOKE EXECUTE ON FUNCTION public.transfer_account_ownership(uuid) FROM wacrm_anon;
REVOKE EXECUTE ON FUNCTION public.redeem_invitation(text) FROM wacrm_anon;
REVOKE EXECUTE ON FUNCTION public.touch_presence(text) FROM wacrm_anon;
-- anon has no table access at all, so membership checks are moot for it.
REVOKE EXECUTE ON FUNCTION public.is_account_member(uuid, public.account_role_enum) FROM wacrm_anon;

-- Future functions are not executable by PUBLIC by default; every new
-- migration grants EXECUTE explicitly (finding F1: never rely on
-- environment default privileges again).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Down Migration
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, public.account_role_enum) TO wacrm_anon;
GRANT EXECUTE ON FUNCTION public.remove_account_member(uuid) TO wacrm_anon;
GRANT EXECUTE ON FUNCTION public.transfer_account_ownership(uuid) TO wacrm_anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(text) TO wacrm_anon;
GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO wacrm_anon;
GRANT EXECUTE ON FUNCTION public.is_account_member(uuid, public.account_role_enum) TO wacrm_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
