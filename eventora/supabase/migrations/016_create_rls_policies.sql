-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 016: ROW LEVEL SECURITY (RLS) POLICIES
-- Authoritative database-level authorization across all 14 Eventora tables.
-- SECURITY: Participants cannot inspect unpublished answer keys (round_questions)
-- or private evaluator notes (evaluations); they use sanitized RPCs in 017.
-- ============================================================================

-- 1. Security helper functions
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_owner(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.organizer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid, p_perm text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR public.is_event_owner(p_event_id)
    OR EXISTS (
      SELECT 1 FROM public.event_collaborators ec
      WHERE ec.event_id = p_event_id
        AND ec.user_id = auth.uid()
        AND ec.invitation_status = 'accepted'
        AND (
          p_perm IS NULL
          OR ec.collaborator_role = 'co_organizer'
          OR coalesce((ec.permissions->>p_perm)::boolean, false) = true
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_participant(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.event_id = p_event_id
      AND r.user_id = auth.uid()
      AND r.registration_status = 'Approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_in_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = auth.uid()
      AND tm.membership_status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND t.leader_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_participant_access_round_content(p_event_id uuid, p_round_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_rec record;
  rnd_rec record;
  reg_rec record;
  meta_data jsonb := '{}'::jsonb;
  av jsonb := '{}'::jsonb;
  av_mode text := 'locked';
  paused_pol text := 'restrict';
  comp_pol text := 'allow';
  rel_at text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF public.can_manage_event(p_event_id, 'manage_content') THEN
    RETURN true;
  END IF;

  SELECT id, event_status INTO ev_rec FROM public.events WHERE id = p_event_id;
  IF NOT FOUND OR ev_rec.event_status IN ('draft', 'cancelled', 'archived') THEN
    RETURN false;
  END IF;

  SELECT id, round_status INTO rnd_rec FROM public.event_rounds WHERE id = p_round_id AND event_id = p_event_id;
  IF NOT FOUND OR rnd_rec.round_status = 'Disabled' THEN
    RETURN false;
  END IF;

  SELECT id, registration_status INTO reg_rec
  FROM public.registrations
  WHERE event_id = p_event_id AND user_id = auth.uid() AND registration_status <> 'Cancelled'
  LIMIT 1;
  IF NOT FOUND OR reg_rec.registration_status IN ('Rejected', 'Cancelled') THEN
    RETURN false;
  END IF;

  SELECT content_data INTO meta_data
  FROM public.round_contents
  WHERE event_id = p_event_id AND round_id = p_round_id AND content_type = 'package_meta' AND release_status = 'Published'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  av := coalesce(meta_data->'availability', '{}'::jsonb);
  av_mode := coalesce(av->>'mode', 'locked');
  paused_pol := coalesce(av->>'pausedAccessPolicy', 'restrict');
  comp_pol := coalesce(av->>'completedAccessPolicy', 'allow');

  IF coalesce((av->>'requireApprovedRegistration')::boolean, true) AND reg_rec.registration_status <> 'Approved' THEN
    RETURN false;
  END IF;

  IF av_mode = 'locked' THEN
    RETURN false;
  ELSIF av_mode = 'on_round_start' THEN
    IF rnd_rec.round_status = 'Upcoming' THEN RETURN false; END IF;
    IF rnd_rec.round_status = 'Paused' AND paused_pol = 'restrict' THEN RETURN false; END IF;
    IF rnd_rec.round_status = 'Completed' AND comp_pol = 'restrict' THEN RETURN false; END IF;
  ELSIF av_mode = 'live_only' THEN
    IF rnd_rec.round_status <> 'Live' THEN RETURN false; END IF;
  ELSIF av_mode = 'scheduled' THEN
    rel_at := nullif(av->>'releaseAt', '');
    IF rnd_rec.round_status NOT IN ('Live', 'Completed') THEN
      IF rel_at IS NULL OR now() < rel_at::timestamptz THEN
        RETURN false;
      END IF;
    END IF;
    IF rnd_rec.round_status = 'Paused' AND paused_pol = 'restrict' THEN RETURN false; END IF;
    IF rnd_rec.round_status = 'Completed' AND comp_pol = 'restrict' THEN RETURN false; END IF;
  ELSIF av_mode = 'registered_immediately' THEN
    IF rnd_rec.round_status = 'Paused' AND paused_pol = 'restrict' THEN RETURN false; END IF;
    IF rnd_rec.round_status = 'Completed' AND comp_pol = 'restrict' THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

-- 2. Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_qualification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES policies
DROP POLICY IF EXISTS profiles_select_self_or_shared ON public.profiles;
CREATE POLICY profiles_select_self_or_shared ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e WHERE e.organizer_id = id AND e.visibility = 'public' AND e.event_status <> 'draft'
    )
    OR EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.user_id = id AND public.can_manage_event(r.event_id, 'manage_participants')
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = id AND tm2.user_id = auth.uid() AND tm1.membership_status = 'active' AND tm2.membership_status = 'active'
    )
  );

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (id = auth.uid() OR public.is_platform_admin());

-- 4. EVENTS policies
DROP POLICY IF EXISTS events_select_public_or_managed ON public.events;
CREATE POLICY events_select_public_or_managed ON public.events
  FOR SELECT USING (
    (visibility = 'public' AND event_status NOT IN ('draft', 'archived'))
    OR public.can_manage_event(id, NULL)
    OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.event_id = id AND r.user_id = auth.uid() AND r.registration_status <> 'Cancelled')
  );

DROP POLICY IF EXISTS events_insert_organizer ON public.events;
CREATE POLICY events_insert_organizer ON public.events
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.platform_role IN ('organizer', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS events_update_owner_or_collab ON public.events;
CREATE POLICY events_update_owner_or_collab ON public.events
  FOR UPDATE USING (public.can_manage_event(id, 'edit_event'))
  WITH CHECK (
    (organizer_id = auth.uid() OR public.can_manage_event(id, 'edit_event'))
  );

DROP POLICY IF EXISTS events_delete_owner_or_admin ON public.events;
CREATE POLICY events_delete_owner_or_admin ON public.events
  FOR DELETE USING (public.is_event_owner(id) OR public.is_platform_admin());

-- 5. EVENT COLLABORATORS policies
DROP POLICY IF EXISTS collab_select_scoped ON public.event_collaborators;
CREATE POLICY collab_select_scoped ON public.event_collaborators
  FOR SELECT USING (user_id = auth.uid() OR public.can_manage_event(event_id, NULL));

DROP POLICY IF EXISTS collab_manage_owner ON public.event_collaborators;
CREATE POLICY collab_manage_owner ON public.event_collaborators
  FOR ALL USING (public.is_event_owner(event_id) OR public.is_platform_admin())
  WITH CHECK (public.is_event_owner(event_id) OR public.is_platform_admin());

-- 6. EVENT ROUNDS policies
DROP POLICY IF EXISTS rounds_select_public_or_managed ON public.event_rounds;
CREATE POLICY rounds_select_public_or_managed ON public.event_rounds
  FOR SELECT USING (
    public.can_manage_event(event_id, NULL)
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        (e.visibility = 'public' AND e.event_status NOT IN ('draft', 'archived'))
        OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.event_id = e.id AND r.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS rounds_write_managers ON public.event_rounds;
CREATE POLICY rounds_write_managers ON public.event_rounds
  FOR ALL USING (public.can_manage_event(event_id, 'manage_rounds'))
  WITH CHECK (public.can_manage_event(event_id, 'manage_rounds'));

-- 7. REGISTRATIONS policies
DROP POLICY IF EXISTS registrations_select_own_or_manager ON public.registrations;
CREATE POLICY registrations_select_own_or_manager ON public.registrations
  FOR SELECT USING (user_id = auth.uid() OR public.can_manage_event(event_id, 'manage_registrations'));

DROP POLICY IF EXISTS registrations_insert_own ON public.registrations;
CREATE POLICY registrations_insert_own ON public.registrations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.event_status IN ('published', 'upcoming', 'live')
        AND e.registration_status IN ('open', 'waitlist')
    )
  );

DROP POLICY IF EXISTS registrations_update_own_or_manager ON public.registrations;
CREATE POLICY registrations_update_own_or_manager ON public.registrations
  FOR UPDATE USING (user_id = auth.uid() OR public.can_manage_event(event_id, 'manage_registrations'))
  WITH CHECK (
    public.can_manage_event(event_id, 'manage_registrations')
    OR (user_id = auth.uid() AND registration_status = 'Cancelled')
  );

-- 8. TEAMS policies
DROP POLICY IF EXISTS teams_select_event_scoped ON public.teams;
CREATE POLICY teams_select_event_scoped ON public.teams
  FOR SELECT USING (
    public.can_manage_event(event_id, 'manage_teams')
    OR public.is_approved_participant(event_id)
    OR public.is_user_in_team(id)
  );

DROP POLICY IF EXISTS teams_insert_participant_or_manager ON public.teams;
CREATE POLICY teams_insert_participant_or_manager ON public.teams
  FOR INSERT WITH CHECK (
    public.can_manage_event(event_id, 'manage_teams')
    OR (leader_id = auth.uid() AND public.is_approved_participant(event_id))
  );

DROP POLICY IF EXISTS teams_update_leader_or_manager ON public.teams;
CREATE POLICY teams_update_leader_or_manager ON public.teams
  FOR UPDATE USING (leader_id = auth.uid() OR public.can_manage_event(event_id, 'manage_teams'))
  WITH CHECK (leader_id = auth.uid() OR public.can_manage_event(event_id, 'manage_teams'));

DROP POLICY IF EXISTS teams_delete_manager ON public.teams;
CREATE POLICY teams_delete_manager ON public.teams
  FOR DELETE USING (public.can_manage_event(event_id, 'manage_teams'));

-- 9. TEAM MEMBERS policies
DROP POLICY IF EXISTS team_members_select_scoped ON public.team_members;
CREATE POLICY team_members_select_scoped ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_user_in_team(team_id)
    OR public.can_manage_event(event_id, 'manage_teams')
  );

