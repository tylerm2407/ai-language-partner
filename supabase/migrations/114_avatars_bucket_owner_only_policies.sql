-- 114 — The `avatars` bucket: owner-only, in every direction.
--
-- Migration 067 made the bucket private and added an owner-scoped SELECT
-- policy, believing that was the only policy on it. It was not. Three policies
-- from the bucket's earlier life (created 2026-03-27, before Fluenci owned it)
-- were still attached to storage.objects:
--
--   "Avatars are publicly accessible"    SELECT  to public   USING (bucket_id = 'avatars')
--   "Users can update their own avatar"  UPDATE  to public   USING (auth.uid() = folder)
--   "Users can delete their own avatar"  DELETE  to public   USING (auth.uid() = folder)
--
-- The first is the one that matters: `public = false` on the bucket only turns
-- off the unauthenticated /object/public/ URL. Any caller holding the anon key
-- could still `list()` and `createSignedUrl()` every generated portrait through
-- the storage API, because the policy let the `anon` role read the whole
-- bucket. These are stylised likenesses of real people. Dropped.
--
-- The other two are kept in intent — the client now deletes portraits from the
-- picker gallery (2026-09-08) — but rewritten to the house rules: `TO
-- authenticated` (no `TO` clause means `public`, so anon is evaluated on every
-- query) and `(select auth.uid())` (an InitPlan, not a per-row JWT parse).
--
-- Applied to production 2026-09-08.

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );
