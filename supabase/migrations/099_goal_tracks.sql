-- 099 — Goal tracks: turn the onboarding "ideal self" answer into real lessons.
--
-- Onboarding asks "picture a moment you'd love to have in this language" and
-- stores the answer in `user_profiles.ideal_l2_self`. Until now the only thing
-- that ever read it was a local notification. This turns it into a 6-8 lesson
-- unit in Learn, built for that moment.
--
-- WHY THE TRACK IS REAL CURRICULUM ROWS
--
-- A goal track is a `courses` row with a `goal_key`, holding one unit and its
-- lessons and exercises — the same tables the hand-authored curriculum uses.
-- That is the whole point: the lesson runner, the SRS write path, the
-- new-card cap and the proficiency engine all work on it unchanged, with no
-- parallel "generated content" code path to keep in step. A generated lesson
-- is a lesson.
--
-- WHY TRACKS ARE SHARED, NOT PER-LEARNER
--
-- Generating 6-8 lessons costs real money. Two learners who both want to order
-- dinner in French without switching to English want the SAME track, so the
-- free text is mapped onto a closed vocabulary (_shared/goal-taxonomy.ts) and
-- reduced to a key like `fr:hospitality:cafe_bar+restaurant:informal`. An exact
-- key hit reuses the existing course at zero model cost; a near hit — same
-- language, domain and register, with most scenarios in common — reuses it too.
-- Only a genuine miss pays to build one.
--
-- Because tracks are shared, `courses` needs no per-learner column and the
-- existing "authenticated can read all curriculum" policies already cover
-- them. `user_goal_tracks` records who is on which track, and is the only
-- per-learner row involved.
--
-- WHY LESSONS ARE GENERATED LAZILY
--
-- Building 6-8 lessons of exercises in one request would take longer than an
-- edge function may run. Instead the track is created immediately with lesson
-- shells — real `lessons` rows with titles and descriptions from a single
-- model call — and each lesson's exercises are generated the first time
-- anybody opens it. `generation_state` is what tells the two apart. The work
-- is shared like everything else here: the first learner to open lesson 3 pays
-- for it, everyone after them does not.

-- ─── Goal tracks are courses ─────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS goal_key text;

COMMENT ON COLUMN public.courses.goal_key IS
  'Canonical goal key from _shared/goal-taxonomy.ts, e.g. '
  '"fr:hospitality:cafe_bar+restaurant:informal". NULL for the hand-authored '
  'curriculum. Non-NULL marks a generated goal track, which is hidden from the '
  'general course list and reached only through user_goal_tracks.';

-- One track per key. This is the constraint the whole cost control rests on:
-- without it, two learners racing through onboarding with the same goal would
-- each generate their own copy.
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_goal_key
  ON public.courses (goal_key)
  WHERE goal_key IS NOT NULL;

-- ─── Lesson generation state ─────────────────────────────────────────────
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS generation_state text
  CHECK (generation_state IN ('pending', 'generating', 'ready'));

COMMENT ON COLUMN public.lessons.generation_state IS
  'NULL for hand-authored lessons, which are always ready. For goal-track '
  'lessons: pending = a shell with a title but no exercises yet, generating = '
  'someone is building it now, ready = it has exercises. A learner is never '
  'shown a pending lesson as openable.';

CREATE INDEX IF NOT EXISTS idx_lessons_generation_state
  ON public.lessons (unit_id, generation_state)
  WHERE generation_state IS NOT NULL;

-- ─── Who is on which track ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_goal_tracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  goal_key    text NOT NULL,
  -- The learner's own ranked scenarios, kept even though the key sorts them:
  -- the ranking decides lesson order and is worth not regenerating.
  scenarios   text[] NOT NULL DEFAULT '{}',
  -- Which text produced this key, so a learner who rewrites their goal gets a
  -- new track rather than silently keeping the old one.
  source_text text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_key)
);

CREATE INDEX IF NOT EXISTS idx_user_goal_tracks_user ON public.user_goal_tracks (user_id);

ALTER TABLE public.user_goal_tracks ENABLE ROW LEVEL SECURITY;

-- Read-only to the learner. Rows are written by the generate-goal-track edge
-- function with the service role: which track you are on decides whether a
-- paid feature has been delivered, so it is not a client write (CLAUDE.md §1.2).
CREATE POLICY "Users read own goal tracks" ON public.user_goal_tracks
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
