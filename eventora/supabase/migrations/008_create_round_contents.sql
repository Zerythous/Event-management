-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 008: ROUND CONTENTS
-- Question papers, instructions, starter archives, challenge briefs, and
-- release policy state referencing Storage paths inside `eventora-media`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.round_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.event_rounds (id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'pdf_document'
    CHECK (content_type IN ('package_meta', 'pdf_document', 'coding_problem', 'attachment', 'material', 'challenge_brief')),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  content_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'when_unlocked'
    CHECK (visibility IN ('when_unlocked', 'organizer_only', 'always_public')),
  release_status text NOT NULL DEFAULT 'Draft'
    CHECK (release_status IN ('Draft', 'Published', 'Archived')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
