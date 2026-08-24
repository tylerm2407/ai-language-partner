-- 071_challenge_claim_server_owned.sql
--
-- Closes the daily-challenge XP mint: claim_daily_challenge_bonus() trusted
-- three client-writable columns on daily_challenges. Resetting bonus_xp_claimed
-- to false and re-calling produced unbounded XP (100 per two requests at the
-- 2.0x tier — LEAST(round(50 * 2.0), 200) = 100, not 200).
--
-- Design constraints that shaped this, each learned the hard way:
--
--  1. COERCE, DO NOT RAISE. The migration and a client release cannot ship
--     atomically. A raising trigger or a column-level REVOKE breaks every
--     already-installed client the instant it lands, and the hook swallows the
--     error into a permanently empty card. Silently ignoring the client's
--     values lets the shipped app keep working unchanged.
--
--  2. DERIVE the streak carry on INSERT, never zero it. The client computes it
--     from yesterday's row (useDailyChallenges.ts:39-48). Coercing to the
--     column default would cap every user at 1x forever and silently reinstate
--     a bug the code comments record as already having been fixed once.
--
--  3. A SEPARATE GUC, set FIRST. claim_daily_challenge_bonus() called
--     set_config('fluenci.gamification_write') AFTER its daily_challenges
--     UPDATE. Reusing that GUC would make the RPC's own write fail its own
--     guard — for every user, on the first request. auth.uid() does not save
--     you: SECURITY DEFINER changes the privilege check, not the session GUC.
--
--  4. REPLACE the all_completed gate, do not AND it. That column is written
--     fire-and-forget (`.catch(console.error)`), so it is legitimately stale
--     for anyone whose last progress write failed. Keeping both gates would
--     refuse genuinely qualified users with no recourse until tomorrow.
--
--  5. Do NOT port pickDailyChallenges() to SQL. Its JS hashCode relies on
--     int32 wraparound; a subtly different port would make the server pick
--     different challenges than the UI shows — worse than the bug being fixed.
--     Validating POOL MEMBERSHIP is sufficient: choosing the three easiest
--     legitimate templates is not an exploit, it still requires the stats.

