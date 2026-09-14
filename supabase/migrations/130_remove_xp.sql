-- 130 — Remove XP outright.
--
-- WHY — migration 120 retired client-awarded XP: the award RPCs were revoked
-- and two triggers forced every new `xp_earned` to zero. That left a frozen
-- ledger nothing read: `user_profiles.total_xp / xp_level / league_tier`
-- stopped moving, `lessons.xp_reward` fed a number the runner computed and
-- discarded, and the client still mounted a hook in four screens purely to
-- mirror a level nobody rendered. The product's claim is measured proficiency
-- (CLAUDE.md §1); a points column that can never change is dead weight that
-- every new engineer has to be told to ignore. Same reasoning as 083 (streaks)
-- and 084 (hearts): a mechanic that does nothing is removed, not hidden.
--
-- WHAT GOES — the three profile columns, `xp_earned` on lesson_completions and
-- daily_stats, `lessons.xp_reward`, `daily_challenges.bonus_xp_claimed`, both
-- award RPCs and their two threshold helpers, the two "retire" triggers from
-- 120, and `claim_daily_challenge_bonus` (zero-reward since 120, no callers).
--
-- WHAT STAYS, REWRITTEN — `fluenci_guard_gamification` now guards only
-- `free_avatar_used_at`; `upsert_daily_stats` loses `p_xp_earned` (a new
-- signature, so the old one is dropped first); `record_lesson_completion`
-- (128) no longer writes `xp_earned`; `fluenci_challenges_all_complete` loses
-- its `xpEarned` branch; `cleanup_expired_cache` no longer preserves `xp:*`
-- event keys, so the idempotency rows behind the old awards age out with
-- everything else. `client_events` itself stays — the onboarding checklist
-- still keys on it.
--
-- CLIENT — the app build that pairs with this migration calls
-- `upsert_daily_stats` without `p_xp_earned`. An older build's call names a
-- parameter that no longer exists and fails; the same build is already unable
-- to write completions since 128, so this widens nothing that is not already
-- gated on the rebuild.

-- ─── 1. Award RPCs, helpers, retire triggers, bonus claim ───────────────────

DROP FUNCTION IF EXISTS public.increment_xp(uuid, integer);
DROP FUNCTION IF EXISTS public.increment_xp_idempotent(integer, text);
DROP FUNCTION IF EXISTS public.claim_daily_challenge_bonus();
DROP FUNCTION IF EXISTS public.fluenci_level_for_xp(integer);
DROP FUNCTION IF EXISTS public.fluenci_league_for_level(integer);

DROP TRIGGER IF EXISTS fluenci_retire_daily_xp_trigger ON public.daily_stats;
DROP TRIGGER IF EXISTS fluenci_retire_lesson_xp_trigger ON public.lesson_completions;
DROP FUNCTION IF EXISTS public.fluenci_retire_daily_xp();
DROP FUNCTION IF EXISTS public.fluenci_retire_lesson_xp();

-- The challenge-state guard existed only to keep `bonus_xp_claimed`
-- server-owned. With the column gone it guards nothing.
DROP TRIGGER IF EXISTS fluenci_guard_challenge_state_trigger ON public.daily_challenges;
DROP FUNCTION IF EXISTS public.fluenci_guard_challenge_state();

