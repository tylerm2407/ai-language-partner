-- 100 — The checkpoint: one instrument, two readouts.
--
-- A ~5 minute, four-strand measure of where a learner actually is: a short
-- listening item, a reading cloze, one spoken prompt, one short written
-- response. It is taken once at onboarding as a placement test — replacing the
-- bundled trial lesson, which measured nothing — and monthly after that.
--
-- Two readouts from the one instrument: a progress marker the learner sees as
-- a CEFR band, and the anchor the weekly leaderboard is ranked against.
--
-- WHY ITEMS ARE SERVICE-ROLE ONLY
--
-- `exercises` is readable by any authenticated user, correct answers included.
-- That is fine for practice — a learner cheating themselves out of a lesson
-- has only cheated themselves. It is NOT fine here: a checkpoint sets the band
-- that picks a leaderboard and the score that ranks on it, so a readable
-- answer key is a competitive advantage anyone can query. `checkpoint_items`
-- therefore has RLS on and NO policies, and the `checkpoint` edge function
-- serves items with the answers stripped and grades server-side.
--
-- WHY A SEEDED POOL RATHER THAN GENERATING PER ATTEMPT
--
-- Generating items per attempt would make every learner's checkpoint a
-- different difficulty, which destroys the comparison the whole feature rests
-- on — you cannot rank improvement on an instrument that changes under you.
-- The pool is generated once per (language, band, strand), rotates by attempt,
-- and is shared by everyone.
--
-- WHY IT IS QUOTA-EXEMPT
--
-- Including for free accounts. Spend is bounded by CADENCE, not usage: one
-- placement plus one a month is at most 13 a year per learner, and the items
-- are pre-generated so a checkpoint costs a TTS play and two model calls for
-- grading. Metering it would mean a learner who ran out of chat could not find
-- out how they were doing, which is the one thing the app is for.

-- ─── The item pool ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkpoint_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language      text NOT NULL,
  band          text NOT NULL CHECK (band IN ('A1','A2','B1','B2','C1','C2')),
  strand        text NOT NULL CHECK (strand IN ('listening','reading','speaking','writing')),
  -- What the learner is shown. For `listening` this is the instruction; the
  -- text that gets synthesised is `audio_text`, which is never sent to a client.
  prompt        text NOT NULL,
  audio_text    text,
  correct_answer text,
  accepted_answers text[] NOT NULL DEFAULT '{}',
  options       text[],
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checkpoint_items IS
  'Rotating checkpoint item pool, generated once per (language, band, strand) '
  'and shared by every learner. Service-role only: the answers here decide a '
  'leaderboard rank, so they never reach a client. The checkpoint edge '
  'function serves items stripped of correct_answer/accepted_answers/audio_text '
  'and grades server-side.';

CREATE INDEX IF NOT EXISTS idx_checkpoint_items_pool
  ON public.checkpoint_items (language, band, strand);

ALTER TABLE public.checkpoint_items ENABLE ROW LEVEL SECURITY;
-- No policies: deny-all to clients, same as api_cache / hint_cache /
-- translation_cache / explanation_cache / book_vocab.

-- ─── Attempts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language     text NOT NULL,
  -- The band the instrument was SET at, which is what makes two attempts
  -- comparable. Seeded at onboarding from the learner's self-declared level.
  band         text NOT NULL CHECK (band IN ('A1','A2','B1','B2','C1','C2')),
  kind         text NOT NULL CHECK (kind IN ('placement','monthly')),
  item_ids     uuid[] NOT NULL DEFAULT '{}',
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  listening_score real CHECK (listening_score BETWEEN 0 AND 1),
  reading_score   real CHECK (reading_score   BETWEEN 0 AND 1),
  speaking_score  real CHECK (speaking_score  BETWEEN 0 AND 1),
  writing_score   real CHECK (writing_score   BETWEEN 0 AND 1),
  -- Mean of the strands that were actually answered. Null until completed.
  composite    real CHECK (composite BETWEEN 0 AND 1)
);

COMMENT ON TABLE public.checkpoints IS
  'One checkpoint attempt. Scores are written by the `checkpoint` edge '
  'function with the service role — a client-writable score would be a '
  'self-assigned leaderboard rank.';

CREATE INDEX IF NOT EXISTS idx_checkpoints_user
  ON public.checkpoints (user_id, language, completed_at DESC);

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

