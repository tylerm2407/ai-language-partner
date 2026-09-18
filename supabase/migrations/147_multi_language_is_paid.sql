-- 147: studying more than one language at once is a paid feature.
--
-- The rule (decided 2026-09-17):
--   * Free: one open language. Starting another LOCKS the current one. A
--     locked language keeps everything (level, course, SRS deck) but cannot be
--     reopened on the free tier: never swap back without paying.
--   * Any paid tier: unlimited (9999, the same sentinel dailyNewCards uses, so
--     a school contract merged with GREATEST() can never downgrade it).
--   * A school contract may grant it through contract_config.maxLanguages.
--   * A paid learner who lapses keeps every enrollment, but switching is
--     refused until they pick which languages to keep (keep_languages()).
--
-- WHERE THE GATE LIVES. Not only in switch_target_language: the client can
-- write user_profiles.target_language directly (upsertProfile), and migration
-- 133's AFTER trigger turns that write into a brand-new enrollment. So the
-- limit is enforced by a BEFORE trigger on the profile, which every path that
-- changes the active language has to pass through: the RPC, a raw PATCH, and
-- apply_onboarding_draft. The RPC also checks first, only so it can return the
-- precise reason (locked vs. over the limit).
--
-- CONCURRENCY. Every change of active language updates the caller's
-- user_profiles row, so it holds that row's lock while the trigger counts
-- enrollments; keep_languages() and switch_target_language() take the same
-- lock up front. Two racing switches by one learner therefore serialise, and
-- the second re-counts under READ COMMITTED after the first commits. There is
-- no cross-user lock: the whole check is a primary-key range read over at most
-- nine rows.
--
-- UPGRADES NEED NO WEBHOOK WORK. "Locked" is a stored fact, but whether a
-- locked language can be REOPENED is computed from the live plan at switch
-- time. A learner who subscribes can open every locked language the moment
-- get_effective_limits sees the subscription, and a dropped RevenueCat event
-- cannot leave a paying learner locked out of anything but that moment.
--
-- ERROR CODES (the client maps these, see lib/language-access.ts):
--   FLL01  starting a new language would exceed the plan's limit
--   FLL02  the language is locked and the plan cannot reopen it
--   FLL03  the learner is over the limit (a lapsed plan) and must pick first

ALTER TABLE public.user_language_enrollments
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

COMMENT ON COLUMN public.user_language_enrollments.locked_at IS
  'Set when this language was closed to fit the plan''s maxLanguages (migration 147). '
  'Data is kept; reopening it needs a plan with room. The active language is never locked.';

-- ─── Plan matrix: maxLanguages ──────────────────────────────────────────────
-- Copy of the live definition (109 → 114 → 115 lineage) with one key added to
-- every tier and to the school merge. The other two copies of this matrix are
-- lib/plans.ts and supabase/functions/_shared/plan-limits.ts.

CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  personal_tier TEXT; personal_limits JSONB; school_config JSONB; result JSONB;
BEGIN
  SELECT COALESCE(s.tier,'free') INTO personal_tier FROM public.subscriptions s
  WHERE s.user_id=p_user_id AND s.is_active=TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now()) LIMIT 1;
  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":150,"dailyTranslations":90,"dailyWordLookups":800,"dailyChatCards":50,"dailyGoalTracks":1,"dailyAudiobookChapters":5,"monthlyAvatarGenerations":3,"dailyTutorMinutes":45,"monthlyTutorCents":1400,"maxLanguages":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"dailyWordLookups":600,"dailyChatCards":30,"dailyGoalTracks":1,"dailyAudiobookChapters":3,"monthlyAvatarGenerations":3,"dailyTutorMinutes":30,"monthlyTutorCents":800,"maxLanguages":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":20,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"dailyWordLookups":300,"dailyChatCards":15,"dailyGoalTracks":1,"dailyAudiobookChapters":0,"monthlyAvatarGenerations":3,"dailyTutorMinutes":15,"monthlyTutorCents":300,"maxLanguages":9999,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"dailyWordLookups":60,"dailyChatCards":3,"dailyGoalTracks":1,"dailyAudiobookChapters":0,"monthlyAvatarGenerations":0,"dailyTutorMinutes":0,"monthlyTutorCents":0,"maxLanguages":1,"audiobookNarration":false,"offlineMode":false}'::jsonb
  END;

  SELECT o.contract_config INTO school_config
  FROM public.classroom_enrollments ce
  JOIN public.classrooms c ON c.id=ce.classroom_id
  JOIN public.organizations o ON o.id=c.organization_id
  WHERE ce.student_id=p_user_id AND ce.dropped_at IS NULL AND o.is_active=TRUE
    AND (o.contract_end IS NULL OR o.contract_end >= CURRENT_DATE)
  ORDER BY (o.contract_config->>'dailyVoiceMinutes')::int DESC LIMIT 1;

  IF school_config IS NULL THEN RETURN personal_limits; END IF;

  result := jsonb_build_object(
    'dailyVoiceMinutes', GREATEST((personal_limits->>'dailyVoiceMinutes')::int,(school_config->>'dailyVoiceMinutes')::int),
    'dailyTextMessages', GREATEST((personal_limits->>'dailyTextMessages')::int,(school_config->>'dailyTextMessages')::int),
    'dailyWritingGrades', GREATEST((personal_limits->>'dailyWritingGrades')::int,(school_config->>'dailyWritingGrades')::int),
    'dailyPronunciationScores', GREATEST((personal_limits->>'dailyPronunciationScores')::int,(school_config->>'dailyPronunciationScores')::int),
    'dailyNewCards', GREATEST((personal_limits->>'dailyNewCards')::int,COALESCE((school_config->>'dailyNewCards')::int,0)),
    'dailyHints', GREATEST((personal_limits->>'dailyHints')::int,COALESCE((school_config->>'dailyHints')::int,0)),
    'dailyTranslations', GREATEST((personal_limits->>'dailyTranslations')::int,COALESCE((school_config->>'dailyTranslations')::int,0)),
    'dailyWordLookups', GREATEST((personal_limits->>'dailyWordLookups')::int,COALESCE((school_config->>'dailyWordLookups')::int,0)),
    'dailyChatCards', GREATEST((personal_limits->>'dailyChatCards')::int,COALESCE((school_config->>'dailyChatCards')::int,0)),
    'dailyGoalTracks', GREATEST((personal_limits->>'dailyGoalTracks')::int,COALESCE((school_config->>'dailyGoalTracks')::int,0)),
    'dailyAudiobookChapters', GREATEST((personal_limits->>'dailyAudiobookChapters')::int,COALESCE((school_config->>'dailyAudiobookChapters')::int,0)),
    'monthlyAvatarGenerations', GREATEST((personal_limits->>'monthlyAvatarGenerations')::int,COALESCE((school_config->>'monthlyAvatarGenerations')::int,0)),
    'dailyTutorMinutes', GREATEST((personal_limits->>'dailyTutorMinutes')::int,COALESCE((school_config->>'dailyTutorMinutes')::int,0)),
    'monthlyTutorCents', GREATEST((personal_limits->>'monthlyTutorCents')::int,COALESCE((school_config->>'monthlyTutorCents')::int,0)),
    -- Validated rather than cast: this is a key admins hand-edit, and a bad
    -- value ("unlimited", 2.5) must not throw here, where it would take every
    -- other quota check for the student down with it.
    'maxLanguages', GREATEST((personal_limits->>'maxLanguages')::int,
                    CASE WHEN school_config->>'maxLanguages' ~ '^[0-9]{1,9}$'
                         THEN (school_config->>'maxLanguages')::int ELSE 0 END),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean,false) OR COALESCE((school_config->>'audiobookNarration')::boolean,false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean,false) OR COALESCE((school_config->>'offlineMode')::boolean,false)
  );
  RETURN result;
END;
$function$;

-- ─── The gate ───────────────────────────────────────────────────────────────

/**
 * How many languages this account may have open at once. Fails closed: a
 * missing or malformed key reads as 1, never as unlimited.
 */
