-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 017: SECURE VIEWS & SERVER FUNCTIONS
-- Sanitizes round questions & evaluations so answer keys and private notes
-- cannot be queried by participants, computes consistent Phase 9 leaderboards,
-- and exposes authoritative database server time for multi-device timers.
-- ============================================================================

-- 1. Authoritative server timestamp (epoch ms) for multi-device timer alignment
CREATE OR REPLACE FUNCTION public.get_server_clock()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'server_iso', now(),
    'server_epoch_ms', floor(extract(epoch FROM now()) * 1000)::bigint
  );
$$;

-- 2. Sanitized participant question reader (NEVER exposes correct_answer or explanation)
CREATE OR REPLACE FUNCTION public.get_participant_round_questions(p_event_id uuid, p_round_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  round_id uuid,
  question_type text,
  question_text text,
  options jsonb,
  marks numeric,
  negative_marks numeric,
  order_number integer,
  settings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_participant_access_round_content(p_event_id, p_round_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.event_id,
    q.round_id,
    q.question_type,
    q.question_text,
    q.options,
    q.marks,
    q.negative_marks,
    q.order_number,
    q.settings
  FROM public.round_questions q
  WHERE q.event_id = p_event_id AND q.round_id = p_round_id
  ORDER BY q.order_number ASC, q.created_at ASC;
END;
$$;

-- 3. Sanitized participant published evaluation reader (omits private_notes strictly)
CREATE OR REPLACE FUNCTION public.get_participant_published_results(p_event_id uuid)
RETURNS TABLE (
  evaluation_id uuid,
  round_id uuid,
  round_number integer,
  round_title text,
  participant_id uuid,
  team_id uuid,
  score numeric,
  max_marks numeric,
  percentage numeric,
  evaluation_status text,
  feedback text,
  rubric_scores jsonb,
  evaluated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    evl.id AS evaluation_id,
    evl.round_id,
    rnd.round_number,
    rnd.title AS round_title,
    evl.participant_id,
    evl.team_id,
    evl.score,
    evl.max_marks,
    CASE WHEN evl.max_marks > 0 THEN round((evl.score / evl.max_marks) * 100, 2) ELSE 0 END AS percentage,
    evl.evaluation_status,
    evl.feedback,
    evl.rubric_scores,
    evl.evaluated_at
  FROM public.evaluations evl
  JOIN public.event_rounds rnd ON rnd.id = evl.round_id
  WHERE evl.event_id = p_event_id
    AND evl.is_published = true
    AND (
      public.can_manage_event(p_event_id, 'evaluate')
      OR (evl.participant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.registrations r WHERE r.id = evl.participant_id AND r.user_id = auth.uid()
      ))
      OR (evl.team_id IS NOT NULL AND public.is_user_in_team(evl.team_id))
    )
  ORDER BY rnd.round_number ASC;
$$;

-- 4. Persistent Round & Overall Leaderboard Views (never select private_notes)
CREATE OR REPLACE VIEW public.leaderboard_round_entries AS
SELECT
  evl.event_id,
  evl.round_id,
  rnd.round_number,
  rnd.title AS round_title,
  evl.participant_id,
  evl.team_id,
  CASE WHEN evl.team_id IS NOT NULL THEN 'team' ELSE 'participant' END AS target_kind,
  coalesce(t.name, coalesce(reg.registration_data->>'fullName', p.full_name, 'Participant')) AS display_name,
  coalesce(p.institution, coalesce(reg.registration_data->>'institution', '')) AS institution,
  evl.score,
  evl.max_marks,
  CASE WHEN evl.max_marks > 0 THEN round((evl.score / evl.max_marks) * 100, 2) ELSE 0 END AS percentage,
  coalesce(qual.qualification_status, 'Pending') AS qualification_status,
  dense_rank() OVER (PARTITION BY evl.round_id ORDER BY evl.score DESC, evl.evaluated_at ASC NULLS LAST) AS computed_rank,
  evl.is_published,
  evl.evaluated_at
FROM public.evaluations evl
JOIN public.event_rounds rnd ON rnd.id = evl.round_id
LEFT JOIN public.teams t ON t.id = evl.team_id
LEFT JOIN public.registrations reg ON reg.id = evl.participant_id
LEFT JOIN public.profiles p ON p.id = reg.user_id
LEFT JOIN public.round_qualification_results qual
  ON qual.round_id = evl.round_id
  AND (
    (evl.team_id IS NOT NULL AND qual.team_id = evl.team_id)
    OR (evl.team_id IS NULL AND qual.participant_id = evl.participant_id)
  );

CREATE OR REPLACE VIEW public.leaderboard_overall_entries AS
SELECT
  event_id,
  target_kind,
  max(participant_id::text)::uuid AS participant_id,
  max(team_id::text)::uuid AS team_id,
  max(display_name) AS display_name,
  max(institution) AS institution,
  sum(score) AS total_score,
  sum(max_marks) AS total_max_marks,
  CASE WHEN sum(max_marks) > 0 THEN round((sum(score) / sum(max_marks)) * 100, 2) ELSE 0 END AS overall_percentage,
  count(*) FILTER (WHERE is_published) AS published_rounds_count,
  dense_rank() OVER (PARTITION BY event_id ORDER BY sum(score) DESC) AS overall_rank
FROM public.leaderboard_round_entries
WHERE is_published = true
GROUP BY event_id, target_kind, coalesce(team_id, participant_id);

-- Force invoking security check through RPC so views never bypass table access controls
REVOKE ALL ON public.leaderboard_round_entries FROM anon, authenticated;
REVOKE ALL ON public.leaderboard_overall_entries FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_published_leaderboard(p_event_id uuid, p_round_id uuid DEFAULT NULL)
RETURNS TABLE (
  target_kind text,
  participant_id uuid,
  team_id uuid,
  display_name text,
  institution text,
  round_id uuid,
  round_number integer,
  score numeric,
  max_marks numeric,
  percentage numeric,
  qualification_status text,
  rank_position bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_mgr boolean := public.can_manage_event(p_event_id, 'evaluate');
  ev_pub boolean := false;
BEGIN
  SELECT (visibility = 'public' AND event_status NOT IN ('draft', 'archived')) INTO ev_pub
  FROM public.events WHERE id = p_event_id;

  IF NOT is_mgr AND NOT coalesce(ev_pub, false) AND NOT public.is_approved_participant(p_event_id) THEN
    RETURN;
  END IF;

  IF p_round_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      l.target_kind,
      l.participant_id,
      l.team_id,
      l.display_name,
      l.institution,
      l.round_id,
      l.round_number,
      l.score,
      l.max_marks,
      l.percentage,
      l.qualification_status,
      l.computed_rank
    FROM public.leaderboard_round_entries l
    WHERE l.event_id = p_event_id
      AND l.round_id = p_round_id
      AND (is_mgr OR l.is_published = true)
    ORDER BY l.computed_rank ASC, l.display_name ASC;
  ELSE
    RETURN QUERY
    SELECT
      o.target_kind,
      o.participant_id,
      o.team_id,
      o.display_name,
      o.institution,
      NULL::uuid AS round_id,
      0 AS round_number,
      o.total_score AS score,
      o.total_max_marks AS max_marks,
      o.overall_percentage AS percentage,
      'Overall'::text AS qualification_status,
      o.overall_rank
    FROM public.leaderboard_overall_entries o
    WHERE o.event_id = p_event_id
    ORDER BY o.overall_rank ASC, o.display_name ASC;
  END IF;
END;
$$;

-- 5. Server-only platform role promotion (never callable by participants/organizers)
CREATE OR REPLACE FUNCTION public.admin_assign_platform_role(p_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  IF p_new_role NOT IN ('participant', 'organizer', 'manager', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid Eventora platform role: %', p_new_role;
  END IF;

  SELECT platform_role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF coalesce(current_setting('role', true), '') <> 'service_role' AND caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: only server service_role or super_admin may assign platform roles.';
  END IF;

  UPDATE public.profiles SET platform_role = p_new_role WHERE id = p_user_id;
END;
$$;
