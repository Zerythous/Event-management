-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 003: EVENT COLLABORATORS
-- Scoped event-level collaborator roles and granular permissions JSONB.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  invited_email text NOT NULL DEFAULT '',
  collaborator_role text NOT NULL DEFAULT 'manager'
    CHECK (collaborator_role IN ('co_organizer', 'manager', 'evaluator', 'coordinator', 'viewer')),
  permissions jsonb NOT NULL DEFAULT '{
    "edit_event": false,
    "manage_registrations": true,
    "manage_participants": true,
    "manage_teams": true,
    "manage_rounds": true,
    "manage_content": true,
    "evaluate": true,
    "publish_results": false,
    "manage_settings": false
  }'::jsonb,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  invitation_status text NOT NULL DEFAULT 'accepted'
    CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_collab_target CHECK (user_id IS NOT NULL OR invited_email <> ''),
  CONSTRAINT uq_event_collaborator_user UNIQUE (event_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_collaborator_email
  ON public.event_collaborators (event_id, lower(invited_email))
  WHERE invited_email <> '';
