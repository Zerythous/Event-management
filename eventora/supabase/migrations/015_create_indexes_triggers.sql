-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 015: INDEXES, TRIGGERS & REALTIME PUBLICATION
-- ============================================================================

-- 1. Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles',
    'events',
    'event_collaborators',
    'event_rounds',
    'registrations',
    'teams',
    'round_contents',
    'round_questions',
    'round_submissions',
    'evaluations',
    'round_qualification_results'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
  END LOOP;
END $$;

-- 2. Team membership integrity trigger: enforces matching event, unlocked team, and max team size
CREATE OR REPLACE FUNCTION public.enforce_team_member_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_rec record;
  ev_settings jsonb;
  max_sz integer := 10;
  cur_cnt integer := 0;
  allow_locked boolean := false;
BEGIN
  SELECT t.id, t.event_id, t.team_status INTO t_rec FROM public.teams t WHERE t.id = NEW.team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target team does not exist.';
  END IF;

  IF NEW.event_id IS DISTINCT FROM t_rec.event_id THEN
    RAISE EXCEPTION 'Cross-event team membership is not permitted.';
  END IF;

  IF NEW.membership_status = 'active' THEN
    IF t_rec.team_status IN ('Locked', 'Disbanded') THEN
      -- Allow only organizers/collaborators to mutate locked teams
      SELECT EXISTS (
        SELECT 1 FROM public.events e WHERE e.id = t_rec.event_id AND e.organizer_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.event_collaborators ec
        WHERE ec.event_id = t_rec.event_id AND ec.user_id = auth.uid() AND ec.invitation_status = 'accepted'
      ) INTO allow_locked;

      IF NOT allow_locked THEN
        RAISE EXCEPTION 'Team is % and cannot be joined.', t_rec.team_status;
      END IF;
    END IF;

    SELECT e.settings INTO ev_settings FROM public.events e WHERE e.id = NEW.event_id;
    IF ev_settings ? 'teamConfig' AND (ev_settings->'teamConfig'->>'maxSize') ~ '^\d+$' THEN
      max_sz := greatest(1, (ev_settings->'teamConfig'->>'maxSize')::integer);
    END IF;

    SELECT count(*) INTO cur_cnt
    FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.membership_status = 'active'
      AND (TG_OP = 'INSERT' OR tm.id <> NEW.id);

    IF cur_cnt >= max_sz THEN
      RAISE EXCEPTION 'Team has reached the maximum configured size of % members.', max_sz;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_member_rules ON public.team_members;
CREATE TRIGGER trg_enforce_team_member_rules
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_member_rules();

-- 3. Auto-audit important round status transitions
CREATE OR REPLACE FUNCTION public.audit_round_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.round_status IS DISTINCT FROM OLD.round_status THEN
    INSERT INTO public.event_activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.event_id,
      auth.uid(),
      'round_status_' || lower(NEW.round_status),
      'event_round',
      NEW.id::text,
      jsonb_build_object(
        'round_number', NEW.round_number,
        'title', NEW.title,
        'from_status', OLD.round_status,
        'to_status', NEW.round_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_round_status_change ON public.event_rounds;
CREATE TRIGGER trg_audit_round_status_change
AFTER UPDATE ON public.event_rounds
FOR EACH ROW
EXECUTE FUNCTION public.audit_round_status_change();

-- 4. Indexes for scalable event queries
CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events (organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_public_catalog ON public.events (visibility, event_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_user ON public.event_collaborators (user_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_collab_event ON public.event_collaborators (event_id, collaborator_role);
CREATE INDEX IF NOT EXISTS idx_rounds_event_order ON public.event_rounds (event_id, round_number);
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON public.registrations (event_id, registration_status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON public.registrations (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams (event_id, team_status);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members (user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_round_contents_round ON public.round_contents (round_id, release_status);
CREATE INDEX IF NOT EXISTS idx_round_questions_order ON public.round_questions (round_id, order_number);
CREATE INDEX IF NOT EXISTS idx_submissions_round ON public.round_submissions (round_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_round ON public.evaluations (round_id, is_published);
CREATE INDEX IF NOT EXISTS idx_qual_round_rank ON public.round_qualification_results (round_id, is_published, rank);
CREATE INDEX IF NOT EXISTS idx_announcements_event ON public.event_announcements (event_id, published_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_event ON public.event_activity_logs (event_id, created_at DESC);

-- 5. Enable Supabase Realtime publication safely on event operational tables
-- Note: RLS SELECT policies still govern every emitted Postgres change event.
DO $$
DECLARE
  rt_tables text[] := ARRAY[
    'events',
    'event_collaborators',
    'event_rounds',
    'registrations',
    'teams',
    'team_members',
    'round_contents',
    'round_submissions',
    'evaluations',
    'round_qualification_results',
    'event_announcements',
    'event_activity_logs'
  ];
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY rt_tables LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;
