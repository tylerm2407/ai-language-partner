-- 073_correction_log_insert_policy.sql
--
-- `public.correction_log` had a SELECT policy and nothing else, but the client
-- inserts into it during lessons — components/lesson/FeedbackCard.tsx:53 and
-- components/lesson/MultipleChoice.tsx:217, both via
-- lib/supabase-queries.ts:2311 logExerciseCorrection().
--
-- So every exercise correction failed with 42501 "new row violates row-level
-- security policy". Production logs show it repeatedly across every session
-- where someone worked through a lesson.
--
-- It failed SILENTLY: both call sites are deliberately fire-and-forget and only
-- console.warn, so nothing surfaced. The visible consequence is that
-- correction_log holds only the rows the ai-chat function writes with the
-- service role — every mistake made in an actual exercise was dropped, and the
-- weekly-mistakes read at lib/supabase-queries.ts:2341 has been running against
-- a table missing most of its data.
--
-- Client-writable is the exception in this schema, and this earns it: the rows
-- are the learner's own mistakes, they carry no economic or competitive value,
-- and the same learner already reads them back. Scoped to their own user_id,
-- matching the pattern used for chat_messages and ai_content_reports.

CREATE POLICY "Users can insert own correction log" ON public.correction_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- ROLLBACK
--   DROP POLICY "Users can insert own correction log" ON public.correction_log;
-- Note that rolling back restores the silent data loss described above.
-- ---------------------------------------------------------------------------
