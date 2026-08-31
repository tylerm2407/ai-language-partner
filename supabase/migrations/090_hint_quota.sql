-- 090 — Meter hints.
--
-- `get-hint` was the last AI path with no daily quota at all: any signed-in
-- user, on any tier, could call it as fast as the 30/60s burst limit allowed,
-- forever. That was survivable only because every hint was served from
-- `hint_cache`, keyed on (card_id, exercise_type), so the curriculum capped the
-- real spend no matter how many people asked.
--
-- The learner-context work broke that assumption. A personalized hint cannot be
-- written to a cache keyed without a user dimension — it would be handed to
-- every other learner on that card, which is both wrong and a privacy leak — so
-- entitled learners now skip the cache in both directions and pay a live model
-- call every time. An uncapped live call needs a meter.
--
-- The ladder is 5 / 30 / 75 / unlimited. Free users are deliberately still
-- served: they get generic, cached hints that cost essentially nothing, so
-- their 5 is a product decision rather than a cost one, and a learner who is
-- stuck is the last person to cut off. `vip` uses 9999 as the unlimited
-- sentinel, matching `dailyNewCards` rather than introducing a second shape
-- for "no limit" that every comparison site would have to learn.
--
-- Burst limits are unchanged and remain the real protection against a runaway
-- client; this is a daily budget, not a rate limit.

-- ─── The counter ─────────────────────────────────────────────────────────
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS hints_generated integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.hints_generated IS
  'Hints served by the get-hint edge function today. Counts cache misses and '
  'personalized (deliberately uncached) hints alike: the learner spent one of '
  'their allowance either way, which keeps the number the user sees honest.';

-- ─── Allow the new counter ───────────────────────────────────────────────
-- Unchanged from migration 087 except for 'hints_generated' in the whitelist.
-- The whitelist exists because the counter name is interpolated into dynamic
-- SQL below; it is the thing standing between a caller and arbitrary column
-- writes on daily_usage.
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
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays', 'hints_generated') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

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

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

-- ─── Publish the limit ───────────────────────────────────────────────────
-- Unchanged from migration 084 except for 'dailyHints'. As with every other
-- key, a school contract can only ever RAISE the limit (GREATEST), never lower
-- one — a paid learner in a stingy classroom keeps what they paid for. COALESCE
-- on the school side because existing contract_config rows predate this key.
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
  SELECT COALESCE(s.tier, 'free') INTO personal_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.is_active = TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":30,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":20,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":10,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    'dailyNewCards', GREATEST(
      (personal_limits->>'dailyNewCards')::int,
      COALESCE((school_config->>'dailyNewCards')::int, 0)
    ),
    'dailyHints', GREATEST(
      (personal_limits->>'dailyHints')::int,
      COALESCE((school_config->>'dailyHints')::int, 0)
    ),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;

-- ─── Let a failed hint be refunded ───────────────────────────────────────
-- `refund_daily_quota` carries its own whitelist, and it was narrower than
-- `consume_daily_quota`'s. Without this, get-hint could take one of a free
-- user's five and then fail to generate, with no way to give it back — which
-- matters most for exactly the tier that has the fewest to spend.
CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'hints_generated') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  -- No row for that user+day → 0 rows updated → no-op (nothing to refund).
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND date = $3',
    p_counter
  ) USING p_user_id, p_amount, v_today;
END;
$function$;
