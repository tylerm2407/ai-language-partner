-- 128 — exercise_results + record_exercise_result() + record_lesson_completion():
-- every lesson answer becomes durable, countable evidence, and a lesson
-- completion is written by the server rather than by the client.
--
-- WHY — three things were true at once and none of them was visible:
--
--   1. The proficiency report's confidence gate counts `review_logs` (30
--      needed before a band is judged). Lesson answers upserted `review_items`
--      but never wrote a log, so a learner who only ever did lessons — the
--      normal learner — could never be measured. `daily_stats.cards_reviewed`
--      was never bumped by a lesson either. The client half of that fix lives
--      in lib/lesson-srs.ts; nothing here changes review_logs.
--
--   2. Nothing recorded a graded exercise that had no card behind it, and the
--      listening strand had no evidence at all. `exercise_results` is that
--      record. It is SERVER-OWNED: the RPC derives the exercise type, the
--      skill, the CEFR band and the language from the exercise → lesson → unit
--      → course chain, so a modified client cannot tag its own answers as
--      C1 listening. The client only says which exercise, whether it was
--      right, how many tries, and how long.
--
--   3. `lesson_completions` was upserted by the client with no comparison, so
--      a practice retake overwrote a better score, and the screen bumped
--      `daily_stats.lessons_completed` on every retake — including offline
--      replays, which wrote no stats at all. `record_lesson_completion()`
--      keeps the best score, updates completed_at, and moves the daily counter
--      exactly once, on the first completion. The client INSERT/UPDATE
--      policies on the table are dropped so the RPC is the only writer.
--
-- Idempotency — both RPCs are safe to replay from the offline queue:
--   • record_exercise_result de-dupes on (user_id, client_result_id), the
--     same client-minted-key pattern review_logs uses (migration 059).
--   • record_lesson_completion conflicts on (user_id, lesson_id); a replay of
--     an already-recorded completion is a retake and moves no counter.
--
-- House rules (CLAUDE.md §4): RLS on, SELECT-own only, `(select auth.uid())`,
-- SECURITY DEFINER with `SET search_path = public` and a caller guard,
-- REVOKE from PUBLIC/anon and GRANT EXECUTE to authenticated.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · exercise_results — one row per graded exercise
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exercise_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id         uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  exercise_id       uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  card_id           uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  -- Derived server-side from the exercise row; never client-supplied.
  exercise_type     text NOT NULL,
  skill_type        text,
  -- COALESCE(cards.cefr_level, courses.cefr_level): the card's own band when
  -- there is one, else the band of the course the lesson belongs to.
  cefr_level        text,
  target_language   text NOT NULL,
  -- First-attempt correctness. A recovered second attempt is false here —
  -- the same rule lesson accuracy uses (lib/lesson-attempts.ts).
  correct           boolean NOT NULL,
  attempts          smallint NOT NULL CHECK (attempts BETWEEN 1 AND 5),
  response_time_ms  integer CHECK (response_time_ms IS NULL OR response_time_ms BETWEEN 0 AND 600000),
  -- Client-minted idempotency key so an offline replay is the same result,
  -- not a second one. Unique per learner, not globally: two learners can
  -- collide on a random id without it meaning anything.
  client_result_id  text NOT NULL CHECK (char_length(client_result_id) BETWEEN 4 AND 128),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_result_id)
);

COMMENT ON TABLE public.exercise_results IS
  'One graded lesson exercise per row. Server-owned: written only by record_exercise_result(), which derives type/skill/band/language from the exercise chain. Listening evidence for the proficiency report; see migration 128.';

-- The report reads a learner's recent history and a per-type slice (the
-- listening types). Both are (user_id, …) so the RLS predicate is an index
-- qual, not a filter.
CREATE INDEX IF NOT EXISTS idx_exercise_results_user_created
  ON public.exercise_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_results_user_type
  ON public.exercise_results (user_id, exercise_type);

