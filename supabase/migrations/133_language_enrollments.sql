-- 133 — Learning more than one language at a time.
--
-- Until now the account held exactly one language's worth of learning state:
-- `user_profiles.target_language`, `.level`, `.placement_band` and
-- `.current_course_id`. Switching language in Settings overwrote all four, so
-- the Spanish a learner had already placed into was gone the moment they tried
-- Russian, and coming back re-placed them from scratch.
--
-- This splits the two ideas apart:
--
--   * `user_language_enrollments` — one row per (learner, language). The level
--     they declared IN THAT LANGUAGE, the band their lessons start at, the
--     course they are on, and when they last practised it. Durable: switching
--     away never deletes it.
--   * `user_profiles.target_language` — now nothing more than "which
--     enrollment am I in right now". The three columns beside it are a
--     denormalised copy of the active enrollment so every existing read path
--     (Home, Learn, the proficiency report, the guard trigger) keeps working
--     unchanged.
--
-- Writes go through `switch_target_language` rather than a client UPDATE: the
-- snapshot-then-restore is two statements that must not half-apply, and a
-- client able to write enrollments directly could park a course id from
-- another language on a row (CLAUDE.md §4: client-writable is the exception).
-- Clients get SELECT only.
--
-- Deliberately NOT per language: the subscription, every AI quota, the free
-- tier's 5 new cards a day, daily minutes and achievements. A plan covers the
-- account, and studying three languages neither triples the allowance nor
-- splits the day's effort into three separate ledgers.

CREATE TABLE IF NOT EXISTS public.user_language_enrollments (
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language          text        NOT NULL
                                CHECK (language IN ('es','fr','de','it','pt','ja','ko','zh','ru')),
  -- The level the learner declared for THIS language. A B1 Spanish speaker
  -- starting Japanese is a beginner in Japanese; one column on the profile
  -- could never say both.
  level             text        NOT NULL
                                CHECK (level IN ('beginner','elementary','intermediate','upper_intermediate','advanced')),
  -- Band of the course they STARTED in, per migration 125's meaning: the
  -- proficiency report treats rungs below it as assumed, not measured.
  placement_band    text        CHECK (placement_band IN ('A1','A2','B1','B2','C1','C2')),
  current_course_id uuid        REFERENCES public.courses(id) ON DELETE SET NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  -- Orders the switcher: most recently practised first.
  last_active_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language)
);

CREATE INDEX IF NOT EXISTS user_language_enrollments_recent_idx
  ON public.user_language_enrollments (user_id, last_active_at DESC);

-- Same rule the profile's pointer lives under (migration 125): a course id on
-- an enrollment must be a published, non-goal course in that enrollment's own
-- language. Goal tracks belong to `user_goal_tracks`, not here.
CREATE OR REPLACE FUNCTION public.fluenci_guard_enrollment_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  IF NEW.current_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, target_language, is_published, goal_key
    INTO c
    FROM public.courses
   WHERE id = NEW.current_course_id;

  IF c.id IS NULL
     OR NOT c.is_published
     OR c.goal_key IS NOT NULL
     OR c.target_language <> NEW.language THEN
    RAISE EXCEPTION 'current_course_id must be a published, non-goal course in the enrollment''s language'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fluenci_guard_enrollment_course ON public.user_language_enrollments;
CREATE TRIGGER fluenci_guard_enrollment_course
  BEFORE INSERT OR UPDATE ON public.user_language_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_guard_enrollment_course();

ALTER TABLE public.user_language_enrollments ENABLE ROW LEVEL SECURITY;

-- Read-only to clients. Every write path is a SECURITY DEFINER function below.
DROP POLICY IF EXISTS "Users read their own language enrollments" ON public.user_language_enrollments;
CREATE POLICY "Users read their own language enrollments" ON public.user_language_enrollments
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Backfill: every existing profile is already enrolled in the language it is
-- pointed at. `created_at`/`updated_at` are the closest honest answers for
-- when that language started and was last touched.
INSERT INTO public.user_language_enrollments
  (user_id, language, level, placement_band, current_course_id, started_at, last_active_at)
