-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 004: EVENT ROUNDS
-- Configurable multi-round structure supporting quizzes, coding, hackathons,
-- presentations, workshops, treasure hunts, and custom formats.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  client_round_key text NOT NULL DEFAULT '',
  round_number integer NOT NULL CHECK (round_number >= 1),
  title text NOT NULL CHECK (char_length(trim(title)) >= 1),
  description text NOT NULL DEFAULT '',
  round_type text NOT NULL DEFAULT 'custom',
  duration text NOT NULL DEFAULT '60 Mins',
  venue text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  max_marks numeric(10, 2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  qualification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  round_status text NOT NULL DEFAULT 'Upcoming'
    CHECK (round_status IN ('Upcoming', 'Live', 'Paused', 'Completed', 'Skipped', 'Disabled')),
  timer_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_round_number UNIQUE (event_id, round_number)
);
