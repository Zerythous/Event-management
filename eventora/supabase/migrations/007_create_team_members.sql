-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 007: TEAM MEMBERS
-- Strict per-team and single-active-team-per-event uniqueness constraints.
-- Cross-event / size / lock checks are enforced by trigger in 015.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('leader', 'member')),
  membership_status text NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active', 'invited', 'removed', 'left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_member_unique UNIQUE (team_id, user_id)
);

-- A user cannot actively belong to two different teams in the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_team_member_per_event
  ON public.team_members (event_id, user_id)
  WHERE membership_status = 'active';
