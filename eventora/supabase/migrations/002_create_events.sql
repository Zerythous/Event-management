-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 002: EVENTS
-- Authoritative event registry with ownership, unique slugs, visibility,
-- date integrity checks, registration config, and Live Control snapshot.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'),
  title text NOT NULL CHECK (char_length(trim(title)) >= 2),
  description text NOT NULL DEFAULT '',
  short_description text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'competition',
  category text NOT NULL DEFAULT 'technical',
  institution text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  event_date text NOT NULL DEFAULT '',
  start_date timestamptz,
  end_date timestamptz,
  registration_start timestamptz,
  registration_end timestamptz,
  poster_url text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  organizer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  participation_mode text NOT NULL DEFAULT 'individual_or_team'
    CHECK (participation_mode IN ('individual', 'team', 'individual_or_team')),
  event_status text NOT NULL DEFAULT 'draft'
    CHECK (event_status IN ('draft', 'published', 'upcoming', 'live', 'paused', 'completed', 'cancelled', 'archived')),
  registration_status text NOT NULL DEFAULT 'open'
    CHECK (registration_status IN ('open', 'not_open_yet', 'closed', 'waitlist', 'paused', 'full')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'private')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  live_ops jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_events_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_events_reg_window CHECK (registration_end IS NULL OR registration_start IS NULL OR registration_end >= registration_start)
);

COMMENT ON TABLE public.events IS 'Multi-tenant Eventora events owned by organizers, supporting rich settings JSONB and authoritative live_ops state.';
