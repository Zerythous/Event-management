-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 014: EVENT ACTIVITY LOGS
-- Structured operational audit log without storing secret keys or PII blobs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(trim(action)) >= 1),
  entity_type text NOT NULL DEFAULT 'event',
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
