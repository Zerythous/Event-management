-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 001: PROFILES & ROLE INTEGRITY
-- Safe, password-free user profiles linked to auth.users with server-controlled
-- platform_role protection against client-side privilege escalation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  institution text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  platform_role text NOT NULL DEFAULT 'participant'
    CHECK (platform_role IN ('participant', 'organizer', 'manager', 'admin', 'super_admin')),
  requested_role text NOT NULL DEFAULT 'participant'
    CHECK (requested_role IN ('participant', 'organizer', 'manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Public/authenticated Eventora user profiles without credentials; platform_role is protected by DB trigger.';

-- Enforce non-escalation on INSERT/UPDATE unless called by trusted server role / super_admin
CREATE OR REPLACE FUNCTION public.enforce_profile_role_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true));
BEGIN
  -- Normalize requested_role strictly to non-privileged workspace roles
  IF NEW.requested_role IS NULL OR NEW.requested_role NOT IN ('participant', 'organizer', 'manager') THEN
    NEW.requested_role := 'participant';
  END IF;

  -- Trusted backend / service_role / SQL migration execution bypasses client restriction
  IF jwt_role IN ('service_role', 'postgres', 'supabase_admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.platform_role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    -- Self-registration may request a non-privileged workspace role (participant/organizer/manager),
    -- NEVER admin or super_admin.
    IF NEW.platform_role NOT IN ('participant', 'organizer', 'manager') THEN
      NEW.platform_role := coalesce(NULLIF(NEW.requested_role, ''), 'participant');
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: block any client from changing their own or another user's platform_role
  -- unless the authenticated caller is already a verified super_admin.
  IF NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
    IF caller_role IS DISTINCT FROM 'super_admin' THEN
      NEW.platform_role := OLD.platform_role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_security ON public.profiles;
CREATE TRIGGER trg_profiles_role_security
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_role_security();

-- Automatically provision a profile row whenever a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  raw_pref text := lower(trim(coalesce(meta->>'role_preference', meta->>'preferred_role', 'participant')));
  safe_req text := CASE WHEN raw_pref IN ('participant', 'organizer', 'manager') THEN raw_pref ELSE 'participant' END;
  srv_role text := lower(trim(coalesce(app_meta->>'platform_role', app_meta->>'role', '')));
  init_role text := CASE
    WHEN srv_role IN ('participant', 'organizer', 'manager', 'admin', 'super_admin') THEN srv_role
    ELSE safe_req
  END;
  disp_name text := NULLIF(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    institution,
    department,
    city,
    bio,
    avatar_url,
    platform_role,
    requested_role
  )
  VALUES (
    NEW.id,
    coalesce(disp_name, split_part(coalesce(NEW.email, 'Eventora User'), '@', 1)),
    lower(coalesce(NEW.email, '')),
    coalesce(meta->>'institution', ''),
    coalesce(meta->>'department', ''),
    coalesce(meta->>'city', ''),
    coalesce(meta->>'bio', ''),
    coalesce(meta->>'avatar_url', meta->>'picture', ''),
    init_role,
    safe_req
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_eventora ON auth.users;
CREATE TRIGGER on_auth_user_created_eventora
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