ALTER TABLE public.exercise_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own exercise results" ON public.exercise_results;
CREATE POLICY "Users can read own exercise results" ON public.exercise_results
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Supabase's default privileges hand `authenticated` every DML verb on a new
-- public table; RLS with no write policy already refuses them, but the revoke
-- makes the intent explicit and survives a future permissive policy.
REVOKE INSERT, UPDATE, DELETE ON public.exercise_results FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · record_exercise_result — the only writer of exercise_results
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_exercise_result(
  p_exercise_id      uuid,
  p_correct          boolean,
  p_attempts         smallint,
  p_response_time_ms integer,
  p_client_result_id text
)
RETURNS public.exercise_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_key       text := NULLIF(btrim(COALESCE(p_client_result_id, '')), '');
  v_attempts  smallint;
  v_rt        integer;
  v_lesson    uuid;
  v_type      text;
  v_skill     text;
  v_card      uuid;
  v_band      text;
  v_language  text;
  v_row       public.exercise_results;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_exercise_id IS NULL THEN
    RAISE EXCEPTION 'exercise id required' USING ERRCODE = '22023';
  END IF;
  IF p_correct IS NULL THEN
    RAISE EXCEPTION 'correct flag required' USING ERRCODE = '22023';
  END IF;
  IF v_key IS NULL OR char_length(v_key) < 4 OR char_length(v_key) > 128 THEN
    RAISE EXCEPTION 'invalid client_result_id' USING ERRCODE = '22023';
  END IF;

  -- Clamp rather than reject: a clock skew or a double-tap should not cost
  -- the learner the evidence, only the implausible part of the number.
  v_attempts := GREATEST(1, LEAST(COALESCE(p_attempts, 1), 5))::smallint;
  v_rt := CASE
    WHEN p_response_time_ms IS NULL THEN NULL
    ELSE GREATEST(0, LEAST(p_response_time_ms, 600000))
  END;

  -- Replay: the same client key returns the row that already exists. Checked
  -- before the derivation so a replayed result never fails on an exercise
  -- that has since been regenerated or removed.
  SELECT * INTO v_row
    FROM public.exercise_results
   WHERE user_id = v_uid AND client_result_id = v_key;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  -- Everything that describes the evidence comes from the content tables.
  SELECT e.lesson_id, e.type, e.skill_type, e.card_id,
         COALESCE(c.cefr_level, co.cefr_level), co.target_language
    INTO v_lesson, v_type, v_skill, v_card, v_band, v_language
    FROM public.exercises e
    JOIN public.lessons  l  ON l.id  = e.lesson_id
    JOIN public.units    u  ON u.id  = l.unit_id
    JOIN public.courses  co ON co.id = u.course_id
    LEFT JOIN public.cards c ON c.id = e.card_id
   WHERE e.id = p_exercise_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown exercise' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.exercise_results (
    user_id, lesson_id, exercise_id, card_id,
    exercise_type, skill_type, cefr_level, target_language,
    correct, attempts, response_time_ms, client_result_id
  )
  VALUES (
    v_uid, v_lesson, p_exercise_id, v_card,
    v_type, v_skill, v_band, v_language,
    p_correct, v_attempts, v_rt, v_key
  )
  -- Two concurrent sends of the same key (online attempt racing a queue
  -- flush) land as one row; the loser re-reads it below.
  ON CONFLICT (user_id, client_result_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row
      FROM public.exercise_results
     WHERE user_id = v_uid AND client_result_id = v_key;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_exercise_result(uuid, boolean, smallint, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_exercise_result(uuid, boolean, smallint, integer, text) TO authenticated;

COMMENT ON FUNCTION public.record_exercise_result(uuid, boolean, smallint, integer, text) IS
  'Records one graded lesson exercise for the caller, deriving type/skill/band/language server-side. Idempotent on (user_id, client_result_id). See migration 128.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · record_lesson_completion — best score kept, counter moved once
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Returns jsonb rather than a typed row: `lesson_completions` predates the
-- numbered migration files (it was created in the dashboard — there is no
-- CREATE TABLE for it in this directory), so its column types are not on
-- record here and a RETURNS TABLE would be asserting types it cannot verify.
-- `to_jsonb(row)` returns the row exactly as it is, plus `first_completion`;
-- the client maps it with the same mapper it uses for a SELECT.

CREATE OR REPLACE FUNCTION public.record_lesson_completion(
  p_lesson_id     uuid,
  p_course_id     uuid,
  p_score         real,
  p_time_spent_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_score  real;
  v_time   integer;
  v_course uuid;
  v_rec    record;
  v_today  date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_lesson_id IS NULL THEN
    RAISE EXCEPTION 'lesson id required' USING ERRCODE = '22023';
  END IF;

  -- The course comes from the lesson, not from the client: a completion filed
  -- under the wrong course would move the wrong path's "% mastered". The
  -- parameter stays in the signature so a queued pre-migration payload still
  -- calls cleanly, and is only trusted when the lesson has no unit to derive
  -- from — which no lesson the screen can open does.
  SELECT u.course_id INTO v_course
    FROM public.lessons l
    JOIN public.units u ON u.id = l.unit_id
   WHERE l.id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson' USING ERRCODE = '22023';
  END IF;
  v_course := COALESCE(v_course, p_course_id);
  IF v_course IS NULL THEN
    RAISE EXCEPTION 'lesson has no course' USING ERRCODE = '22023';
  END IF;

  -- Score is a 0–1 share; time is capped at a day so a phone that slept with
  -- the lesson open cannot record a week of practice.
  v_score := GREATEST(0, LEAST(COALESCE(p_score, 0), 1));
  v_time  := GREATEST(0, LEAST(COALESCE(p_time_spent_ms, 0), 86400000));

  -- `xmax = 0` on the RETURNING row is true only for the freshly inserted
  -- tuple; an ON CONFLICT update leaves the old tuple's xmax set. It is the
  -- standard way to tell insert from update in one statement, and unlike a
  -- SELECT-then-INSERT it is race-free: two first completions in flight at
  -- once yield exactly one `first_completion = true`.
  --
  -- xp_earned is passed as 0 and never updated: fluenci_retire_lesson_xp_trigger
  -- (migration 120) zeroes it anyway.
  INSERT INTO public.lesson_completions AS lc
    (user_id, lesson_id, course_id, score, xp_earned, time_spent_ms, completed_at)
  VALUES
    (v_uid, p_lesson_id, v_course, v_score, 0, v_time, now())
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    -- A retake is practice: it can raise the recorded score, never lower it.
    score         = GREATEST(lc.score, EXCLUDED.score),
    -- The latest run's duration and time, so "last practised" stays honest.
    time_spent_ms = EXCLUDED.time_spent_ms,
    completed_at  = EXCLUDED.completed_at
  RETURNING lc.*, (lc.xmax = 0) AS first_completion INTO v_rec;

  -- The daily counter moves once per lesson, ever. `accuracy` is
  -- set-if-provided on daily_stats (upsert_daily_stats, migration 048), so
  -- the first completion's score becomes today's accuracy, same as the
  -- client used to write — but only on the first, and never from a replay.
  IF v_rec.first_completion THEN
    v_today := public.fluenci_user_today(v_uid);
    INSERT INTO public.daily_stats (user_id, date, lessons_completed, accuracy)
    VALUES (v_uid, v_today, 1, v_score)
    ON CONFLICT (user_id, date) DO UPDATE SET
      lessons_completed = daily_stats.lessons_completed + 1,
      accuracy          = EXCLUDED.accuracy;
  END IF;

  RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.record_lesson_completion(uuid, uuid, real, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_lesson_completion(uuid, uuid, real, integer) TO authenticated;

COMMENT ON FUNCTION public.record_lesson_completion(uuid, uuid, real, integer) IS
  'Records a finished lesson for the caller: best score kept on retake, completed_at refreshed, daily_stats.lessons_completed moved only on the first completion. Returns the row plus first_completion. See migration 128.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · lesson_completions — the RPC is the only writer
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migration 070 kept "Users can update own completions" because the client's
-- INSERT … ON CONFLICT DO UPDATE needed it. The client no longer issues that
-- statement — every path (screen, store, offline replay) goes through
-- record_lesson_completion(), which runs as the definer — so both write
-- policies go. SELECT stays: the Learn tab reads its own completions directly.

DROP POLICY IF EXISTS "Users can insert own completions" ON public.lesson_completions;
DROP POLICY IF EXISTS "Users can update own completions" ON public.lesson_completions;

REVOKE INSERT, UPDATE, DELETE ON public.lesson_completions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
--   DROP FUNCTION public.record_lesson_completion(uuid, uuid, real, integer);
--   DROP FUNCTION public.record_exercise_result(uuid, boolean, smallint, integer, text);
--   DROP TABLE public.exercise_results;
--   GRANT INSERT, UPDATE ON public.lesson_completions TO authenticated;
--   CREATE POLICY "Users can insert own completions" ON public.lesson_completions
--     FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
--   CREATE POLICY "Users can update own completions" ON public.lesson_completions
--     FOR UPDATE TO authenticated
--     USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
--
-- and restore the client upsert in lib/supabase-queries.ts upsertLessonCompletion.
-- ---------------------------------------------------------------------------
