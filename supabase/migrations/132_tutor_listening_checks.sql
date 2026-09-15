-- 132 — The listening check that follows a live tutor session.
--
-- WHY
--
-- Listening was the one strand a conversation could not evidence. The measured
-- CEFR level reads listening from graded lesson exercises alone (migration
-- 128), so a learner who spent every session talking to the tutor — and who
-- necessarily understood the tutor in order to answer — had a listening strand
-- of zero. Minutes of audio are exposure, and `assessListening` has always
-- refused to turn exposure into a level: we record how long audio played,
-- never whether any of it landed. This asks.
--
-- WHY NOT `exercise_results`
--
-- That would have been the obvious reuse and it does not fit: `lesson_id` and
-- `exercise_id` are both NOT NULL there, with foreign keys into `lessons` and
-- `exercises`. A tutor session has neither. The alternatives were inventing
-- placeholder lesson and exercise rows, or dropping two NOT NULLs that every
-- lesson result depends on — a schema weakened for a caller that is not a
-- lesson. A separate table costs one more read in
-- `fetchProficiencyEvidence` and keeps both tables honest about what they hold.
--
-- WHY THE ANSWER KEY LIVES HERE
--
-- `tutor_sessions` is client-readable ("Users read own tutor sessions"), and
-- the debrief is a column of it — so the debrief carries the questions and
-- options only. The key stays in this table, which has RLS enabled and NO
-- POLICIES: service_role bypasses RLS, so that is deny-all to clients and is
-- the intended state (the advisor reports it as INFO `rls_enabled_no_policy`;
-- see CLAUDE.md §4 — do not "fix" it with a permissive policy). A
-- client-visible answer key would make this score self-assigned, and it moves
-- a measured CEFR level.

CREATE TABLE IF NOT EXISTS public.tutor_listening_checks (
  -- One check per session, so the session id IS the key. This also makes
  -- answering idempotent for free: a second submission collides with the row
  -- it already wrote rather than logging a second, better-guessed attempt.
  tutor_session_id uuid PRIMARY KEY
    REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  -- The band the session ran at, copied at write-back. The proficiency report
  -- buckets listening evidence by band, and re-deriving it later from the
  -- learner's CURRENT level would attribute old work to a new band.
  cefr_level      text CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  -- [{question, options[4], answerIndex}]. Shape enforced in
  -- `_shared/tutor-listening.ts`, not here: the rules that decide whether an
  -- item is worth asking (distinct options, an index that indexes) are the
  -- kind that belong next to the code that applies them.
  items           jsonb NOT NULL,
  answered_at     timestamptz,
  -- Null until answered. `correct_count <= total_count` is checked, so a
  -- grading bug cannot write a rate above 1 into the proficiency report.
  correct_count   smallint CHECK (correct_count IS NULL OR correct_count >= 0),
  total_count     smallint CHECK (total_count IS NULL OR total_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_listening_checks_answered_consistent CHECK (
    (answered_at IS NULL AND correct_count IS NULL AND total_count IS NULL)
    OR (answered_at IS NOT NULL AND correct_count IS NOT NULL AND total_count IS NOT NULL
        AND correct_count <= total_count)
  )
);

COMMENT ON TABLE public.tutor_listening_checks IS
  'Post-session listening comprehension check for the live tutor. Service-role only: the answer key is in `items` and grading is server-side.';

-- The proficiency report reads answered checks for one learner and one
-- language. Partial, because an unanswered check is not evidence.
CREATE INDEX IF NOT EXISTS idx_tutor_listening_checks_user_lang
  ON public.tutor_listening_checks (user_id, target_language, answered_at DESC)
  WHERE answered_at IS NOT NULL;

ALTER TABLE public.tutor_listening_checks ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies. See the header.