DROP POLICY IF EXISTS team_members_insert_self_or_manager ON public.team_members;
CREATE POLICY team_members_insert_self_or_manager ON public.team_members
  FOR INSERT WITH CHECK (
    public.can_manage_event(event_id, 'manage_teams')
    OR (
      user_id = auth.uid()
      AND public.is_approved_participant(event_id)
      AND (member_role = 'member' OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS team_members_update_delete_scoped ON public.team_members;
CREATE POLICY team_members_update_delete_scoped ON public.team_members
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
    OR public.can_manage_event(event_id, 'manage_teams')
  )
  WITH CHECK (
    public.can_manage_event(event_id, 'manage_teams')
    OR (user_id = auth.uid() AND membership_status = 'left')
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

-- 10. ROUND CONTENTS policies
DROP POLICY IF EXISTS round_contents_select_gated ON public.round_contents;
CREATE POLICY round_contents_select_gated ON public.round_contents
  FOR SELECT USING (
    public.can_manage_event(event_id, 'manage_content')
    OR (
      visibility <> 'organizer_only'
      AND (
        visibility = 'always_public'
        OR public.can_participant_access_round_content(event_id, round_id)
      )
    )
  );

DROP POLICY IF EXISTS round_contents_write_managers ON public.round_contents;
CREATE POLICY round_contents_write_managers ON public.round_contents
  FOR ALL USING (public.can_manage_event(event_id, 'manage_content'))
  WITH CHECK (public.can_manage_event(event_id, 'manage_content'));

-- 11. ROUND QUESTIONS policies (STRICT: organizer/evaluator only! Participants use get_participant_round_questions RPC)
DROP POLICY IF EXISTS round_questions_organizer_only ON public.round_questions;
CREATE POLICY round_questions_organizer_only ON public.round_questions
  FOR ALL USING (public.can_manage_event(event_id, 'manage_content') OR public.can_manage_event(event_id, 'evaluate'))
  WITH CHECK (public.can_manage_event(event_id, 'manage_content'));

-- 12. SUBMISSIONS policies
DROP POLICY IF EXISTS submissions_select_own_team_or_manager ON public.round_submissions;
CREATE POLICY submissions_select_own_team_or_manager ON public.round_submissions
  FOR SELECT USING (
    public.can_manage_event(event_id, 'evaluate')
    OR submitted_by = auth.uid()
    OR (participant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = participant_id AND r.user_id = auth.uid()))
    OR (team_id IS NOT NULL AND public.is_user_in_team(team_id))
  );

DROP POLICY IF EXISTS submissions_insert_participant ON public.round_submissions;
CREATE POLICY submissions_insert_participant ON public.round_submissions
  FOR INSERT WITH CHECK (
    public.can_manage_event(event_id, 'manage_content')
    OR (
      public.is_approved_participant(event_id)
      AND submission_status IN ('Draft', 'Submitted')
      AND (submitted_by = auth.uid() OR submitted_by IS NULL)
      AND (
        (participant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = participant_id AND r.user_id = auth.uid()))
        OR (team_id IS NOT NULL AND public.is_user_in_team(team_id))
      )
    )
  );

DROP POLICY IF EXISTS submissions_update_own_or_evaluator ON public.round_submissions;
CREATE POLICY submissions_update_own_or_evaluator ON public.round_submissions
  FOR UPDATE USING (
    public.can_manage_event(event_id, 'evaluate')
    OR (
      submission_status IN ('Draft', 'Submitted')
      AND (
        submitted_by = auth.uid()
        OR (participant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = participant_id AND r.user_id = auth.uid()))
        OR (team_id IS NOT NULL AND public.is_user_in_team(team_id))
      )
    )
  )
  WITH CHECK (
    public.can_manage_event(event_id, 'evaluate')
    OR submission_status IN ('Draft', 'Submitted')
  );