CREATE OR REPLACE FUNCTION public.fluenci_max_languages(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(1, COALESCE(
    CASE WHEN v.raw ~ '^[0-9]{1,9}$' THEN v.raw::int END, 1))
    FROM (SELECT public.get_effective_limits(p_user_id)->>'maxLanguages' AS raw) v;
$$;

REVOKE ALL ON FUNCTION public.fluenci_max_languages(uuid) FROM public, anon, authenticated;

/**
 * Raise unless `p_uid` may make `p_target` its active language right now.
 *
 * Counts the OTHER open enrollments: the target itself takes one slot whether
 * it is new, locked or already open. Callers must hold the caller's
 * user_profiles row lock (see the header).
 */
CREATE OR REPLACE FUNCTION public.fluenci_assert_language_capacity(p_uid uuid, p_target text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max       integer := public.fluenci_max_languages(p_uid);
  v_others    integer;
  v_target    public.user_language_enrollments;
BEGIN
  SELECT * INTO v_target
    FROM public.user_language_enrollments
   WHERE user_id = p_uid AND language = p_target;

  SELECT count(*) INTO v_others
    FROM public.user_language_enrollments
   WHERE user_id = p_uid AND locked_at IS NULL AND language <> p_target;

  IF v_others + 1 <= v_max THEN
    RETURN;
  END IF;

  IF v_target.user_id IS NOT NULL AND v_target.locked_at IS NULL THEN
    -- Already open, yet the account holds more open languages than its plan
    -- allows: a plan that lapsed. The learner picks what to keep first.
    RAISE EXCEPTION 'language_limit_resolve: pick which languages to keep (plan allows %)', v_max
      USING ERRCODE = 'FLL03';
  ELSIF v_target.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'language_locked: % is locked on this plan', p_target
      USING ERRCODE = 'FLL02';
  ELSE
    RAISE EXCEPTION 'language_limit: plan allows % open language(s)', v_max
      USING ERRCODE = 'FLL01';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fluenci_assert_language_capacity(uuid, text) FROM public, anon, authenticated;

/**
 * BEFORE trigger: no path may change the active language past the limit.
 *
 * Enforced for requests made as an end user (JWT role authenticated or anon).
 * Service-role and direct database sessions are trusted operators — support
 * tooling and migrations — and are left alone, as every other guard trigger in
 * this schema does.
 */
CREATE OR REPLACE FUNCTION public.fluenci_guard_language_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.target_language IS NULL
     OR NEW.target_language NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.target_language IS NOT DISTINCT FROM OLD.target_language THEN
    RETURN NEW;
  END IF;
  -- BEFORE INSERT also fires for an upsert that will resolve as an UPDATE
  -- (INSERT ... ON CONFLICT DO UPDATE), carrying the column DEFAULT 'es' when
  -- the caller did not name a language — upsertProfile's timezone sync does
  -- exactly that. The UPDATE branch is checked by its own firing; here only a
  -- genuinely new row is.
  IF TG_OP = 'INSERT'
     AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- A profile row can exist before onboarding finishes (the column defaults
  -- to 'es'), and migration 133's sync trigger gave that default an
  -- enrollment. Onboarding then choosing French is the learner's FIRST
  -- choice, not a second language, so the placeholder is dropped. Only for an
  -- account with no learning history at all: onboarding_completed is
  -- client-writable, so without that condition resetting it would be a free
  -- swap-back.
  IF TG_OP = 'UPDATE'
     AND OLD.onboarding_completed IS NOT TRUE
     AND OLD.target_language IS NOT NULL
     -- Only a LONE placeholder: an account holding any other enrollment has
     -- made a real choice before.
     AND NOT EXISTS (SELECT 1 FROM public.user_language_enrollments
                      WHERE user_id = NEW.user_id AND language <> OLD.target_language)
     AND NOT EXISTS (SELECT 1 FROM public.review_items WHERE user_id = NEW.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.lesson_completions WHERE user_id = NEW.user_id) THEN
    DELETE FROM public.user_language_enrollments
     WHERE user_id = NEW.user_id AND language = OLD.target_language;
  END IF;

  PERFORM public.fluenci_assert_language_capacity(NEW.user_id, NEW.target_language);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fluenci_guard_language_limit() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS fluenci_guard_language_limit ON public.user_profiles;
CREATE TRIGGER fluenci_guard_language_limit
  BEFORE INSERT OR UPDATE OF target_language
  ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_guard_language_limit();

/**
 * onboarding_completed is one-way for end users. Nothing in the app ever sets
 * it back to false, and the placeholder exemption above trusts "not completed"
 * to mean "never onboarded" — without this, resetting it would let a learner
 * with no SRS or lesson history (a tutor-only learner, say) trade languages
 * on the free tier indefinitely.
 */
CREATE OR REPLACE FUNCTION public.fluenci_guard_onboarding_one_way()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND OLD.onboarding_completed IS TRUE
     AND NEW.onboarding_completed IS NOT TRUE THEN
    RAISE EXCEPTION 'onboarding_completed cannot be reset' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fluenci_guard_onboarding_one_way() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS fluenci_guard_onboarding_one_way ON public.user_profiles;
CREATE TRIGGER fluenci_guard_onboarding_one_way
  BEFORE UPDATE OF onboarding_completed
  ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_guard_onboarding_one_way();

/**
 * Boolean form of the gate, for callers that must fall back rather than fail.
 */
CREATE OR REPLACE FUNCTION public.fluenci_language_capacity_ok(p_uid uuid, p_target text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fluenci_assert_language_capacity(p_uid, p_target);
  RETURN true;
EXCEPTION WHEN SQLSTATE 'FLL01' OR SQLSTATE 'FLL02' OR SQLSTATE 'FLL03' THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fluenci_language_capacity_ok(uuid, text) FROM public, anon, authenticated;

/**
 * The enrollment course guard (133) re-validated the course pointer on EVERY
 * update, so locking an enrollment whose course was later unpublished raised
 * 23514 — and a lapsed learner in that state could never resolve being over
 * the limit. Only a write that changes the pointer (or the row's language) is
 * checked now; the pointer itself is unchanged by a lock.
 */
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
  IF TG_OP = 'UPDATE'
     AND NEW.current_course_id IS NOT DISTINCT FROM OLD.current_course_id
     AND NEW.language = OLD.language THEN
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

-- The active language is never locked: whichever path made it active (and got
-- past the gate above) reopens it here.
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
    (user_id, language, level, placement_band, current_course_id, last_active_at, locked_at)
  VALUES
    (NEW.user_id, NEW.target_language, NEW.level, NEW.placement_band, NEW.current_course_id, clock_timestamp(), NULL)
  ON CONFLICT (user_id, language) DO UPDATE SET
    level             = EXCLUDED.level,
    placement_band    = EXCLUDED.placement_band,
    current_course_id = EXCLUDED.current_course_id,
    last_active_at    = EXCLUDED.last_active_at,
    locked_at         = NULL;

  RETURN NEW;
END;
$$;

-- ─── switch_target_language, with lock-and-switch ───────────────────────────
-- Dropped and recreated rather than overloaded: two candidates differing only
-- in a defaulted trailing argument make PostgREST's named-argument call
-- ambiguous. Clients built before this migration send four named arguments,
-- which the new signature still accepts (p_lock_current defaults to false).

DROP FUNCTION IF EXISTS public.switch_target_language(text, text, uuid, text);

/**
 * Make `p_language` the active one and return the resulting profile.
 *
 * `p_lock_current` is the free tier's "switch to X instead": lock the language
 * being left, then start `p_language`. It is only for starting a language the
 * account has never studied — a locked language is reopened by a plan with
 * room, never by trading another one for it.
 */
CREATE FUNCTION public.switch_target_language(
  p_language          text,
  p_level             text    DEFAULT NULL,
  p_current_course_id uuid    DEFAULT NULL,
  p_placement_band    text    DEFAULT NULL,
  p_lock_current      boolean DEFAULT false
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

  SELECT * INTO v_enr
    FROM public.user_language_enrollments
   WHERE user_id = v_uid AND language = p_language;

  IF v_enr.user_id IS NULL AND p_level IS NULL THEN
    RAISE EXCEPTION 'not enrolled in % — pass p_level to start it', p_language
      USING ERRCODE = '22023';
  END IF;

  -- Snapshot the language being left (unchanged from 133). Its locked_at is
  -- not touched here.
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

    IF p_lock_current THEN
      IF v_enr.user_id IS NOT NULL THEN
        -- Trading an open language for a locked one is the swap-back the
        -- free tier does not get; trading for another open one is never
        -- needed. Only a new language may be started this way.
        IF v_enr.locked_at IS NOT NULL THEN
          RAISE EXCEPTION 'language_locked: % is locked on this plan', p_language
            USING ERRCODE = 'FLL02';
        END IF;
        RAISE EXCEPTION 'p_lock_current is only for starting a new language'
          USING ERRCODE = '22023';
      END IF;
      UPDATE public.user_language_enrollments
         SET locked_at = clock_timestamp()
       WHERE user_id = v_uid AND language = v_prev.target_language;
    END IF;
  END IF;

  -- Checked here as well as in the trigger so the caller learns WHY
  -- (locked vs. new vs. over the limit) before anything is written.
  -- Re-placing the language already active (Settings' level change) is not a
  -- switch and is never gated, even for an account over its limit.
  IF p_language IS DISTINCT FROM v_prev.target_language THEN
    PERFORM public.fluenci_assert_language_capacity(v_uid, p_language);
  END IF;

  INSERT INTO public.user_language_enrollments AS e
    (user_id, language, level, placement_band, current_course_id, last_active_at, locked_at)
  VALUES (
    v_uid,
    p_language,
    COALESCE(p_level, v_enr.level),
    CASE WHEN p_level IS NOT NULL THEN p_placement_band ELSE v_enr.placement_band END,
    CASE WHEN p_level IS NOT NULL THEN p_current_course_id ELSE v_enr.current_course_id END,
    clock_timestamp(),
    NULL
  )
  ON CONFLICT (user_id, language) DO UPDATE SET
    level             = EXCLUDED.level,
    placement_band    = EXCLUDED.placement_band,
    current_course_id = EXCLUDED.current_course_id,
    last_active_at    = EXCLUDED.last_active_at,
    locked_at         = NULL
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

REVOKE ALL ON FUNCTION public.switch_target_language(text, text, uuid, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.switch_target_language(text, text, uuid, text, boolean) TO authenticated;

-- ─── keep_languages: resolving a lapsed plan ────────────────────────────────

/**
 * Keep `p_languages` open and lock every other open language. If the active
 * language is not kept, the first kept one becomes active.
 *
 * Only languages that are OPEN may be kept: otherwise a free learner could
 * name a locked language here and get the swap-back the plan does not sell.
 */
CREATE OR REPLACE FUNCTION public.keep_languages(p_languages text[])
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_prev  public.user_profiles;
  v_max   integer;
  v_n     integer;
  v_open  integer;
  v_enr   public.user_language_enrollments;
  v_row   public.user_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_n := COALESCE(cardinality(p_languages), 0);
  IF v_n = 0 OR v_n > 9 THEN
    RAISE EXCEPTION 'keep between 1 and 9 languages' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
       SELECT 1 FROM unnest(p_languages) AS l(code)
        WHERE l.code IS NULL OR l.code NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru'))
     OR (SELECT count(DISTINCT code) FROM unnest(p_languages) AS l(code)) <> v_n THEN
    RAISE EXCEPTION 'invalid or duplicate language' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prev FROM public.user_profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_prev.user_id IS NULL THEN
    RAISE EXCEPTION 'no profile for caller' USING ERRCODE = 'P0002';
  END IF;

  v_max := public.fluenci_max_languages(v_uid);
  IF v_n > v_max THEN
    RAISE EXCEPTION 'plan allows % open language(s)', v_max USING ERRCODE = 'FLL01';
  END IF;

  SELECT count(*) INTO v_open
    FROM public.user_language_enrollments
   WHERE user_id = v_uid AND locked_at IS NULL AND language = ANY (p_languages);
  IF v_open <> v_n THEN
    RAISE EXCEPTION 'only open languages can be kept' USING ERRCODE = 'FLL02';
  END IF;

  UPDATE public.user_language_enrollments
     SET locked_at = clock_timestamp()
   WHERE user_id = v_uid AND locked_at IS NULL AND NOT (language = ANY (p_languages));

  IF v_prev.target_language = ANY (p_languages) THEN
    RETURN v_prev;
  END IF;

  -- The active language was just locked (its enrollment already mirrors the
  -- profile, via fluenci_sync_active_enrollment); move to the first kept one.
  SELECT * INTO v_enr
    FROM public.user_language_enrollments
   WHERE user_id = v_uid AND language = p_languages[1];

  UPDATE public.user_profiles SET
    target_language   = v_enr.language,
    level             = v_enr.level,
    placement_band    = v_enr.placement_band,
    current_course_id = v_enr.current_course_id,
    updated_at        = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_row;

  -- The sync trigger re-stamped the kept language as active; the one just
  -- left must stay locked (the trigger only ever unlocks the NEW active one).
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_languages(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.keep_languages(text[]) TO authenticated;

-- ─── get_language_access: what the switcher needs to draw ───────────────────

/**
 * The caller's language allowance, computed from the live plan (school
 * contract included), so the client never derives it from a tier name.
 *
 *   maxLanguages  open languages the plan allows (9999 = unlimited)
 *   open          open languages, most recent first
 *   locked        locked languages, most recent first
 *   overLimit     true when a lapsed plan left more open than allowed:
 *                 the client must show the pick-what-to-keep screen
 */
CREATE OR REPLACE FUNCTION public.get_language_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_max    integer;
  v_open   text[];
  v_locked text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_max := public.fluenci_max_languages(v_uid);

  SELECT COALESCE(array_agg(language ORDER BY last_active_at DESC) FILTER (WHERE locked_at IS NULL), '{}'),
         COALESCE(array_agg(language ORDER BY last_active_at DESC) FILTER (WHERE locked_at IS NOT NULL), '{}')
    INTO v_open, v_locked
    FROM public.user_language_enrollments
   WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'maxLanguages', v_max,
    'open',         to_jsonb(v_open),
    'locked',       to_jsonb(v_locked),
    'overLimit',    cardinality(v_open) > v_max
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_language_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_language_access() TO authenticated;

-- ─── apply_onboarding_draft: a returning learner is not refused ─────────────
-- Onboarding can run again while signed out, then flush into an account that
-- already exists (sign in with Apple/Google as the old account). Before 147
-- that silently moved the account to the new language; under the gate, a free
-- account would now fail the whole flush with FLL01 and a generic "couldn't
-- save" alert. So: for an account that already finished onboarding, the
-- draft's language (and the level/course that belong to it) is applied only
-- when the plan can open it; otherwise the account keeps the language it has,
-- and the rest of the draft still lands. Adding a language is the switcher's
-- job, where the learner sees the choice. Body otherwise identical to the live
-- definition (127 → 142 → 143 → 144 → 145 lineage).

CREATE OR REPLACE FUNCTION public.apply_onboarding_draft(
  p_target_language text, p_level text, p_daily_goal_minutes integer, p_ideal_l2_self text,
  p_display_name text, p_avatar_preset_id text, p_current_course_id uuid, p_placement_band text,
  p_first_lesson boolean)
 RETURNS user_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_name       text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_ideal      text := NULLIF(btrim(COALESCE(p_ideal_l2_self, '')), '');
  v_preset     text := NULLIF(btrim(COALESCE(p_avatar_preset_id, '')), '');
  v_checklist  jsonb;
  v_existing   public.user_profiles;
  v_keep_lang  boolean := false;
  v_row        public.user_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_target_language IS NULL
     OR p_target_language NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    RAISE EXCEPTION 'invalid target_language' USING ERRCODE = '22023';
  END IF;
  IF p_level IS NULL
     OR p_level NOT IN ('beginner','elementary','intermediate','upper_intermediate','advanced') THEN
    RAISE EXCEPTION 'invalid level' USING ERRCODE = '22023';
  END IF;
  IF p_daily_goal_minutes IS NULL OR p_daily_goal_minutes < 1 OR p_daily_goal_minutes > 180 THEN
    RAISE EXCEPTION 'invalid daily_goal_minutes (1-180)' USING ERRCODE = '22023';
  END IF;
  IF v_ideal IS NOT NULL AND char_length(v_ideal) > 300 THEN
    RAISE EXCEPTION 'ideal_l2_self exceeds 300 characters' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NOT NULL AND char_length(v_name) > 24 THEN
    RAISE EXCEPTION 'display_name exceeds 24 characters' USING ERRCODE = '22023';
  END IF;
  IF v_preset IS NOT NULL AND char_length(v_preset) > 64 THEN
    RAISE EXCEPTION 'invalid avatar_preset_id' USING ERRCODE = '22023';
  END IF;
  IF p_placement_band IS NOT NULL
     AND p_placement_band NOT IN ('A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'invalid placement_band' USING ERRCODE = '22023';
  END IF;

  -- Locked so the capacity answer below still holds when the upsert lands.
  SELECT * INTO v_existing FROM public.user_profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_existing.user_id IS NOT NULL
     AND v_existing.onboarding_completed IS TRUE
     AND v_existing.target_language IS DISTINCT FROM p_target_language THEN
    v_keep_lang := NOT public.fluenci_language_capacity_ok(v_uid, p_target_language);
  END IF;

  v_checklist := jsonb_build_object(
    'chooseLanguage', true,
    'firstLesson',    COALESCE(p_first_lesson, false),
    'aiConversation', false,
    'dailyReminder',  false,
    'skipped',        '[]'::jsonb,
    'dismissed',      false,
    'completedAt',    NULL,
    'celebratedAt',   NULL
  );

  INSERT INTO public.user_profiles AS up (
    user_id, display_name, native_language, target_language, level, daily_goal_minutes,
    ideal_l2_self, current_course_id, placement_band, avatar_kind, avatar_preset_id,
    onboarding_checklist, onboarding_completed, updated_at
  )
  VALUES (
    v_uid, COALESCE(v_name, ''), 'en', p_target_language, p_level, p_daily_goal_minutes,
    v_ideal, p_current_course_id, p_placement_band,
    CASE WHEN v_preset IS NOT NULL THEN 'preset' ELSE 'procedural' END,
    v_preset, v_checklist, true, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name         = COALESCE(v_name, up.display_name),
    target_language      = CASE WHEN v_keep_lang THEN up.target_language   ELSE EXCLUDED.target_language   END,
    level                = CASE WHEN v_keep_lang THEN up.level             ELSE EXCLUDED.level             END,
    daily_goal_minutes   = EXCLUDED.daily_goal_minutes,
    ideal_l2_self        = EXCLUDED.ideal_l2_self,
    current_course_id    = CASE WHEN v_keep_lang THEN up.current_course_id ELSE EXCLUDED.current_course_id END,
    placement_band       = CASE WHEN v_keep_lang THEN up.placement_band    ELSE EXCLUDED.placement_band    END,
    avatar_kind          = CASE WHEN v_preset IS NOT NULL THEN 'preset' ELSE up.avatar_kind END,
    avatar_preset_id     = CASE WHEN v_preset IS NOT NULL THEN v_preset ELSE up.avatar_preset_id END,
    onboarding_checklist = EXCLUDED.onboarding_checklist,
    onboarding_completed = true,
    updated_at           = now()
  RETURNING * INTO v_row;

  -- The NAME is written by the fluenci_sync_name_memory trigger (144), which
  -- fires wherever display_name is actually set — including this statement.
  -- The goal note belongs to the language the account actually ended up in.
  BEGIN
    IF v_ideal IS NOT NULL THEN
      PERFORM public.upsert_learner_memory(
        v_uid, v_row.target_language, 'goal',
        'What they pictured being able to do: ' || left(v_ideal, 160),
        'onboarding'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tutor_memory goal seed skipped for %: % (%)', v_uid, SQLERRM, SQLSTATE;
  END;

  RETURN v_row;
END;
$function$;
