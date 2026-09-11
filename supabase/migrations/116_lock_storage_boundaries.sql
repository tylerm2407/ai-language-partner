-- 116 — Close the two live Storage authorization gaps found by the final audit.
--
-- The project has not been shared with other apps since 2026-08-06 (see
-- CLAUDE.md §4); podcast-audio is Fluenci's. Verified against the live
-- catalog 2026-09-11 before applying: the two "Service role can ... podcast
-- audio" policies were still present and applied TO public, and
-- "Avatars are publicly accessible" had already been dropped by migration 114.
--
-- Applied to production 2026-09-11.
--
-- Service-role Storage clients bypass RLS. A policy whose name says service
-- role but applies TO public grants access to anon/authenticated callers.

BEGIN;

-- F12: these exact live policies allow public upload/delete. No replacement
-- client policy is created: podcast rendering is a backend-only operation.
DROP POLICY IF EXISTS "Service role can upload podcast audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete podcast audio" ON storage.objects;

-- F13: a private bucket flag does not override a permissive SELECT policy.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- Reassert the bucket's non-public configuration and media constraints.
INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Replace the intended owner policy atomically. Generated objects are stored
-- below a UUID user-id path prefix. Writes remain service-role only.
DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;
CREATE POLICY "Users can read their own avatar"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname IN (
         'Service role can upload podcast audio',
         'Service role can delete podcast audio',
         'Avatars are publicly accessible'
       )
  ) THEN
    RAISE EXCEPTION 'storage lockdown postflight failed: vulnerable policy remains';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM storage.buckets
     WHERE id = 'avatars'
       AND public
  ) THEN
    RAISE EXCEPTION 'storage lockdown postflight failed: avatars bucket is public';
  END IF;
END;
$postflight$;

COMMIT;