-- 13. EVALUATIONS policies (STRICT: raw table has private_notes, so SELECT/WRITE is organizer/evaluator only! Participants read via RPC)
DROP POLICY IF EXISTS evaluations_organizer_evaluator_only ON public.evaluations;
CREATE POLICY evaluations_organizer_evaluator_only ON public.evaluations
  FOR ALL USING (public.can_manage_event(event_id, 'evaluate'))
  WITH CHECK (public.can_manage_event(event_id, 'evaluate'));

-- 14. QUALIFICATION RESULTS policies
DROP POLICY IF EXISTS qual_select_published_own_or_manager ON public.round_qualification_results;
CREATE POLICY qual_select_published_own_or_manager ON public.round_qualification_results
  FOR SELECT USING (
    public.can_manage_event(event_id, 'evaluate')
    OR (
      is_published = true
      AND (
        (participant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = participant_id AND r.user_id = auth.uid()))
        OR (team_id IS NOT NULL AND public.is_user_in_team(team_id))
        OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'public')
      )
    )
  );

DROP POLICY IF EXISTS qual_write_manager ON public.round_qualification_results;
CREATE POLICY qual_write_manager ON public.round_qualification_results
  FOR ALL USING (public.can_manage_event(event_id, 'evaluate'))
  WITH CHECK (public.can_manage_event(event_id, 'evaluate'));

