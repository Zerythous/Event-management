-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 013: EVENT ANNOUNCEMENTS
-- Real-time event & round broadcasts scoped by audience visibility.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.event_rounds (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) >= 1),
  message text NOT NULL CHECK (char_length(trim(message)) >= 1),
  audience text NOT NULL DEFAULT 'all_participants'
    CHECK (audience IN ('all_participants', 'approved_participants', 'qualified_only', 'teams_only', 'organizers_only')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