-- Read-only to the learner. Every write goes through the edge function.
CREATE POLICY "Users read own checkpoints" ON public.checkpoints
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─── Cohorts ─────────────────────────────────────────────────────────────
-- Segmented by CEFR band, Strava-style: your LEVEL picks the board, your
-- IMPROVEMENT ranks you on it. Competing on a raw total would just rank people
-- by how long they had been learning, which is the thing this app is
-- positioning away from — a long usage history is not proof of fluency.
--
-- ~30 learners, same language and band, auto-assigned. Small enough that a
-- rank means something and that being last is not humiliating.
--
-- Pseudonymous by DEFAULT. `is_visible` is opt-in, and the alias is what other
-- members see until someone chooses otherwise. Free learners are included:
-- excluding them would make the board a paid-only room and remove the one
-- social reason to keep going.
CREATE TABLE IF NOT EXISTS public.cohorts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language   text NOT NULL,
  band       text NOT NULL CHECK (band IN ('A1','A2','B1','B2','C1','C2')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_segment ON public.cohorts (language, band);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id  uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What other members see. Never the display name unless is_visible is set.
  alias      text NOT NULL,
  is_visible boolean NOT NULL DEFAULT false,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_members_user ON public.cohort_members (user_id);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- A learner may read the cohorts they belong to, and nothing else. Written by
-- the edge function with the service role: which cohort you are in decides who
-- you are compared against, so it is not a client write.
CREATE POLICY "Users read own cohorts" ON public.cohorts
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohort_members m
     WHERE m.cohort_id = cohorts.id AND m.user_id = (select auth.uid())
  ));

-- Members of a cohort may read that cohort's membership — that IS the
-- leaderboard. `alias` is safe to expose by construction; `user_id` is the
-- join key and is not returned to clients by the leaderboard RPC below.
CREATE POLICY "Members read their cohort roster" ON public.cohort_members
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohort_members me
     WHERE me.cohort_id = cohort_members.cohort_id
       AND me.user_id = (select auth.uid())
  ));

-- ─── The weekly board ────────────────────────────────────────────────────
-- Ranked on RETENTION GAIN, tie-broken by ACCURACY TREND. Lexicographic
-- rather than a weighted blend, for the same reason the coverage ranking is
-- (migration 097): the two are different units and any weight that combined
-- them would be invented.
--
-- Both are measured over the caller's own cohort and week. `user_id` is never
-- returned — the roster policy above lets members see each other's rows, and
-- the whole point of the alias is that identity is opt-in.
CREATE OR REPLACE FUNCTION public.cohort_leaderboard(p_week_start date DEFAULT NULL)
RETURNS TABLE (
  alias           text,
  display_name    text,
  is_self         boolean,
  retained_cards  integer,
  accuracy_delta  real,
  reviews         integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user   uuid := (select auth.uid());
  v_cohort uuid;
  v_lang   text;
  v_start  date := coalesce(p_week_start, date_trunc('week', now())::date);
  v_prev   date := v_start - 7;
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  -- The caller's cohort. A learner in none gets nothing rather than an error;
  -- the client shows the "not in a cohort yet" state.
  SELECT m.cohort_id, c.language INTO v_cohort, v_lang
    FROM public.cohort_members m
    JOIN public.cohorts c ON c.id = m.cohort_id
   WHERE m.user_id = v_user
   ORDER BY m.joined_at DESC
   LIMIT 1;

  IF v_cohort IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT m.user_id, m.alias, m.is_visible
      FROM public.cohort_members m
     WHERE m.cohort_id = v_cohort
  ),
  -- Reviews are joined through `cards` because review_logs carries no
  -- language: a learner studying two languages must not have one board's
  -- effort counted on the other's.
  this_week AS (
    SELECT rl.user_id,
           count(DISTINCT rl.card_id) FILTER (WHERE rl.was_correct) AS retained,
           count(*)                                                  AS total,
           count(*) FILTER (WHERE rl.was_correct)                    AS correct
      FROM public.review_logs rl
      JOIN public.cards c ON c.id = rl.card_id AND c.language = v_lang
     WHERE rl.user_id IN (SELECT user_id FROM roster)
       AND rl.reviewed_at >= v_start
       AND rl.reviewed_at <  v_start + 7
     GROUP BY rl.user_id
  ),
  prior_week AS (
    SELECT rl.user_id,
           count(*)                               AS total,
           count(*) FILTER (WHERE rl.was_correct) AS correct
      FROM public.review_logs rl
      JOIN public.cards c ON c.id = rl.card_id AND c.language = v_lang
     WHERE rl.user_id IN (SELECT user_id FROM roster)
       AND rl.reviewed_at >= v_prev
       AND rl.reviewed_at <  v_start
     GROUP BY rl.user_id
  )
  SELECT r.alias,
         -- Pseudonymous unless the member opted in. Never fall back to a real
         -- name on a null alias.
         CASE WHEN r.is_visible THEN up.display_name ELSE NULL END,
         r.user_id = v_user,
         coalesce(t.retained, 0)::integer,
         -- No prior week, or no reviews in it, is a delta of 0 rather than a
         -- fake improvement from zero.
         (coalesce(t.correct::real / nullif(t.total, 0), 0)
            - coalesce(p.correct::real / nullif(p.total, 0), 0))::real,
         coalesce(t.total, 0)::integer
    FROM roster r
    LEFT JOIN this_week  t ON t.user_id = r.user_id
    LEFT JOIN prior_week p ON p.user_id = r.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = r.user_id
   ORDER BY 4 DESC, 5 DESC, 6 DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.cohort_leaderboard(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cohort_leaderboard(date) TO authenticated;
