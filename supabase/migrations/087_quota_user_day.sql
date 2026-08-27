-- 087 — Bucket quota consumption on the learner's day, not the server's.
--
-- `daily_usage` was being written under TWO different definitions of "today":
--
--   increment_daily_usage  ->  fluenci_user_today(p_user_id)   (learner's tz)
--   consume_daily_quota    ->  CURRENT_DATE                    (server/UTC)
--
-- Same table, same (user_id, date) key, two different keys for the same day.
--
-- For anyone far from UTC this is not cosmetic. A learner at UTC+13 crosses
-- CURRENT_DATE in the early afternoon of their own day: the quota check starts
-- reading a fresh row while the usage writer is still appending to yesterday's,
-- so they are over-served for the rest of the afternoon. Going the other way, a
-- learner at UTC-8 has their allowance still pinned to the previous server day
-- after their own midnight, and a paying subscriber is told they have run out
-- when by their own calendar they have not.
--
-- `fluenci_user_today` resolves the learner's timezone from their profile and
-- falls back to UTC, which is what every other daily counter already uses
-- (daily_stats, the new-card cap, the streak logic before it was removed).

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_limit integer,
  p_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  -- The learner's day. Must match increment_daily_usage exactly, or the two
  -- write to different rows for the same calendar day.
  v_today := public.fluenci_user_today(p_user_id);

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

  -- Single check-and-increment, so two concurrent requests cannot both pass a
  -- separate read-then-write check.
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;
