-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 005: REGISTRATIONS
-- Event-scoped participant registrations with duplicate active guard,
-- individual/team tracking, approval, waitlist, rejection, and cancellation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_code text NOT NULL UNIQUE DEFAULT ('REG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  registration_type text NOT NULL DEFAULT 'individual'
    CHECK (registration_type IN ('individual', 'team_leader', 'team_member', 'team')),
  registration_status text NOT NULL DEFAULT 'Approved'
    CHECK (registration_status IN ('Approved', 'Pending Approval', 'Waitlisted', 'Rejected', 'Cancelled')),
  registration_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  team_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Strictly prevent duplicate non-cancelled registrations for the same user & event
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_registration_per_event_user
  ON public.registrations (event_id, user_id)
  WHERE registration_status <> 'Cancelled';
