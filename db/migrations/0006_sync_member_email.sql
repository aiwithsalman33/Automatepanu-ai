-- Up Migration
--
-- Keep account_members.email in step with auth.users.email.
--
-- Better Auth changes auth.users.email once an email change has been
-- confirmed (old address, then new). The member row (shown in the team
-- list, the profile form and the inbox) kept the old address, because
-- nothing copied it across. This trigger does, inside the same
-- transaction as the change.

CREATE OR REPLACE FUNCTION public.sync_member_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.account_members
     SET email = NEW.email
   WHERE user_id = NEW.id
     AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_member_email() FROM PUBLIC;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_member_email();

-- Down Migration

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
DROP FUNCTION IF EXISTS public.sync_member_email();
