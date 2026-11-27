-- ============================================================================
-- EVENTORA PHASE 10 - MIGRATION 018: SUPABASE STORAGE BUCKET & RLS POLICIES
-- Configures `eventora-media` as a PRIVATE bucket and scopes upload/read/delete
-- permissions across avatars, event posters/covers, round content, and submissions.
-- ============================================================================

-- Ensure bucket `eventora-media` exists and remains private (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'eventora-media',
  'eventora-media',
  false,
  26214400, -- 25 MB max per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'application/zip',
    'application/x-zip-compressed',
    'text/csv',
    'text/plain',
    'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

-- Helper: validate UUID segment safely before casting
CREATE OR REPLACE FUNCTION public.try_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN p_text::uuid;
  END IF;
  RETURN NULL;
END;
$$;

-- 1. AVATARS: avatars/{user_id}/...
DROP POLICY IF EXISTS eventora_media_avatars_rw ON storage.objects;
CREATE POLICY eventora_media_avatars_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 2. EVENT POSTERS & COVERS: events/{event_id}/posters/... or events/{event_id}/covers/...
DROP POLICY IF EXISTS eventora_media_event_branding_read ON storage.objects;
CREATE POLICY eventora_media_event_branding_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] IN ('posters', 'covers')
    AND public.try_uuid((storage.foldername(name))[2]) IS NOT NULL
    AND (
      public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), NULL)
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = public.try_uuid((storage.foldername(name))[2])
          AND (e.visibility = 'public' AND e.event_status NOT IN ('draft', 'archived'))
      )
    )
  );

DROP POLICY IF EXISTS eventora_media_event_branding_write ON storage.objects;
CREATE POLICY eventora_media_event_branding_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] IN ('posters', 'covers')
    AND public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), 'edit_event')
  )
  WITH CHECK (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] IN ('posters', 'covers')
    AND public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), 'edit_event')
  );

-- 3. ROUND CONTENT & ATTACHMENTS: events/{event_id}/rounds/{round_id}/content/... or attachments/...
DROP POLICY IF EXISTS eventora_media_round_content_read ON storage.objects;
CREATE POLICY eventora_media_round_content_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'rounds'
    AND (storage.foldername(name))[5] IN ('content', 'attachments')
    AND public.try_uuid((storage.foldername(name))[2]) IS NOT NULL
    AND public.try_uuid((storage.foldername(name))[4]) IS NOT NULL
    AND public.can_participant_access_round_content(
      public.try_uuid((storage.foldername(name))[2]),
      public.try_uuid((storage.foldername(name))[4])
    )
  );

DROP POLICY IF EXISTS eventora_media_round_content_write ON storage.objects;
CREATE POLICY eventora_media_round_content_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'rounds'
    AND (storage.foldername(name))[5] IN ('content', 'attachments')
    AND public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), 'manage_content')
  )
  WITH CHECK (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'rounds'
    AND (storage.foldername(name))[5] IN ('content', 'attachments')
    AND public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), 'manage_content')
  );

-- 4. PARTICIPANT SUBMISSIONS: events/{event_id}/rounds/{round_id}/submissions/{user_id}/...
DROP POLICY IF EXISTS eventora_media_submissions_rw ON storage.objects;
CREATE POLICY eventora_media_submissions_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'rounds'
    AND (storage.foldername(name))[5] = 'submissions'
    AND public.try_uuid((storage.foldername(name))[2]) IS NOT NULL
    AND (
      public.can_manage_event(public.try_uuid((storage.foldername(name))[2]), 'evaluate')
      OR (storage.foldername(name))[6] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'eventora-media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'rounds'
    AND (storage.foldername(name))[5] = 'submissions'
    AND public.is_approved_participant(public.try_uuid((storage.foldername(name))[2]))
    AND (storage.foldername(name))[6] = auth.uid()::text
  );
