-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 006: TEAMS
-- Event-specific teams linked back to registrations(team_id).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  team_code text NOT NULL CHECK (char_length(trim(team_code)) >= 3),
  leader_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  team_status text NOT NULL DEFAULT 'Open'
    CHECK (team_status IN ('Open', 'Full', 'Locked', 'Disbanded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_code_per_event UNIQUE (event_id, team_code),
  CONSTRAINT uq_team_name_per_event UNIQUE (event_id, name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_registrations_team'
  ) THEN
    ALTER TABLE public.registrations
      ADD CONSTRAINT fk_registrations_team
      FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE SET NULL;
  END IF;
END $$;
