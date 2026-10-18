-- Automatically verify a student's college when their CONFIRMED email matches the domain an admin registered
-- for exactly one college in public.colleges.domain.
--
--   * Email ownership must be proven first (auth.users.email_confirmed_at): by the Supabase confirmation link,
--     or by Google reporting the address as verified.
--   * The domain must match exactly (after removing https://, paths and a leading www.). Subdomains and
--     arbitrary .edu / .ac.in addresses are NOT trusted.
--   * Public mail providers (gmail.com ...) never verify anyone, even if one was typed into colleges.domain.
--   * If two colleges claim the same domain the match is ambiguous and nobody is auto-verified.
--   * Already verified people are never changed, so manual approvals are not overwritten.
--
-- Everything below that is SECURITY DEFINER is locked away from API callers (see the REVOKE statements).

-- ---------------------------------------------------------------------------------------------
-- Core matcher. Internal only: it trusts its arguments, so it must never be callable from the API.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_college_email_verification(
  p_user_id uuid,
  p_email text,
  p_email_confirmed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_email_domain text;
  v_matches integer;
  v_college_id uuid;
BEGIN
  -- Do not grant college verification until the identity provider confirms ownership.
  IF p_email IS NULL OR p_email_confirmed_at IS NULL THEN
    RETURN;
  END IF;

  v_email := lower(trim(p_email));
  -- exactly one "@", something before it, something after it
  IF length(v_email) - length(replace(v_email, '@', '')) <> 1 OR position('@' in v_email) < 2 THEN
    RETURN;
  END IF;

  -- NB: '[.]' instead of '\.' so the pattern is the same whatever standard_conforming_strings is set to.
  v_email_domain := regexp_replace(split_part(v_email, '@', 2), '^www[.]', '');
  IF v_email_domain = '' OR v_email_domain !~ '^[a-z0-9-]+([.][a-z0-9-]+)+$' THEN
    RETURN;
  END IF;

  -- Free providers can never prove a college affiliation.
  IF v_email_domain = ANY (ARRAY[
    'gmail.com','googlemail.com','yahoo.com','yahoo.in','yahoo.co.in','ymail.com','outlook.com','outlook.in',
    'hotmail.com','hotmail.co.uk','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me',
    'protonmail.com','pm.me','zoho.com','gmx.com','gmx.net','mail.com','yandex.com','yandex.ru','rediffmail.com',
    'fastmail.com','tutanota.com','tuta.io','hey.com'
  ]) THEN
    RETURN;
  END IF;

  SELECT count(*), (array_agg(c.id))[1]
    INTO v_matches, v_college_id
    FROM public.colleges c
   WHERE c.domain IS NOT NULL
     AND lower(
           regexp_replace(
             split_part(regexp_replace(trim(c.domain), '^https?://', '', 'i'), '/', 1),
             '^www[.]', '', 'i'
           )
         ) = v_email_domain;

  -- Only a single, unambiguous, configured college counts; everything else stays in manual verification.
  IF v_matches <> 1 THEN
    RETURN;
  END IF;

  -- Tell protect_profile_verification_fields() that this change comes from trusted code (transaction-local).
  PERFORM set_config('app.trusted_verification', 'on', true);
  UPDATE public.profiles
     SET college_id = v_college_id,
         is_verified = true
   WHERE id = p_user_id
     AND is_verified IS NOT TRUE;
  PERFORM set_config('app.trusted_verification', 'off', true);

  -- A manual request for this college is now settled.
  UPDATE public.verifications
     SET status = 'approved', resolved_at = now()
   WHERE user_id = p_user_id AND college_id = v_college_id AND status = 'pending';
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Profile creation on sign-up. Keeps the "first user becomes super_admin" bootstrap from
-- 20261011164901_bootstrap_first_admin.sql (an earlier version of this migration dropped it).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'super_admin');
  ELSE
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  END IF;

  -- Google users arrive already confirmed; password users have email_confirmed_at NULL until they click the link.
  PERFORM public.sync_college_email_verification(NEW.id, NEW.email, NEW.email_confirmed_at);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Re-check when an address becomes confirmed or changes.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (
    OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
    OR OLD.email IS DISTINCT FROM NEW.email
  ) THEN
    PERFORM public.sync_college_email_verification(NEW.id, NEW.email, NEW.email_confirmed_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmation();

-- ---------------------------------------------------------------------------------------------
-- Stop people granting themselves verification or a role through the "update own profile" policy.
--   * is_verified and role: only admins (or trusted verification code) may change them.
--   * college_id: a student may CHOOSE another college (the onboarding wizard and profile page do this),
--     but verification is dropped, exactly like the Node server does, so nobody can pick a college and
--     walk into its verified-only chats.
-- Admins keep full control of their own row.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted code path (sync_college_email_verification), or no signed-in user (migrations, auth service, service role).
  IF coalesce(current_setting('app.trusted_verification', true), 'off') = 'on' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only restrict people editing their own row; admin policies for other rows are handled by RLS.
  IF auth.uid() = OLD.id AND OLD.role NOT IN ('admin', 'super_admin') THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Verification and role can only be changed by an administrator or by confirming a registered college email';
    END IF;
    IF NEW.college_id IS DISTINCT FROM OLD.college_id AND OLD.is_verified THEN
      NEW.is_verified := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_verification_fields ON public.profiles;
CREATE TRIGGER protect_profile_verification_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_verification_fields();

-- ---------------------------------------------------------------------------------------------
-- SECURITY: none of these may be called through the API (PostgREST exposes public functions as /rpc/...).
-- Without this, any signed-in user could call sync_college_email_verification with a fake address and
-- verify any account for any college. Functions get EXECUTE for PUBLIC by default, so revoke from PUBLIC too.
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sync_college_email_verification(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_email_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_verification_fields() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Backfill: already-confirmed accounts whose domain is registered for exactly one college.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, email, email_confirmed_at
      FROM auth.users
     WHERE email_confirmed_at IS NOT NULL
  LOOP
    PERFORM public.sync_college_email_verification(r.id, r.email, r.email_confirmed_at);
  END LOOP;
END;
$$;