-- 15. ANNOUNCEMENTS policies
DROP POLICY IF EXISTS announcements_select_audience ON public.event_announcements;
CREATE POLICY announcements_select_audience ON public.event_announcements
  FOR SELECT USING (
    public.can_manage_event(event_id, NULL)
    OR (
      published_at IS NOT NULL
      AND audience <> 'organizers_only'
      AND (
        (audience = 'all_participants' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (e.visibility = 'public' OR public.is_approved_participant(event_id))))
        OR (audience IN ('approved_participants', 'teams_only', 'qualified_only') AND public.is_approved_participant(event_id))
      )
    )
  );

DROP POLICY IF EXISTS announcements_write_manager ON public.event_announcements;
CREATE POLICY announcements_write_manager ON public.event_announcements
  FOR ALL USING (public.can_manage_event(event_id, 'manage_rounds'))
  WITH CHECK (public.can_manage_event(event_id, 'manage_rounds'));

-- 16. ACTIVITY LOGS policies
DROP POLICY IF EXISTS activity_logs_select_manager ON public.event_activity_logs;
CREATE POLICY activity_logs_select_manager ON public.event_activity_logs
  FOR SELECT USING (public.can_manage_event(event_id, NULL));

DROP POLICY IF EXISTS activity_logs_insert_scoped ON public.event_activity_logs;
CREATE POLICY activity_logs_insert_scoped ON public.event_activity_logs
  FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND (public.can_manage_event(event_id, NULL) OR public.is_approved_participant(event_id))
  );