-- ---------------------------------------------------------------------------
-- 1 · Clamp upsert_daily_stats
--
-- Migration 070 revoked direct client writes to daily_stats, but the RPC it
-- pointed at as "the legitimate path" validates identity and nothing else, and
-- is additive with EXECUTE granted to authenticated. One call with
-- p_cards_reviewed = 999999 satisfies any challenge in the pool — so deriving
-- completion from daily_stats without this clamp just moves the trust boundary
-- one hop onto a surface that is equally open.
--
-- Scope note: v_today is forced from fluenci_user_today() inside the function,
-- so only TODAY's row was ever writable. The historical backfill that 070
-- closed stays closed; this closes single-day magnitude.
--
-- Caps are deliberately far above any real session so no legitimate user is
-- affected. Adjust if a power user ever legitimately trips one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_daily_stats(
  p_user_id uuid,
  p_lessons_completed integer DEFAULT 0,
  p_cards_reviewed integer DEFAULT 0,
  p_cards_learned integer DEFAULT 0,
  p_minutes_practiced real DEFAULT 0,
  p_speaking_minutes real DEFAULT 0,
  p_listening_minutes real DEFAULT 0,
  p_reading_minutes real DEFAULT 0,
  p_writing_minutes real DEFAULT 0,
  p_xp_earned integer DEFAULT 0,
  p_accuracy real DEFAULT NULL::real
)
RETURNS SETOF public.daily_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s stats'
      USING ERRCODE = '42501';
  END IF;

  -- Per-call plausibility clamps. Negatives are floored at 0 so a delta can
  -- never be used to walk a counter backwards either.
  p_lessons_completed := GREATEST(0, LEAST(COALESCE(p_lessons_completed, 0), 100));
  p_cards_reviewed    := GREATEST(0, LEAST(COALESCE(p_cards_reviewed, 0), 2000));
  p_cards_learned     := GREATEST(0, LEAST(COALESCE(p_cards_learned, 0), 500));
  p_minutes_practiced := GREATEST(0, LEAST(COALESCE(p_minutes_practiced, 0), 1440));
  p_speaking_minutes  := GREATEST(0, LEAST(COALESCE(p_speaking_minutes, 0), 1440));
  p_listening_minutes := GREATEST(0, LEAST(COALESCE(p_listening_minutes, 0), 1440));
  p_reading_minutes   := GREATEST(0, LEAST(COALESCE(p_reading_minutes, 0), 1440));
  p_writing_minutes   := GREATEST(0, LEAST(COALESCE(p_writing_minutes, 0), 1440));
  p_xp_earned         := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), 10000));

  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_stats
    (user_id, date, lessons_completed, cards_reviewed, cards_learned,
     minutes_practiced, speaking_minutes, listening_minutes,
     reading_minutes, writing_minutes, xp_earned, accuracy)
  VALUES
    (p_user_id, v_today, p_lessons_completed, p_cards_reviewed, p_cards_learned,
     p_minutes_practiced, p_speaking_minutes, p_listening_minutes,
     p_reading_minutes, p_writing_minutes, p_xp_earned, COALESCE(p_accuracy, 0))
  ON CONFLICT (user_id, date) DO UPDATE SET
    lessons_completed = daily_stats.lessons_completed + EXCLUDED.lessons_completed,
    cards_reviewed    = daily_stats.cards_reviewed + EXCLUDED.cards_reviewed,
    cards_learned     = daily_stats.cards_learned + EXCLUDED.cards_learned,
    minutes_practiced = daily_stats.minutes_practiced + EXCLUDED.minutes_practiced,
    speaking_minutes  = daily_stats.speaking_minutes + EXCLUDED.speaking_minutes,
    listening_minutes = daily_stats.listening_minutes + EXCLUDED.listening_minutes,
    reading_minutes   = daily_stats.reading_minutes + EXCLUDED.reading_minutes,
    writing_minutes   = daily_stats.writing_minutes + EXCLUDED.writing_minutes,
    xp_earned         = daily_stats.xp_earned + EXCLUDED.xp_earned,
    accuracy          = COALESCE(p_accuracy, daily_stats.accuracy);

  RETURN QUERY
    SELECT * FROM public.daily_stats d
     WHERE d.user_id = p_user_id AND d.date = v_today;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2 · Canonical challenge pool
--
-- Mirrors CHALLENGE_POOL in lib/challenges.ts. Only the three fields that
-- carry authority are here — title/icon/colour/unit are presentation and the
-- client may render them however it likes.
--
-- lib/challenges.test.ts asserts the TS pool against these exact triples, so
-- editing one without the other fails the suite rather than silently drifting.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fluenci_challenge_pool()
RETURNS TABLE (challenge_type text, target numeric, stat_key text)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('complete_lessons',    2::numeric,   'lessonsCompleted'),
    ('complete_lessons_3',  3::numeric,   'lessonsCompleted'),
    ('review_cards',        10::numeric,  'cardsReviewed'),
    ('review_cards_20',     20::numeric,  'cardsReviewed'),
    ('practice_minutes',    10::numeric,  'minutesPracticed'),
    ('practice_minutes_20', 20::numeric,  'minutesPracticed'),
    ('speaking_exercise',   5::numeric,   'speakingMinutes'),
    ('listening_minutes',   5::numeric,   'listeningMinutes'),
    ('xp_target',           100::numeric, 'xpEarned'),
    ('learn_new_cards',     5::numeric,   'cardsLearned')
  ) AS t(challenge_type, target, stat_key);
$function$;

