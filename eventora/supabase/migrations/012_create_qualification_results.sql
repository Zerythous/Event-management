-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 012: QUALIFICATION RESULTS
-- Stores round advancement outcomes, ranks, and publication status.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.round_qualification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.event_rounds (id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.registrations (id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams (id) ON DELETE CASCADE,
  score numeric(10, 2) NOT NULL DEFAULT 0,
  rank integer,
  qualification_status text NOT NULL DEFAULT 'Pending'
    CHECK (qualification_status IN ('Pending', 'Qualified', 'Not Qualified', 'Eliminated', 'Waitlisted')),
  qualification_reason text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qual_target CHECK (participant_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qual_per_round_participant
  ON public.round_qualification_results (round_id, participant_id)
  WHERE team_id IS NULL AND participant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qual_per_round_team
  ON public.round_qualification_results (round_id, team_id)
  WHERE team_id IS NOT NULL;
