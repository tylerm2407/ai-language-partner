-- 089 — Keep the pronunciation scores we already compute.
--
-- `score-pronunciation` transcribes the learner's audio with Whisper, scores it
-- against the expected text, returns the number — and then throws it away. The
-- function's only write is `consume_daily_quota`, so the ONLY trace a spoken
-- attempt leaves behind is "one more of today's allowance is gone".
--
-- Three things are blocked by that, all of them already designed:
--
--   * The CEFR proficiency report (`lib/cefr-proficiency.ts`) reports speaking
--     as `not_assessed`, with a comment saying in so many words that the scores
--     are not persisted. It is the only one of the five skill rows that can
--     never turn green, no matter how much the learner practises.
--   * The planned assessment checkpoint has no speaking evidence to read.
--   * The planned leaderboard has no pronunciation figure to rank on.
--
-- WHY A ROW PER ATTEMPT, NOT A ROLLING AVERAGE ON `user_profiles`
--
-- An aggregate answers "how good are they" and nothing else. The pair
-- (expected_text, transcription) is the actually valuable artefact: over time it
-- is a real corpus of what this learner's mouth does versus what was asked of
-- them, per language. That is what drives "you keep flattening the Spanish rr",
-- targeted drills, and any future model work. An average throws it away a
-- second time. Rows are small and bounded by the per-plan daily quota
-- (`dailyPronunciationScores`, 0–7/day, migration 084), so the volume is fine.
--
-- WRITES ARE SERVICE-ROLE ONLY
--
-- A pronunciation score feeds the proficiency report and a leaderboard, so it
-- has competitive meaning and the client must not be able to author one
-- (CLAUDE.md §1.2). There is therefore a SELECT policy and nothing else: the
-- edge function writes with the service role, which bypasses RLS. Deliberately
-- no UPDATE or DELETE policy either — an attempt is a historical fact, and a
-- learner rewriting their own history is exactly the inflation the proficiency
-- report exists to avoid.

CREATE TABLE IF NOT EXISTS public.pronunciation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  -- The prompt the learner was asked to say, and what Whisper heard. Stored
  -- together on purpose: neither is worth much alone.
  expected_text text NOT NULL,
  transcription text,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  is_correct boolean NOT NULL,
  phoneme_errors jsonb,
  -- Where the attempt came from. The proficiency report and a future checkpoint
  -- need to tell a graded assessment apart from idle practice.
  source text NOT NULL CHECK (source IN ('lesson', 'checkpoint', 'read_aloud', 'practice')),
  -- Nullable: read-aloud and free practice are not tied to a card. ON DELETE
  -- SET NULL so retiring curriculum does not erase the learner's history.
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pronunciation_scores IS
  'One row per scored pronunciation attempt. Before migration 089 these scores '
  'were computed by the score-pronunciation edge function and discarded, which '
  'is why the CEFR report could only ever show speaking as not_assessed. Rows '
  'are written by the service role only; clients may read their own. The '
  '(expected_text, transcription) pair is the point as much as the score is — '
  'together they accumulate into a per-learner pronunciation error corpus.';

-- ─── Indexes ─────────────────────────────────────────────────────────────
-- "this learner's recent attempts", the proficiency report's read.
CREATE INDEX IF NOT EXISTS idx_pronunciation_scores_user_created
  ON public.pronunciation_scores (user_id, created_at DESC);

-- Same, narrowed to one language. A learner studying two languages must not
-- have their Spanish attempts drag down their French speaking level.
CREATE INDEX IF NOT EXISTS idx_pronunciation_scores_user_lang_created
  ON public.pronunciation_scores (user_id, target_language, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.pronunciation_scores ENABLE ROW LEVEL SECURITY;

-- Read your own, and only your own. No INSERT/UPDATE/DELETE policy: writes go
-- through the service role in supabase/functions/score-pronunciation.
CREATE POLICY "Users can read own pronunciation scores" ON public.pronunciation_scores
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