REVOKE EXECUTE ON FUNCTION public.fluenci_challenge_pool() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 3 · Server-side completion check
--
-- Reads the stored challenges JSONB for its TYPES only, then takes target and
-- stat_key from the canonical pool — so a client submitting {"target": 0} or an
-- invented type gets nothing. Actual progress comes from daily_stats, which
-- clients can no longer write directly (070) and can no longer inflate (§1).
--
-- Returns false rather than raising on any malformed input: the caller turns
-- that into "not all completed", which is the correct, safe answer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fluenci_challenges_all_complete(
  p_uid uuid,
  p_date date,
  p_challenges jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT * INTO v_stats
    FROM public.daily_stats
   WHERE user_id = p_uid AND date = p_date;
  -- No row is fine: every field reads as NULL and COALESCEs to 0 below, so a
  -- user with no activity simply has not completed anything.

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_challenges) LOOP
    SELECT p.challenge_type, p.target, p.stat_key INTO v_pool
      FROM public.fluenci_challenge_pool() p
     WHERE p.challenge_type = (v_item->>'type');

    IF NOT FOUND THEN
      -- Not a pool member. Refuse the whole claim rather than skipping it,
      -- so an injected challenge cannot dilute the requirement.
      RETURN false;
    END IF;

    v_actual := CASE v_pool.stat_key
      WHEN 'lessonsCompleted' THEN COALESCE(v_stats.lessons_completed, 0)::numeric
      WHEN 'cardsReviewed'    THEN COALESCE(v_stats.cards_reviewed, 0)::numeric
      WHEN 'cardsLearned'     THEN COALESCE(v_stats.cards_learned, 0)::numeric
      WHEN 'minutesPracticed' THEN COALESCE(v_stats.minutes_practiced, 0)::numeric
      WHEN 'speakingMinutes'  THEN COALESCE(v_stats.speaking_minutes, 0)::numeric
      WHEN 'listeningMinutes' THEN COALESCE(v_stats.listening_minutes, 0)::numeric
      WHEN 'xpEarned'         THEN COALESCE(v_stats.xp_earned, 0)::numeric
      ELSE NULL
    END;

    IF v_actual IS NULL OR v_actual < v_pool.target THEN
      RETURN false;
    END IF;

    v_seen := v_seen + 1;
  END LOOP;

  RETURN v_seen > 0;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fluenci_challenges_all_complete(uuid, date, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4 · Guard trigger — coercing, not raising
--
-- Mirrors fluenci_guard_gamification (036), including its GUC escape hatch,
-- but coerces on UPDATE instead of raising so an older client keeps working.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fluenci_guard_challenge_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev_streak integer;
  v_prev_claimed boolean;
BEGIN
  -- Server-side callers set this. claim_daily_challenge_bonus() sets it at the
  -- top of the function, before any write to this table.
  IF COALESCE(current_setting('fluenci.challenge_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new day always starts unclaimed, whatever the client sent.
    NEW.bonus_xp_claimed := false;

    -- Derive the carry rather than trusting the client's, and rather than
    -- zeroing it. Keyed on NEW.date - 1, not fluenci_user_today() - 1, so a
    -- user whose device timezone disagrees with their profile timezone does
    -- not silently lose their streak every day.
    SELECT c.challenge_streak, c.bonus_xp_claimed
      INTO v_prev_streak, v_prev_claimed
      FROM public.daily_challenges c
     WHERE c.user_id = NEW.user_id AND c.date = NEW.date - 1;

    NEW.challenge_streak := CASE
      WHEN COALESCE(v_prev_claimed, false) THEN COALESCE(v_prev_streak, 0)
      ELSE 0
    END;

    RETURN NEW;
  END IF;

  -- UPDATE. Claim state is server-owned; ignore whatever the client sent.
  -- Coercing rather than raising means the currently shipped client, which
  -- echoes these columns back on every progress write, keeps working.
  NEW.bonus_xp_claimed := OLD.bonus_xp_claimed;
  NEW.challenge_streak := OLD.challenge_streak;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_guard_challenge_state_trigger ON public.daily_challenges;
CREATE TRIGGER fluenci_guard_challenge_state_trigger
  BEFORE INSERT OR UPDATE ON public.daily_challenges
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_guard_challenge_state();

-- ---------------------------------------------------------------------------
-- 5 · claim_daily_challenge_bonus — server-derived completion
--
-- Changes from the previous body:
--   * sets fluenci.challenge_write FIRST, so its own UPDATE passes the guard
--   * gates on fluenci_challenges_all_complete() instead of the client-written
--     all_completed column (replaced, not ANDed)
--   * writes all_completed = true so the column stays a truthful mirror
-- Unchanged: the FOR UPDATE lock, the double-claim check, the multiplier tiers,
-- and the 200 ceiling (which the 2.0x tier never reaches — 50 * 2.0 = 100).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_challenge_bonus()
RETURNS TABLE(bonus_xp integer, total_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_challenges jsonb;
  v_claimed boolean;
  v_streak integer;
  v_multiplier numeric;
  v_bonus int;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(v_uid);

  -- MUST be before the UPDATE below, or the guard trigger reverts this
  -- function's own write and the claim silently no-ops for every user.
  PERFORM set_config('fluenci.challenge_write', '1', true);

  SELECT c.challenges, c.bonus_xp_claimed, c.challenge_streak
    INTO v_challenges, v_claimed, v_streak
    FROM public.daily_challenges c
   WHERE c.user_id = v_uid AND c.date = v_today
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no daily challenges for today' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_claimed, false) THEN
    RAISE EXCEPTION 'bonus already claimed' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fluenci_challenges_all_complete(v_uid, v_today, v_challenges) THEN
    RAISE EXCEPTION 'daily challenges not all completed' USING ERRCODE = '22023';
  END IF;

  v_multiplier := CASE
    WHEN COALESCE(v_streak, 0) >= 7 THEN 2.0
    WHEN COALESCE(v_streak, 0) >= 3 THEN 1.5
    ELSE 1.0
  END;
  v_bonus := LEAST(round(50 * v_multiplier)::int, 200);

  UPDATE public.daily_challenges c
     SET bonus_xp_claimed = true,
         challenge_streak = COALESCE(c.challenge_streak, 0) + 1,
         all_completed    = true
   WHERE c.user_id = v_uid AND c.date = v_today;

  PERFORM set_config('fluenci.gamification_write', '1', true);

  UPDATE public.user_profiles p
     SET total_xp    = p.total_xp + v_bonus,
         xp_level    = public.fluenci_level_for_xp(p.total_xp + v_bonus),
         league_tier = public.fluenci_league_for_level(public.fluenci_level_for_xp(p.total_xp + v_bonus)),
         updated_at  = now()
   WHERE p.user_id = v_uid
   RETURNING p.total_xp INTO v_new_xp;

  RETURN QUERY SELECT v_bonus, COALESCE(v_new_xp, 0);
END;
$function$;

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
--   DROP TRIGGER IF EXISTS fluenci_guard_challenge_state_trigger ON public.daily_challenges;
--   DROP FUNCTION IF EXISTS public.fluenci_guard_challenge_state();
--   DROP FUNCTION IF EXISTS public.fluenci_challenges_all_complete(uuid, date, jsonb);
--   DROP FUNCTION IF EXISTS public.fluenci_challenge_pool();
--   -- then restore claim_daily_challenge_bonus() and upsert_daily_stats()
--   -- from migrations 044 and 048 respectively.
--
-- Existing rows need no backfill. A user who already claimed today keeps
-- bonus_xp_claimed = true and their incremented streak (the UPDATE branch
-- preserves OLD, it does not recompute). A user who is complete but unclaimed
-- is now judged against daily_stats, which is the same data the client used to
-- decide completion, so the outcome is unchanged for anyone honest.
-- ---------------------------------------------------------------------------
