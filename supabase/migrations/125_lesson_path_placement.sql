-- 125 — Lesson path placement: current_course_id + placement_band on user_profiles.
--
-- Onboarding collected a self-declared level since day one, but nothing routed
-- lessons off it: `fetchCourses` orders by cefr_level ASC and both the Learn
-- tab and the Home "Continue learning" rollup took courses[0], so every learner
-- — including one who said "upper intermediate" — landed in the A1 course.
-- Reading, writing, chat and news already gate on level; lessons were the gap.
--
-- Two columns, deliberately separate:
--
--  * current_course_id — a navigation pointer. Which course Home and Learn open
--    on. Written at onboarding, on a Settings level/language change, and by the
--    Learn course pills, so Home follows what the learner last looked at. FK
--    with ON DELETE SET NULL: an unpublished-and-deleted course leaves the
--    learner "unplaced", which the client heals to their level's default.
--
--  * placement_band — an assessment input. The CEFR band of the course the
--    learner STARTED in (one below their declared level if they chose to warm
--    up; B2 for an advanced learner, since no C1 course exists yet; their
--    declared band if they chose no lesson path at all). lib/cefr-proficiency.ts
--    treats bands strictly below it as "assumed from placement" instead of
--    breaking the contiguity walk on them — otherwise a learner who starts at
--    B1 never touches A1/A2 cards and is never assessed. Stable: pills do not
--    move it.
--
-- Both are client-writable under the existing user_profiles RLS (SELECT /
-- UPDATE / INSERT, (select auth.uid()) = user_id, TO authenticated). Neither
-- has economic meaning; placement_band is a self-declaration of exactly the
-- same class as `level`, which is already client-writable and which the report
-- already used as its stand-in. The trigger below is an integrity guard, not an
-- ownership guard: the pointer must name a published, non-goal course in the
-- profile's own target language, and a language change that leaves the pointer
-- behind clears it rather than letting Home render a Spanish path under a
-- Japanese profile.
--
-- Applied to production 2026-09-11.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS current_course_id uuid
    REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_band text
    CHECK (placement_band IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

COMMENT ON COLUMN public.user_profiles.current_course_id IS
  'Course Home and Learn open on. Moved by onboarding, Settings and the Learn course pills. Null = no lesson path (advanced learner, no C1 course yet) or unplaced (client re-places).';
COMMENT ON COLUMN public.user_profiles.placement_band IS
  'CEFR band of the course the learner started in. Bands strictly below it are assumed, not measured, by the proficiency report. Stable; never moved by course pills.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_current_course
  ON public.user_profiles (current_course_id)
  WHERE current_course_id IS NOT NULL;

-- Integrity guard. Kept separate from fluenci_guard_gamification (036/084):
-- that trigger protects server-owned columns from the client; this one keeps a
-- client-owned pointer pointing at something sane.
CREATE OR REPLACE FUNCTION public.fluenci_guard_current_course()
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

  -- Language changed but the pointer did not come with it: the old course can
  -- no longer be right, so clear both and let the client re-place. Preferable
  -- to raising, because any writer that only touches target_language would
  -- otherwise fail on a column it never mentioned.
  IF TG_OP = 'UPDATE'
     AND NEW.current_course_id IS NOT DISTINCT FROM OLD.current_course_id
     AND NEW.target_language IS DISTINCT FROM OLD.target_language
     AND (c.id IS NULL OR c.target_language <> NEW.target_language) THEN
    NEW.current_course_id := NULL;
    NEW.placement_band := NULL;
    RETURN NEW;
  END IF;

  -- A pointer being SET to something wrong is a client bug: reject loudly.
  IF c.id IS NULL
     OR NOT c.is_published
     OR c.goal_key IS NOT NULL
     OR c.target_language <> NEW.target_language THEN
    RAISE EXCEPTION 'current_course_id must be a published, non-goal course in the profile''s target language'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are not meant to be callable through PostgREST; the
-- security advisor flags every SECURITY DEFINER function anon or authenticated
-- can EXECUTE. It stays SECURITY DEFINER so the guard can see an unpublished
-- course's row through RLS and reject a pointer at it.
REVOKE EXECUTE ON FUNCTION public.fluenci_guard_current_course() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_current_course ON public.user_profiles;
CREATE TRIGGER trg_guard_current_course
  BEFORE INSERT OR UPDATE OF current_course_id, target_language
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fluenci_guard_current_course();

-- Backfill existing accounts (5 in production at the time of writing): the
-- course at the declared level's band, else the highest published band below
-- it. That gives an advanced learner B2 without asking — acceptable for the
-- handful of existing accounts; new advanced learners choose in onboarding.
-- 'A1' < 'A2' < 'B1' < 'B2' < 'C1' < 'C2' holds lexically, so a text compare
-- is a correct ladder compare here.
WITH band AS (
  SELECT user_id,
         target_language,
         CASE level
           WHEN 'beginner'           THEN 'A1'
           WHEN 'elementary'         THEN 'A2'
           WHEN 'intermediate'       THEN 'B1'
           WHEN 'upper_intermediate' THEN 'B2'
           ELSE 'C1'
         END AS b
    FROM public.user_profiles
   WHERE placement_band IS NULL
), pick AS (
  SELECT band.user_id, c.id AS course_id, c.cefr_level
    FROM band
    JOIN LATERAL (
      SELECT id, cefr_level
        FROM public.courses
       WHERE target_language = band.target_language
         AND is_published
         AND goal_key IS NULL
         AND cefr_level <= band.b
       ORDER BY cefr_level DESC
       LIMIT 1
    ) c ON true
)
UPDATE public.user_profiles p
   SET current_course_id = pick.course_id,
       placement_band    = pick.cefr_level,
       updated_at        = now()
  FROM pick
 WHERE p.user_id = pick.user_id;