-- ─── 2. Functions that named the columns ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fluenci_guard_gamification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('fluenci.gamification_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.free_avatar_used_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.free_avatar_used_at IS DISTINCT FROM OLD.free_avatar_used_at THEN
    RAISE EXCEPTION 'free_avatar_used_at is server-managed; use consume_free_avatar / release_free_avatar'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Signature change: drop the 11-parameter form before creating the 10.
DROP FUNCTION IF EXISTS public.upsert_daily_stats(uuid, integer, integer, integer, real, real, real, real, real, integer, real);

CREATE OR REPLACE FUNCTION public.upsert_daily_stats(
  p_user_id           uuid,
  p_lessons_completed integer DEFAULT 0,
  p_cards_reviewed    integer DEFAULT 0,
  p_cards_learned     integer DEFAULT 0,
  p_minutes_practiced real    DEFAULT 0,
  p_speaking_minutes  real    DEFAULT 0,
  p_listening_minutes real    DEFAULT 0,
  p_reading_minutes   real    DEFAULT 0,
  p_writing_minutes   real    DEFAULT 0,
  p_accuracy          real    DEFAULT NULL
)
RETURNS SETOF public.daily_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s stats'
      USING ERRCODE = '42501';
  END IF;

  p_lessons_completed := GREATEST(0, LEAST(COALESCE(p_lessons_completed, 0), 100));
  p_cards_reviewed    := GREATEST(0, LEAST(COALESCE(p_cards_reviewed, 0), 2000));
  -- cards_learned is moved only by the new-card slot RPC and the review_items
  -- insert trigger (migration 114). The parameter is accepted and ignored.
  p_cards_learned     := 0;
  p_minutes_practiced := GREATEST(0, LEAST(COALESCE(p_minutes_practiced, 0), 1440));
  p_speaking_minutes  := GREATEST(0, LEAST(COALESCE(p_speaking_minutes, 0), 1440));
  p_listening_minutes := GREATEST(0, LEAST(COALESCE(p_listening_minutes, 0), 1440));
  p_reading_minutes   := GREATEST(0, LEAST(COALESCE(p_reading_minutes, 0), 1440));
  p_writing_minutes   := GREATEST(0, LEAST(COALESCE(p_writing_minutes, 0), 1440));

  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_stats
    (user_id, date, lessons_completed, cards_reviewed, cards_learned,
     minutes_practiced, speaking_minutes, listening_minutes,
     reading_minutes, writing_minutes, accuracy)
  VALUES
    (p_user_id, v_today, p_lessons_completed, p_cards_reviewed, p_cards_learned,
     p_minutes_practiced, p_speaking_minutes, p_listening_minutes,
     p_reading_minutes, p_writing_minutes, COALESCE(p_accuracy, 0))
  ON CONFLICT (user_id, date) DO UPDATE SET
    lessons_completed = daily_stats.lessons_completed + EXCLUDED.lessons_completed,
    cards_reviewed    = daily_stats.cards_reviewed + EXCLUDED.cards_reviewed,
    minutes_practiced = daily_stats.minutes_practiced + EXCLUDED.minutes_practiced,
    speaking_minutes  = daily_stats.speaking_minutes + EXCLUDED.speaking_minutes,
    listening_minutes = daily_stats.listening_minutes + EXCLUDED.listening_minutes,
    reading_minutes   = daily_stats.reading_minutes + EXCLUDED.reading_minutes,
    writing_minutes   = daily_stats.writing_minutes + EXCLUDED.writing_minutes,
    accuracy          = COALESCE(p_accuracy, daily_stats.accuracy);

  RETURN QUERY
    SELECT * FROM public.daily_stats d
     WHERE d.user_id = p_user_id AND d.date = v_today;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer, real, real, real, real, real, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_daily_stats(uuid, integer, integer, integer, real, real, real, real, real, real) TO authenticated, service_role;

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

  v_score := GREATEST(0, LEAST(COALESCE(p_score, 0), 1));
  v_time  := GREATEST(0, LEAST(COALESCE(p_time_spent_ms, 0), 86400000));

  INSERT INTO public.lesson_completions AS lc
    (user_id, lesson_id, course_id, score, time_spent_ms, completed_at)
  VALUES
    (v_uid, p_lesson_id, v_course, v_score, v_time, now())
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    score         = GREATEST(lc.score, EXCLUDED.score),
    time_spent_ms = EXCLUDED.time_spent_ms,
    completed_at  = EXCLUDED.completed_at
  RETURNING lc.*, (lc.xmax = 0) AS first_completion INTO v_rec;

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

CREATE OR REPLACE FUNCTION public.fluenci_challenges_all_complete(p_uid uuid, p_date date, p_challenges jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats public.daily_stats%ROWTYPE;
  v_item jsonb;
  v_pool record;
  v_actual numeric;
  v_seen int := 0;
BEGIN
  IF p_challenges IS NULL
     OR jsonb_typeof(p_challenges) <> 'array'
     OR jsonb_array_length(p_challenges) = 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_stats FROM public.daily_stats
   WHERE user_id = p_uid AND date = p_date;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_challenges) LOOP
    SELECT p.challenge_type, p.target, p.stat_key INTO v_pool
      FROM public.fluenci_challenge_pool() p
     WHERE p.challenge_type = (v_item->>'type');

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    v_actual := CASE v_pool.stat_key
      WHEN 'lessonsCompleted' THEN COALESCE(v_stats.lessons_completed, 0)::numeric
      WHEN 'cardsReviewed'    THEN COALESCE(v_stats.cards_reviewed, 0)::numeric
      WHEN 'cardsLearned'     THEN COALESCE(v_stats.cards_learned, 0)::numeric
      WHEN 'minutesPracticed' THEN COALESCE(v_stats.minutes_practiced, 0)::numeric
      WHEN 'speakingMinutes'  THEN COALESCE(v_stats.speaking_minutes, 0)::numeric
      WHEN 'listeningMinutes' THEN COALESCE(v_stats.listening_minutes, 0)::numeric
      ELSE NULL
    END;

    IF v_actual IS NULL OR v_actual < v_pool.target THEN
      RETURN false;
    END IF;

    v_seen := v_seen + 1;
  END LOOP;

  RETURN v_seen > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  api_deleted INTEGER;
  translation_deleted INTEGER;
  explanation_deleted INTEGER;
  events_deleted INTEGER;
BEGIN
  DELETE FROM public.api_cache WHERE expires_at < now();
  GET DIAGNOSTICS api_deleted = ROW_COUNT;

  DELETE FROM public.translation_cache WHERE expires_at < now();
  GET DIAGNOSTICS translation_deleted = ROW_COUNT;

  DELETE FROM public.explanation_cache WHERE expires_at < now();
  GET DIAGNOSTICS explanation_deleted = ROW_COUNT;

  -- Onboarding-checklist keys are permanent facts about the account; every
  -- other client event (including the retired xp:* award keys) is a 90-day
  -- idempotency window and nothing more.
  DELETE FROM public.client_events
   WHERE created_at < now() - interval '90 days'
     AND event_key NOT LIKE 'onboarding-checklist:%';
  GET DIAGNOSTICS events_deleted = ROW_COUNT;

  RETURN api_deleted + translation_deleted + explanation_deleted + events_deleted;
END;
$$;

-- ─── 3. Columns ─────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS total_xp,
  DROP COLUMN IF EXISTS xp_level,
  DROP COLUMN IF EXISTS league_tier;

ALTER TABLE public.lesson_completions DROP COLUMN IF EXISTS xp_earned;
ALTER TABLE public.daily_stats        DROP COLUMN IF EXISTS xp_earned;
ALTER TABLE public.lessons            DROP COLUMN IF EXISTS xp_reward;
ALTER TABLE public.daily_challenges   DROP COLUMN IF EXISTS bonus_xp_claimed;

-- ---------------------------------------------------------------------------
-- ROLLBACK — there is none worth writing. The columns held a ledger frozen
-- since migration 120 (three accounts had a non-zero total, none above 200);
-- re-adding them would restore empty columns, not the numbers.
-- ---------------------------------------------------------------------------
