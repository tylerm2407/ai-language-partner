-- ═══════════════════════════════════════════════════════════════
-- 044: User-timezone day boundaries + atomic new-card slot
--
-- Streak / daily-challenge / quota RPCs used CURRENT_DATE — the server
-- (UTC) day — so a 9 PM practice in New York was recorded against
-- tomorrow and streaks misbehaved near midnight for any non-UTC user.
-- user_profiles.timezone (migration 001) existed but nothing read it.
--
--  • fluenci_user_today(p_uid) resolves "today" in the user's stored
--    timezone, falling back to UTC on a bad/unknown tz name.
--  • update_streak / repair_streak_with_freeze / repair_streak_with_shield
--    (latest bodies: migration 036), claim_daily_challenge_bonus (043)
--    and consume_daily_quota (037) are recreated with every CURRENT_DATE
--    replaced by the user-local day. Nothing else about them changes.
--  • try_consume_new_card_slot() closes the read-then-write race in the
--    client's canIntroduceNewCard() / incrementNewCardsToday() pair with
--    a single atomic check-and-increment on daily_stats.cards_learned.
--
-- The client mirrors this by keying daily_stats / daily_challenges with
-- the DEVICE-local date (lib/dates.ts localToday()) and one-shot-syncing
-- user_profiles.timezone to the device tz (hooks/useProfile.ts).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. "Today" in the user's timezone ──
CREATE OR REPLACE FUNCTION public.fluenci_user_today(p_uid uuid)
RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz text;
BEGIN
  SELECT p.timezone INTO v_tz
    FROM public.user_profiles p
   WHERE p.user_id = p_uid;

  BEGIN
    RETURN (now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::date;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid tz name stored on the profile — degrade to UTC rather than
    -- failing every streak/challenge/quota RPC for this user.
    RETURN (now() AT TIME ZONE 'UTC')::date;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.fluenci_user_today(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fluenci_user_today(uuid) TO authenticated;
-- Edge functions (service role) resolve the user's day for daily_usage reads.
GRANT EXECUTE ON FUNCTION public.fluenci_user_today(uuid) TO service_role;

-- ── 2. update_streak — body from 036 with CURRENT_DATE → user-local day ──
CREATE OR REPLACE FUNCTION public.update_streak()
RETURNS TABLE(streak integer, longest_streak integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.fluenci_user_today(v_uid);
  v_row record;
  v_active boolean;
  v_new int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.streak, p.longest_streak, p.streak_updated_on
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_stats d
     WHERE d.user_id = v_uid AND d.date = v_today
       AND (d.lessons_completed > 0 OR d.cards_reviewed > 0 OR d.passages_read > 0
            OR d.words_written > 0 OR d.minutes_practiced > 0 OR d.xp_earned > 0)
  ) INTO v_active;

  -- Idempotent per day; no activity today → no change.
  IF NOT v_active OR v_row.streak_updated_on = v_today THEN
    RETURN QUERY SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
    RETURN;
  END IF;

  IF v_row.streak_updated_on = v_today - 1 THEN
    v_new := v_row.streak + 1;
  ELSE
    -- No marker from yesterday: derive consecutive active days ending today.
    SELECT count(*)::int INTO v_new FROM (
      SELECT d.date, row_number() OVER (ORDER BY d.date DESC) AS rn
        FROM public.daily_stats d
       WHERE d.user_id = v_uid AND d.date <= v_today
         AND (d.lessons_completed > 0 OR d.cards_reviewed > 0 OR d.passages_read > 0
              OR d.words_written > 0 OR d.minutes_practiced > 0 OR d.xp_earned > 0)
    ) t
    WHERE t.date = v_today - (t.rn - 1);
    v_new := GREATEST(v_new, 1);
  END IF;

  UPDATE public.user_profiles p
     SET streak = v_new,
         longest_streak = GREATEST(p.longest_streak, v_new),
         streak_updated_on = v_today,
         updated_at = now()
   WHERE p.user_id = v_uid;

  RETURN QUERY SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.update_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_streak() TO authenticated;

-- ── 3. repair_streak_with_freeze — body from 036, user-local day ──
CREATE OR REPLACE FUNCTION public.repair_streak_with_freeze()
RETURNS TABLE(streak integer, longest_streak integer, streak_freezes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.fluenci_user_today(v_uid);
  v_row record;
  v_restored int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.streak_freezes, p.longest_streak
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_row.streak_freezes, 0) <= 0 THEN
    RAISE EXCEPTION 'no streak freezes available' USING ERRCODE = '22023';
  END IF;

  v_restored := GREATEST(v_row.longest_streak, 1);

  UPDATE public.user_profiles p
     SET streak_freezes = p.streak_freezes - 1,
         streak = v_restored,
         streak_updated_on = v_today - 1,
         updated_at = now()
   WHERE p.user_id = v_uid;

  INSERT INTO public.streak_events (user_id, event_type, streak_at_time)
  VALUES (v_uid, 'freeze_used', v_restored);

  RETURN QUERY
    SELECT p.streak, p.longest_streak, p.streak_freezes
      FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_streak_with_freeze() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_streak_with_freeze() TO authenticated;

-- ── 4. repair_streak_with_shield — body from 036, user-local day ──
CREATE OR REPLACE FUNCTION public.repair_streak_with_shield()
RETURNS TABLE(streak integer, longest_streak integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.fluenci_user_today(v_uid);
  v_tier text;
  v_row record;
  v_restored int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT s.tier INTO v_tier
    FROM public.subscriptions s
   WHERE s.user_id = v_uid AND s.is_active = true;

  IF v_tier IS NULL OR v_tier NOT IN ('basic', 'premium', 'vip') THEN
    RAISE EXCEPTION 'streak shield requires a paid plan' USING ERRCODE = '42501';
  END IF;

  SELECT p.longest_streak, p.streak_shield_used_at
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND OR v_row.streak_shield_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'streak shield already used' USING ERRCODE = '22023';
  END IF;

  v_restored := GREATEST(v_row.longest_streak, 1);

  UPDATE public.user_profiles p
     SET streak = v_restored,
         streak_shield_active = true,
         streak_shield_used_at = v_today,
         streak_updated_on = v_today - 1,
         updated_at = now()
   WHERE p.user_id = v_uid;

  INSERT INTO public.streak_events (user_id, event_type, streak_at_time)
  VALUES (v_uid, 'shield_used', v_restored);

  RETURN QUERY
    SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_streak_with_shield() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_streak_with_shield() TO authenticated;

-- ── 5. claim_daily_challenge_bonus — body from 043, user-local day ──
CREATE OR REPLACE FUNCTION public.claim_daily_challenge_bonus()
RETURNS TABLE(bonus_xp integer, total_xp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.fluenci_user_today(v_uid);
  v_row record;
  v_multiplier numeric;
  v_bonus int;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT c.all_completed, c.bonus_xp_claimed, c.challenge_streak
    INTO v_row
    FROM public.daily_challenges c
   WHERE c.user_id = v_uid AND c.date = v_today
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no daily challenges for today' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(v_row.all_completed, false) THEN
    RAISE EXCEPTION 'daily challenges not all completed' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_row.bonus_xp_claimed, false) THEN
    RAISE EXCEPTION 'bonus already claimed' USING ERRCODE = '22023';
  END IF;

  -- Streak multiplier (mirrors lib/challenges.ts getChallengeMultiplier):
  -- 7+ day streak = 2x, 3+ = 1.5x, else 1x. Hard cap the bonus at 200.
  v_multiplier := CASE
    WHEN COALESCE(v_row.challenge_streak, 0) >= 7 THEN 2.0
    WHEN COALESCE(v_row.challenge_streak, 0) >= 3 THEN 1.5
    ELSE 1.0
  END;
  v_bonus := LEAST(round(50 * v_multiplier)::int, 200);

  UPDATE public.daily_challenges c
     SET bonus_xp_claimed = true,
         challenge_streak = COALESCE(c.challenge_streak, 0) + 1
   WHERE c.user_id = v_uid AND c.date = v_today;

  -- Grant XP the same way increment_xp does internally — the GUC lets
  -- the lockdown trigger (migration 036) accept the write.
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
$$;

REVOKE ALL ON FUNCTION public.claim_daily_challenge_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_challenge_bonus() TO authenticated;

-- ── 6. consume_daily_quota — body from 037, user-local day ──
-- Quota days now roll over at the user's local midnight (matches how the
-- user perceives "today's limit"). Service-role only, as before; the
-- user-local day is resolved from p_user_id, not auth.uid().
CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_limit integer,
  p_amount integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
  v_allowed boolean;
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;
  -- Negative limit means unlimited (still record usage for analytics).
  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format(
      'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = $3',
      p_counter
    ) USING p_user_id, p_amount, v_today;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Atomic check-and-increment: the row lock serializes concurrent calls,
  -- and the WHERE clause refuses the increment once the limit is reached.
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) TO service_role;

-- ── 7. Atomic new-cards-per-day slot ──
-- Replaces the client's canIntroduceNewCard() read + incrementNewCardsToday()
-- write pair, which let two concurrent sessions both pass the cap check.
-- Single UPDATE ... WHERE cards_learned < cap → check and consume in one
-- statement under the row lock. Returns true iff a slot was consumed.
CREATE OR REPLACE FUNCTION public.try_consume_new_card_slot(p_cap integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_consumed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_cap IS NULL OR p_cap < 1 OR p_cap > 100 THEN
    RAISE EXCEPTION 'invalid new-card cap (1-100)' USING ERRCODE = '22023';
  END IF;

  v_today := public.fluenci_user_today(v_uid);

  INSERT INTO public.daily_stats (user_id, date)
  VALUES (v_uid, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_stats d
     SET cards_learned = COALESCE(d.cards_learned, 0) + 1
   WHERE d.user_id = v_uid AND d.date = v_today
     AND COALESCE(d.cards_learned, 0) < p_cap
  RETURNING true INTO v_consumed;

  RETURN COALESCE(v_consumed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_new_card_slot(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_consume_new_card_slot(integer) TO authenticated;

-- ── 8. increment_daily_usage — day resolved server-side (all 3 overloads) ──
-- Prod has THREE deployed overloads (4-arg, 5-arg, 8-arg — verified via
-- pg_get_functiondef 2026-07-04); PostgREST resolves calls by named-arg set,
-- so all three are redefined identically to keep resolution behavior while
-- fixing the day: it is now resolved from the user's timezone INSIDE the
-- function; p_date is kept for signature compatibility but ignored. This
-- makes daily_usage day-keying authoritative in one place — callers (client
-- and edge functions) can no longer split a user's usage across UTC/local
-- rows. Also restores the 031 caller guard the deployed copies had lost:
-- authenticated users may only touch their own row; service-role calls
-- (auth.uid() IS NULL → the inequality is NULL → no raise) pass through.
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0
) RETURNS TABLE(text_messages INT, voice_minutes REAL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage';
  END IF;

  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes)
  VALUES (p_user_id, v_date, p_text_messages, p_voice_minutes)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes;
  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0
) RETURNS TABLE(text_messages INT, voice_minutes REAL, ai_chat_minutes REAL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage';
  END IF;

  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes, ai_chat_minutes)
  VALUES (p_user_id, v_date, p_text_messages, p_voice_minutes, p_ai_chat_minutes)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    ai_chat_minutes = daily_usage.ai_chat_minutes + EXCLUDED.ai_chat_minutes;
  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes::REAL, du.ai_chat_minutes::REAL
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0,
  p_writing_grades INT DEFAULT 0,
  p_pronunciation_scores INT DEFAULT 0,
  p_stories_generated INT DEFAULT 0
) RETURNS TABLE(
  text_messages INT,
  voice_minutes REAL,
  ai_chat_minutes REAL,
  writing_grades INT,
  pronunciation_scores INT,
  stories_generated INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage';
  END IF;

  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes, ai_chat_minutes, writing_grades, pronunciation_scores, stories_generated)
  VALUES (p_user_id, v_date, p_text_messages, p_voice_minutes, p_ai_chat_minutes, p_writing_grades, p_pronunciation_scores, p_stories_generated)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    ai_chat_minutes = daily_usage.ai_chat_minutes + EXCLUDED.ai_chat_minutes,
    writing_grades = daily_usage.writing_grades + EXCLUDED.writing_grades,
    pronunciation_scores = daily_usage.pronunciation_scores + EXCLUDED.pronunciation_scores,
    stories_generated = daily_usage.stories_generated + EXCLUDED.stories_generated;

  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes::REAL, du.ai_chat_minutes::REAL, du.writing_grades, du.pronunciation_scores, du.stories_generated
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = v_date;
END;
$$;
