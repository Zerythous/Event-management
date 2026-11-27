-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 009: ROUND QUESTIONS
-- MCQ, Multi-Select, True/False, and Short-Answer bank per round.
-- SECURITY: RLS in 016 restricts direct table reads to organizers/evaluators;
-- participants receive sanitized prompts via get_participant_round_questions().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.round_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.event_rounds (id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'mcq'
    CHECK (question_type IN ('mcq', 'mcq_multi', 'true_false', 'short_answer')),
  question_text text NOT NULL CHECK (char_length(trim(question_text)) >= 1),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  marks numeric(8, 2) NOT NULL DEFAULT 1 CHECK (marks > 0),
  negative_marks numeric(8, 2) NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),
  explanation text NOT NULL DEFAULT '',
  order_number integer NOT NULL DEFAULT 1 CHECK (order_number >= 1),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
