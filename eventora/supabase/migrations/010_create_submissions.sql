-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 010: ROUND SUBMISSIONS
-- Supports coding, MCQ/quiz, frontend URL, and attachment submissions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.round_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.event_rounds (id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.registrations (id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams (id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  submission_type text NOT NULL DEFAULT 'general',
  submission_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_status text NOT NULL DEFAULT 'Submitted'
    CHECK (submission_status IN ('Draft', 'Submitted', 'Under Evaluation', 'Evaluated')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_submission_target CHECK (participant_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_per_round_participant
  ON public.round_submissions (round_id, participant_id)
  WHERE team_id IS NULL AND participant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_per_round_team
  ON public.round_submissions (round_id, team_id)
  WHERE team_id IS NOT NULL;
