-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 011: EVALUATIONS
-- Phase 9 manual & rubric scoring, public feedback, and private_notes.
-- SECURITY: private_notes MUST never be exposed in participant-facing queries.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.event_rounds (id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.round_submissions (id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.registrations (id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams (id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  score numeric(10, 2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  max_marks numeric(10, 2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  evaluation_status text NOT NULL DEFAULT 'Evaluated'
    CHECK (evaluation_status IN ('Pending', 'Under Review', 'Evaluated', 'Approved', 'Rejected')),
  feedback text NOT NULL DEFAULT '',
  private_notes text NOT NULL DEFAULT '',
  rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_eval_target CHECK (participant_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluation_per_round_participant
  ON public.evaluations (round_id, participant_id)
  WHERE team_id IS NULL AND participant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluation_per_round_team
  ON public.evaluations (round_id, team_id)
  WHERE team_id IS NOT NULL;
