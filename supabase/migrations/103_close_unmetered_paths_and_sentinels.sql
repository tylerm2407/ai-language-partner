-- 103 — Meter the last two unmetered paid paths, and retire the 9999
-- sentinels on features that cost money.
--
-- Requirement: it must be IMPOSSIBLE for any tier to exceed its ceiling.
-- Three things violated that.
--
-- 1. `generate-goal-track` calls Anthropic with a 1500- and a 3000-token
--    budget (~$0.023 a run) behind a burst limit and NO daily quota.
-- 2. `audiobook` drives fish TTS over whole chapters with no daily quota. It
--    caches per book and shares across users, so the total is bounded by the
--    catalogue — but the RATE was not bounded at all.
-- 3. `dailyHints` and `dailyWordLookups` were 9999 for vip. Both are paid
--    Anthropic calls, so 9999 is not "unlimited", it is "$210/month and
--    $81/month of exposure with no ceiling". `dailyNewCards: 9999` stays —
--    that one is pure SRS bookkeeping and costs nothing.
--
-- Applied to production 2026-09-02; this file mirrors what was applied.

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS goal_tracks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audiobook_chapters integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.goal_tracks IS
  'Personalised goal-track generations today. ~$0.023 each.';
COMMENT ON COLUMN public.daily_usage.audiobook_chapters IS
  'Book chapters sent for narration today. Cached and shared per book, so this bounds the RATE; the catalogue bounds the total.';

-- (function bodies below are the live definitions, dumped from pg_get_functiondef)

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
BEGIN
  IF p_counter NOT IN ('text_messages','writing_grades','pronunciation_scores','stories_generated','avatars_generated','lesson_tts_plays','hints_generated','translations','word_lookups','chat_cards','goal_tracks','audiobook_chapters') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  v_today := public.fluenci_user_today(p_user_id);

  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format('UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = $3', p_counter)
      USING p_user_id, p_amount, v_today;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true', p_counter)
  USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

-- Refund carries its OWN whitelist, separate from consume's. Keeping the two
-- in sync is manual and has already been missed once (migration 094), so both
-- are re-stated here together.
CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid, p_counter text, p_amount integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages','writing_grades','pronunciation_scores','stories_generated','hints_generated','translations','word_lookups','goal_tracks','audiobook_chapters','lesson_tts_plays') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND date = $3', p_counter)
  USING p_user_id, p_amount, v_today;
END;
$function$;