SELECT p.user_id, p.target_language, p.level, p.placement_band, p.current_course_id,
       COALESCE(p.created_at, now()), COALESCE(p.updated_at, now())
  FROM public.user_profiles p
 WHERE p.target_language IN ('es','fr','de','it','pt','ja','ko','zh','ru')
ON CONFLICT (user_id, language) DO NOTHING;

/**
 * Make `p_language` the caller's active language.
 *
 * Snapshots whatever the profile currently holds back onto the enrollment it
 * came from, then points the profile at the requested one — so switching away
 * and back lands the learner exactly where they left off, on the course they
 * were on, at the level they declared for that language.
 *
 * `p_level` / `p_current_course_id` / `p_placement_band` are how a NEW
 * language is added: the client resolves placement (lib/course-placement.ts is
 * the one source of truth for that) and hands the answer in. Passing them for
 * a language already enrolled re-places it, which is what Settings does when
 * the learner changes their level. Omitting them for a language that has no
 * enrollment is an error rather than a silent guess at A1.
 */
CREATE OR REPLACE FUNCTION public.switch_target_language(
  p_language          text,
  p_level             text DEFAULT NULL,
  p_current_course_id uuid DEFAULT NULL,
  p_placement_band    text DEFAULT NULL
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_prev public.user_profiles;
  v_enr  public.user_language_enrollments;
  v_row  public.user_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_language IS NULL
     OR p_language NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    RAISE EXCEPTION 'invalid target_language' USING ERRCODE = '22023';
  END IF;
  IF p_level IS NOT NULL
     AND p_level NOT IN ('beginner','elementary','intermediate','upper_intermediate','advanced') THEN
    RAISE EXCEPTION 'invalid level' USING ERRCODE = '22023';
  END IF;
  IF p_placement_band IS NOT NULL
     AND p_placement_band NOT IN ('A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'invalid placement_band' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prev FROM public.user_profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_prev.user_id IS NULL THEN
    RAISE EXCEPTION 'no profile for caller' USING ERRCODE = 'P0002';
  END IF;

  -- Snapshot the language being left. Skipped when it is the same language
  -- (the update below writes the same facts anyway).
  IF v_prev.target_language IS DISTINCT FROM p_language
     AND v_prev.target_language IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    INSERT INTO public.user_language_enrollments AS e
      (user_id, language, level, placement_band, current_course_id, last_active_at)
    VALUES
      (v_uid, v_prev.target_language, v_prev.level, v_prev.placement_band, v_prev.current_course_id, clock_timestamp())
    ON CONFLICT (user_id, language) DO UPDATE SET
      level             = EXCLUDED.level,
      placement_band    = EXCLUDED.placement_band,
      current_course_id = EXCLUDED.current_course_id,
      last_active_at    = EXCLUDED.last_active_at;
  END IF;

  SELECT * INTO v_enr
    FROM public.user_language_enrollments
   WHERE user_id = v_uid AND language = p_language;

  IF v_enr.user_id IS NULL AND p_level IS NULL THEN
    RAISE EXCEPTION 'not enrolled in % — pass p_level to start it', p_language
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_language_enrollments AS e
    (user_id, language, level, placement_band, current_course_id, last_active_at)
  VALUES (
    v_uid,
    p_language,
    COALESCE(p_level, v_enr.level),
    -- A caller that named a level is re-placing: its band and course win,
    -- nulls included ("no lesson path"). A caller that did not keeps what the
    -- enrollment already holds.
    CASE WHEN p_level IS NOT NULL THEN p_placement_band ELSE v_enr.placement_band END,
    CASE WHEN p_level IS NOT NULL THEN p_current_course_id ELSE v_enr.current_course_id END,
    -- clock_timestamp(), not now(): `now()` is the TRANSACTION's start time, so
    -- the snapshot of the language being left and the row being entered would
    -- carry the identical stamp and the switcher's "most recent first" order
    -- would be a coin toss between exactly the two languages a learner is
    -- moving between.
    clock_timestamp()
  )
  ON CONFLICT (user_id, language) DO UPDATE SET
    level             = EXCLUDED.level,
    placement_band    = EXCLUDED.placement_band,
    current_course_id = EXCLUDED.current_course_id,
    last_active_at    = EXCLUDED.last_active_at
  RETURNING * INTO v_enr;

  UPDATE public.user_profiles SET
    target_language   = v_enr.language,
    level             = v_enr.level,
    placement_band    = v_enr.placement_band,
    current_course_id = v_enr.current_course_id,
    updated_at        = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.switch_target_language(text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.switch_target_language(text, text, uuid, text) TO authenticated;

/**
 * Keep the active enrollment in step with a profile write that did not go
 * through `switch_target_language` — Settings saving a new level, the Learn
 * tab's course pills moving the pointer, `useEnsurePlacement` healing a null.
 *
 * Without this the enrollment would hold whatever was true at the last switch,
 * and switching away and back would silently undo the learner's last few
 * weeks of course movement.
 */
CREATE OR REPLACE FUNCTION public.fluenci_sync_active_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.target_language IS NULL
     OR NEW.target_language NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_language_enrollments AS e
    (user_id, language, level, placement_band, current_course_id, last_active_at)
  VALUES
    (NEW.user_id, NEW.target_language, NEW.level, NEW.placement_band, NEW.current_course_id, clock_timestamp())
  ON CONFLICT (user_id, language) DO UPDATE SET
    level             = EXCLUDED.level,
    placement_band    = EXCLUDED.placement_band,
    current_course_id = EXCLUDED.current_course_id,
    last_active_at    = EXCLUDED.last_active_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fluenci_sync_active_enrollment ON public.user_profiles;
CREATE TRIGGER fluenci_sync_active_enrollment
  AFTER INSERT OR UPDATE OF target_language, level, placement_band, current_course_id
  ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_sync_active_enrollment();

-- A second backfill, for the learner who already switched language before this
-- migration existed: their old language's review history is still in
-- `review_items`, but the profile that named it was overwritten, so the
-- enrollment above only restores the language they happen to be sitting in
-- now. Any language they have actually studied gets an enrollment.
--
-- The level is the one the profile declares — it is the only level these
-- accounts ever stated, and Settings can correct it. The course is the
-- published one at that band in that language, which is where a re-placement
-- would have put them anyway.
INSERT INTO public.user_language_enrollments
  (user_id, language, level, placement_band, current_course_id, started_at, last_active_at)
SELECT DISTINCT ON (r.user_id, c.language)
       r.user_id,
       c.language,
       p.level,
       COALESCE(k.cefr_level, p.placement_band),
       k.id,
       -- `review_items` carries no created_at, so "started" is the earliest
       -- review we can see, and now() for a deck that has never been reviewed.
       COALESCE(MIN(r.last_reviewed_at) OVER (PARTITION BY r.user_id, c.language), now()),
       COALESCE(MAX(r.last_reviewed_at) OVER (PARTITION BY r.user_id, c.language), now())
  FROM public.review_items r
  JOIN public.cards c          ON c.id = r.card_id AND c.language IS NOT NULL
  JOIN public.user_profiles p  ON p.user_id = r.user_id
  LEFT JOIN public.courses k   ON k.target_language = c.language
                              AND k.cefr_level = p.placement_band
                              AND k.is_published
                              AND k.goal_key IS NULL
 WHERE c.language IN ('es','fr','de','it','pt','ja','ko','zh','ru')
ON CONFLICT (user_id, language) DO NOTHING;
