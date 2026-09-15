-- 129 — Daily news becomes reading evidence.
--
-- WHY — the proficiency report judges reading only from `user_reading_progress`
-- (graded passages). A learner who reads the daily article every morning
-- produced no reading evidence at all: `user_news_reads` records that an
-- article was OPENED, which says nothing about whether it was understood, so
-- the report could not use it. This adds the missing half — three comprehension
-- questions generated with the article, and a server-graded result per
-- (learner, article) that the report reads alongside passages.
--
-- WHY THE GRADING IS SERVER-SIDE — comprehension is proficiency evidence
-- (CLAUDE.md §1.2): a client that could write `comprehension = 1.0` directly
-- could write itself a level. The client sends option indexes; the RPC compares
-- them against the stored questions and writes the score itself. The learner's
-- own row is readable (the screen shows the result on reopen) but never
-- writable: no INSERT/UPDATE/DELETE policy exists and the grants are revoked.
--
-- WHY THE FIRST ATTEMPT COUNTS — a re-submit after seeing "1 of 3" is not new
-- evidence of reading, it is memory of the previous answer sheet. The unique
-- key plus "return the existing row on a repeat" makes the RPC idempotent from
-- the client's point of view (retry a timed-out call freely) and makes the
-- stored score the first honest reading.
--
-- KNOWN LIMIT — `daily_news.questions` carries the answer index and the table
-- is readable by every authenticated user, so a learner reading the raw row
-- could find the answers. The client mapper drops `answer` before it reaches
-- a screen, so the honest client never sees it; hiding it from PostgREST would
-- need column-level grants on a `select('*')` table and was judged out of
-- scope for what is, at worst, a learner inflating their own reading evidence.

-- ─── daily_news: the questions, generated with the article ───────────────
--
-- An array of { question, options: [4 strings], answer: 0..3 } in the target
-- language, or NULL when generation failed for that article (the cron stores
-- the article regardless — losing the article over a missing quiz would be
-- backwards). Shape is enforced strictly in `daily-news-cron/questions.ts`
-- before the write; the CHECK here only guards the type.

ALTER TABLE public.daily_news
  ADD COLUMN IF NOT EXISTS questions jsonb
    CHECK (questions IS NULL OR jsonb_typeof(questions) = 'array');

COMMENT ON COLUMN public.daily_news.questions IS
  'Comprehension check: [{question, options[4], answer 0..3}] in the target language. NULL when generation failed. Graded by record_news_reading(); see migration 129.';

-- ─── news_reading_results: one graded reading per (learner, article) ──────

CREATE TABLE IF NOT EXISTS public.news_reading_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.daily_news(id) ON DELETE CASCADE,
  -- Stamped from the article, not the profile: the evidence belongs to the
  -- language and band of what was actually read, and a learner who switches
  -- target language keeps yesterday's Spanish reading as Spanish evidence.
  target_language text NOT NULL,
  cefr_level text NOT NULL,
  -- Share of questions answered correctly, 0..1. REAL to match the report's
  -- `comprehension` on user_reading_progress.
  comprehension real NOT NULL CHECK (comprehension >= 0 AND comprehension <= 1),
  questions_total smallint NOT NULL CHECK (questions_total > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);

-- The report walks a learner's evidence per language, newest first.
CREATE INDEX IF NOT EXISTS idx_news_reading_results_user_lang
  ON public.news_reading_results (user_id, target_language, completed_at DESC);

ALTER TABLE public.news_reading_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own news reading results" ON public.news_reading_results;
CREATE POLICY "Users can read own news reading results" ON public.news_reading_results
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.news_reading_results FROM anon, authenticated;

-- ─── record_news_reading: grade and store, once ──────────────────────────
--
-- p_answers[i] is the chosen option index (0..3) for questions[i-1]. The
-- answer count must equal the question count and every index must be in
-- range; anything else is a client bug and is rejected loudly rather than
-- graded as "wrong". An article with no questions cannot produce evidence and
-- is rejected too — the client hides the block for those, so reaching this
-- branch also means a client bug.

CREATE OR REPLACE FUNCTION public.record_news_reading(
  p_article_id uuid,
  p_answers    smallint[]
)
RETURNS public.news_reading_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_row       public.news_reading_results;
  v_questions jsonb;
  v_language  text;
  v_cefr      text;
  v_total     integer;
  v_correct   integer := 0;
  v_i         integer;
  v_expected  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_article_id IS NULL THEN
    RAISE EXCEPTION 'article_id required' USING ERRCODE = '22023';
  END IF;

  -- First attempt counts: a repeat returns what was stored, grades nothing.
  SELECT * INTO v_row
    FROM public.news_reading_results
   WHERE user_id = v_uid AND article_id = p_article_id;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT questions, language, cefr_level
    INTO v_questions, v_language, v_cefr
    FROM public.daily_news
   WHERE id = p_article_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'article not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_questions IS NULL
     OR jsonb_typeof(v_questions) <> 'array'
     OR jsonb_array_length(v_questions) = 0 THEN
    RAISE EXCEPTION 'article has no comprehension questions' USING ERRCODE = '22023';
  END IF;

  v_total := jsonb_array_length(v_questions);
  IF p_answers IS NULL OR COALESCE(array_length(p_answers, 1), 0) <> v_total THEN
    RAISE EXCEPTION 'expected % answers, got %', v_total, COALESCE(array_length(p_answers, 1), 0)
      USING ERRCODE = '22023';
  END IF;

  FOR v_i IN 1..v_total LOOP
    IF p_answers[v_i] IS NULL OR p_answers[v_i] < 0 OR p_answers[v_i] > 3 THEN
      RAISE EXCEPTION 'answer % out of range (0-3)', v_i USING ERRCODE = '22023';
    END IF;
    v_expected := (v_questions -> (v_i - 1) ->> 'answer')::integer;
    IF v_expected IS NOT NULL AND v_expected = p_answers[v_i] THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  INSERT INTO public.news_reading_results
    (user_id, article_id, target_language, cefr_level, comprehension, questions_total)
  VALUES
    (v_uid, p_article_id, v_language, v_cefr, v_correct::real / v_total::real, v_total)
  ON CONFLICT (user_id, article_id) DO NOTHING
  RETURNING * INTO v_row;

  -- Two submits racing past the SELECT above: the loser's insert is skipped,
  -- and the winner's row is the one that counts.
  IF NOT FOUND THEN
    SELECT * INTO v_row
      FROM public.news_reading_results
     WHERE user_id = v_uid AND article_id = p_article_id;
  END IF;

  RETURN v_row;
END;
$$;

-- Supabase's default privileges grant EXECUTE on every new function to anon
-- explicitly, and a revoke from PUBLIC does not touch an explicit grant —
-- so anon is named here, as in migration 128.
REVOKE ALL ON FUNCTION public.record_news_reading(uuid, smallint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_news_reading(uuid, smallint[]) TO authenticated;

COMMENT ON FUNCTION public.record_news_reading(uuid, smallint[]) IS
  'Grades a daily-news comprehension check against daily_news.questions and stores one news_reading_results row per (user, article); a repeat returns the stored first attempt. See migration 129.';
