-- 083 — Remove the streak feature; close two launch-blocking gaps.
--
-- Three changes land together because they rewrite the same objects and
-- splitting them would mean rewriting each function twice.
--
-- 1. STREAKS ARE GONE. The feature never worked: `update_streak` was awaited
--    unguarded inside `upsertDailyStats`, so a rejection killed the caller
--    after the stats row had already committed, and the lesson screen swallowed
--    it into a console.error. Every profile in production carried
--    streak = 0 / streak_updated_on = NULL as a result. Rather than repair a
--    guilt mechanic the product is now positioned against, it is removed.
--
-- 2. `fluenci_guard_gamification` gains `free_avatar_used_at`. user_profiles
--    has an own-row UPDATE policy, so the trigger is the only thing standing
--    between a client and any column it does not name. `free_avatar_used_at`
--    was not named, so `PATCH {"free_avatar_used_at": null}` re-opened the free
--    paid-image generation, repeatably. (`adult_mode` is deliberately NOT added:
--    it is a display preference the learner toggles in Settings.)
--
-- 3. `get_effective_limits` now checks `current_period_end`. It matched on
--    `is_active = TRUE` alone, so an expired subscription kept its full grant
--    forever — production had a VIP row whose period ended 2026-04-30 still
--    serving 75 messages/day four months later. Entitlement now fails closed,
--    which also bounds the damage from any missed or out-of-order webhook to a
--    single billing period.

-- ─── 1. Retire the streak RPCs ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_streak();
DROP FUNCTION IF EXISTS public.repair_streak_with_freeze();
DROP FUNCTION IF EXISTS public.repair_streak_with_shield();

-- ─── 2. Gamification guard: drop streak columns, add free_avatar_used_at ──
CREATE OR REPLACE FUNCTION public.fluenci_guard_gamification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('fluenci.gamification_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.total_xp := 0;
    NEW.xp_level := 1;
    NEW.league_tier := 'bronze';
    NEW.hearts := 5;
    NEW.max_hearts := 5;
    NEW.last_heart_lost_at := NULL;
    -- A new account has not spent its free avatar generation.
    NEW.free_avatar_used_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.total_xp            IS DISTINCT FROM OLD.total_xp
     OR NEW.xp_level         IS DISTINCT FROM OLD.xp_level
     OR NEW.hearts           IS DISTINCT FROM OLD.hearts
     OR NEW.max_hearts       IS DISTINCT FROM OLD.max_hearts
     OR NEW.last_heart_lost_at IS DISTINCT FROM OLD.last_heart_lost_at
     OR NEW.league_tier      IS DISTINCT FROM OLD.league_tier
     -- Economic: gates a paid image generation. Server-owned, like the rest.
     OR NEW.free_avatar_used_at IS DISTINCT FROM OLD.free_avatar_used_at
  THEN
    RAISE EXCEPTION 'gamification columns are server-managed; use the RPCs (increment_xp, spend_heart, sync_hearts)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── 3. Challenge guard: drop the challenge_streak carry ─────────────────
CREATE OR REPLACE FUNCTION public.fluenci_guard_challenge_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('fluenci.challenge_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.bonus_xp_claimed := false;
    RETURN NEW;
  END IF;

  NEW.bonus_xp_claimed := OLD.bonus_xp_claimed;
  RETURN NEW;
END;
$function$;

-- ─── 4. Daily-challenge bonus: flat 50 XP, no streak multiplier ──────────
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
  v_bonus int := 50;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(v_uid);

  PERFORM set_config('fluenci.challenge_write', '1', true);

  SELECT c.challenges, c.bonus_xp_claimed
    INTO v_challenges, v_claimed
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

  UPDATE public.daily_challenges c
     SET bonus_xp_claimed = true,
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

-- ─── 5. Effective limits: expiry check + streakShield removed ────────────
CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  personal_tier TEXT;
  personal_limits JSONB;
  school_config JSONB;
  result JSONB;
BEGIN
  -- `is_active` alone was the whole test, so a lapsed row kept its grant until
  -- some webhook happened to flip the flag. The period bound makes expiry the
  -- default rather than something that has to be delivered successfully.
  -- NULL current_period_end is treated as non-expiring (school/manual grants).
  SELECT COALESCE(s.tier, 'free') INTO personal_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.is_active = TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":30,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"unlimitedHearts":true,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":20,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"unlimitedHearts":true,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":10,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"unlimitedHearts":true,"audiobookNarration":false,"offlineMode":false}'::jsonb
    -- 'free' / 'starter' / anything unrecognised: no subscription, no AI.
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"unlimitedHearts":false,"audiobookNarration":false,"offlineMode":false}'::jsonb
  END;

  SELECT o.contract_config INTO school_config
  FROM public.classroom_enrollments ce
  JOIN public.classrooms c ON c.id = ce.classroom_id
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE ce.student_id = p_user_id
    AND ce.dropped_at IS NULL
    AND o.is_active = TRUE
    AND (o.contract_end IS NULL OR o.contract_end >= CURRENT_DATE)
  ORDER BY (o.contract_config->>'dailyVoiceMinutes')::int DESC
  LIMIT 1;

  IF school_config IS NULL THEN
    RETURN personal_limits;
  END IF;

  result := jsonb_build_object(
    'dailyVoiceMinutes', GREATEST((personal_limits->>'dailyVoiceMinutes')::int, (school_config->>'dailyVoiceMinutes')::int),
    'dailyTextMessages', GREATEST((personal_limits->>'dailyTextMessages')::int, (school_config->>'dailyTextMessages')::int),
    'dailyWritingGrades', GREATEST((personal_limits->>'dailyWritingGrades')::int, (school_config->>'dailyWritingGrades')::int),
    'dailyPronunciationScores', GREATEST((personal_limits->>'dailyPronunciationScores')::int, (school_config->>'dailyPronunciationScores')::int),
    'unlimitedHearts', COALESCE((personal_limits->>'unlimitedHearts')::boolean, false) OR COALESCE((school_config->>'unlimitedHearts')::boolean, false),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;

-- ─── 6. Drop the streak schema ───────────────────────────────────────────
-- Safe: every row in production held streak = 0 / longest_streak = 0 /
-- streak_updated_on = NULL, so there is no learner history to lose.
DROP TABLE IF EXISTS public.streak_events;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS streak,
  DROP COLUMN IF EXISTS longest_streak,
  DROP COLUMN IF EXISTS streak_freezes,
  DROP COLUMN IF EXISTS streak_shield_active,
  DROP COLUMN IF EXISTS streak_shield_used_at,
  DROP COLUMN IF EXISTS streak_updated_on;

ALTER TABLE public.daily_challenges
  DROP COLUMN IF EXISTS challenge_streak;

-- Existing organizations keep a now-meaningless streakShield key in their
-- contract_config JSON. Strip it so the column matches SchoolContractConfig.
UPDATE public.organizations
   SET contract_config = contract_config - 'streakShield'
 WHERE contract_config ? 'streakShield';
