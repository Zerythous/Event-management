-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 003_triggers_and_helpers.sql
-- Description: Security Definer Helper Functions & Enforcing Triggers
-- Author: Eventora Platform Architecture Team
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Authorization & Role Verification Helper Functions
-- ----------------------------------------------------------------------------

-- Check if current authenticated user has platform-wide superadmin authority
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND platform_role = 'super_admin'
  );
END;
$$;

-- Check if current user is event creator, platform superadmin, or event owner/admin
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_id = p_event_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
END;
$$;

-- Check if current user can manage questions, problems, clues, or rubrics for a round
CREATE OR REPLACE FUNCTION public.can_collaborator_manage_content(p_round_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM public.event_rounds WHERE id = p_round_id;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_event_admin(v_event_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.collaborator_round_permissions crp
    JOIN public.event_collaborators ec ON ec.id = crp.collaborator_id
    WHERE crp.round_id = p_round_id 
      AND ec.user_id = auth.uid() 
      AND crp.can_manage_content = TRUE
  );
END;
$$;

-- Check if current user can submit jury evaluations or manual grades for a round
CREATE OR REPLACE FUNCTION public.can_collaborator_grade(p_round_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM public.event_rounds WHERE id = p_round_id;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_event_admin(v_event_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.collaborator_round_permissions crp
    JOIN public.event_collaborators ec ON ec.id = crp.collaborator_id
    WHERE crp.round_id = p_round_id 
      AND ec.user_id = auth.uid() 
      AND crp.can_grade = TRUE
  );
END;
$$;

-- Check if current user can pause, resume, or trigger lifecycle transitions for a round
CREATE OR REPLACE FUNCTION public.can_collaborator_moderate(p_round_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM public.event_rounds WHERE id = p_round_id;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_event_admin(v_event_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.collaborator_round_permissions crp
    JOIN public.event_collaborators ec ON ec.id = crp.collaborator_id
    WHERE crp.round_id = p_round_id 
      AND ec.user_id = auth.uid() 
      AND crp.can_moderate = TRUE
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Non-Recursive RLS Helper Functions (Directive 3)
-- ----------------------------------------------------------------------------

-- Evaluate profile visibility without circular RLS dependencies
CREATE OR REPLACE FUNCTION public.can_view_profile(p_target_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  -- 1. Self-profile access
  IF p_target_user_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- 2. Platform SuperAdmin access
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- 3. Independent Collaborator check: Authorized event staff can view active approved participant profiles in active events
  IF EXISTS (
    SELECT 1 
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id AND t.event_id = tm.event_id
    JOIN public.events e ON e.id = tm.event_id
    JOIN public.event_collaborators ec ON ec.event_id = tm.event_id
    WHERE tm.user_id = p_target_user_id 
      AND ec.user_id = auth.uid()
      AND ec.role IN ('owner', 'admin', 'judge', 'proctor')
      AND tm.membership_status = 'active'
      AND t.status = 'approved'
      AND e.status IN ('published', 'live', 'completed')
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. Teammate check: Active members sharing the same approved squad in an active event can view basic profile
  IF EXISTS (
    SELECT 1
    FROM public.team_members tm_caller
    JOIN public.team_members tm_target 
      ON tm_target.team_id = tm_caller.team_id 
     AND tm_target.event_id = tm_caller.event_id
    JOIN public.teams t 
      ON t.id = tm_caller.team_id 
     AND t.event_id = tm_caller.event_id
    JOIN public.events e 
      ON e.id = tm_caller.event_id
    WHERE tm_caller.user_id = auth.uid()
      AND tm_target.user_id = p_target_user_id
      AND tm_caller.membership_status = 'active'
      AND tm_target.membership_status = 'active'
      AND t.status = 'approved'
      AND e.status IN ('published', 'live', 'completed')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Evaluate squad membership visibility without recursive policy calls
CREATE OR REPLACE FUNCTION public.can_view_team_member(p_team_id UUID, p_event_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  -- 1. SuperAdmin or Event Admin
  IF public.is_super_admin() OR public.is_event_admin(p_event_id) THEN
    RETURN TRUE;
  END IF;

  -- 2. Event Collaborators (owner, admin, judge, proctor) for this specific event
  IF EXISTS (
    SELECT 1 FROM public.event_collaborators ec
    WHERE ec.event_id = p_event_id
      AND ec.user_id = auth.uid()
      AND ec.role IN ('owner', 'admin', 'judge', 'proctor')
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Active members sharing the same approved squad in an active event
  RETURN EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id AND t.event_id = tm.event_id
    JOIN public.events e ON e.id = tm.event_id
    WHERE tm.team_id = p_team_id 
      AND tm.event_id = p_event_id
      AND tm.user_id = auth.uid()
      AND tm.membership_status = 'active'
      AND t.status = 'approved'
      AND e.status IN ('published', 'live', 'completed')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Security & Integrity Enforcing Triggers
-- ----------------------------------------------------------------------------

-- Profile role insertion & update security trigger (Directive 1)
-- Forces role to 'participant' on insert unless superadmin or service_role/postgres; prevents role escalation on update
CREATE OR REPLACE FUNCTION public.enforce_profile_role_security()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT (
      current_user IN ('postgres', 'supabase_admin', 'service_role')
      OR (COALESCE(auth.role(), '') = 'service_role')
      OR public.is_super_admin()
    ) THEN
      NEW.platform_role := 'participant';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
      IF NOT (
        current_user IN ('postgres', 'supabase_admin', 'service_role')
        OR (COALESCE(auth.role(), '') = 'service_role')
        OR public.is_super_admin()
      ) THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify your own platform_role.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_role_security ON public.profiles;
CREATE TRIGGER trg_profile_role_security
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_security();

-- Squad size constraints trigger (2 to 4 members default)
CREATE OR REPLACE FUNCTION public.check_team_member_limits()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_team_id UUID;
  v_event_id UUID;
  v_count INT;
  v_min INT := 2;
  v_max INT := 4;
  v_settings JSONB;
BEGIN
  v_team_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END;
  v_event_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.event_id ELSE NEW.event_id END;

  SELECT settings INTO v_settings FROM public.events WHERE id = v_event_id;
  IF v_settings ? 'min_team_size' THEN
    v_min := (v_settings ->> 'min_team_size')::INT;
  END IF;
  IF v_settings ? 'max_team_size' THEN
    v_max := (v_settings ->> 'max_team_size')::INT;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.team_members WHERE team_id = v_team_id;

  IF TG_OP = 'INSERT' THEN
    IF (v_count + 1) > v_max THEN
      RAISE EXCEPTION 'Roster limit violation: Squad cannot exceed % members.', v_max;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.events WHERE id = v_event_id AND status IN ('live', 'completed')) THEN
      IF (v_count - 1) < v_min THEN
        RAISE EXCEPTION 'Roster limit violation: Squad cannot have fewer than % members during active event.', v_min;
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_team_member_limits ON public.team_members;
CREATE TRIGGER trg_check_team_member_limits
BEFORE INSERT OR UPDATE OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.check_team_member_limits();

-- Jury score rubric ceiling & authorization trigger (Directive 11)
CREATE OR REPLACE FUNCTION public.validate_jury_score()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_max NUMERIC(10, 2);
BEGIN
  SELECT max_points INTO v_max 
  FROM public.jury_rubrics 
  WHERE id = NEW.rubric_id AND round_id = NEW.round_id;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Rubric Error: Rubric criterion does not exist for this round.';
  END IF;

  IF NEW.score < 0 OR NEW.score > v_max THEN
    RAISE EXCEPTION 'Score Violation: Score % exceeds permitted rubric range (0.00 to %).', NEW.score, v_max;
  END IF;

  IF NOT public.can_collaborator_grade(NEW.round_id) THEN
    RAISE EXCEPTION 'Authorization Error: Judge is not authorized to grade this round.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_jury_score ON public.jury_scores;
CREATE TRIGGER trg_validate_jury_score
BEFORE INSERT OR UPDATE ON public.jury_scores
FOR EACH ROW EXECUTE FUNCTION public.validate_jury_score();

-- Automatic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_profile_private_data_updated_at ON public.profile_private_data;
CREATE TRIGGER trg_profile_private_data_updated_at BEFORE UPDATE ON public.profile_private_data FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_event_rounds_updated_at ON public.event_rounds;
CREATE TRIGGER trg_event_rounds_updated_at BEFORE UPDATE ON public.event_rounds FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_team_auth_credentials_updated_at ON public.team_auth_credentials;
CREATE TRIGGER trg_team_auth_credentials_updated_at BEFORE UPDATE ON public.team_auth_credentials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
