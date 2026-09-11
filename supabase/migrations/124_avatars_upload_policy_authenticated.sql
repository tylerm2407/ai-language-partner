-- 124 — Avatar upload policy: TO authenticated, InitPlan auth.uid().
--
-- Migrations 067, 114 and 116 rewrote the avatars bucket's SELECT, UPDATE and
-- DELETE policies to the house rules, but the INSERT policy was still the
-- original: applied TO public (so Postgres evaluated it for anon on every
-- insert) with a bare auth.uid() (re-parsed per row). Harmless in practice —
-- auth.uid() is NULL for anon, so the check never passed — but it violated the
-- rule migration 058 established and CLAUDE.md §4 records. Same check, house
-- rules applied.
--
-- Applied to production 2026-09-11.

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );
