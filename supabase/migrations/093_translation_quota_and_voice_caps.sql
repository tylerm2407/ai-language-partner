-- 093 — Meter translation, and price voice minutes against what voice costs.
--
-- Both come out of costing the whole system against vendor prices on
-- 2026-08-31 (see the unit-economics report). Two separate problems.
--
-- 1. `translate` IS THE ONLY PAID PATH WITH NO DAILY CEILING.
--
-- It authenticates, caps input at 1500 chars, caps output at 300 tokens,
-- caches aggressively, and burst-limits at 30/60s — but it consumes no daily
-- quota, because `consume_daily_quota`'s counter list is a hardcoded
-- whitelist and nobody added one. The burst limit alone permits ~43,000
-- calls a day. On text the cache cannot absorb (a learner pasting or
-- long-tail phrases) that is real money from a single account, and it is the
-- one AI feature a free-tier user can reach without limit.
--
-- The cache means the realistic cost is a fraction of the cap. The cap exists
-- for the account that is not behaving realistically.
--
-- 2. VOICE MINUTES WERE PRICED BEFORE ANYONE PRICED VOICE.
--
-- After the 2026-08-31 cuts to image quality, chat window and output
-- ceilings, voice became the single largest worst-case cost in the app —
-- $5.09/$10.18/$15.53 per month at basic/premium/vip. `dailyVoiceMinutes`
-- lives here rather than in application code, which is the only reason it was
-- not cut alongside the others.
--
-- The counter is charged twice over: `transcribe` bills real Whisper audio
-- seconds, and `tts` bills a flat 1.0 per synthesis. So one "voice minute" is
-- not one minute of anything — it is one unit of paid audio in either
-- direction. 30/day was never costed; 18 still supports a long daily speaking
-- session.
--
-- Cut 10/20/30 -> 6/12/18. School contract overrides are untouched: the
-- GREATEST() merge below still lets an organization buy back more.

-- ─── Translation counter ─────────────────────────────────────────────────
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS translations integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.translations IS
  'Translations GENERATED today. Charged on cache miss only — a cache hit '
  'costs nothing to serve, so billing it would penalise re-reading a passage '
  'while ignoring the long-tail text that actually spends money.';

-- ─── Whitelist the new counter ───────────────────────────────────────────
-- Body is otherwise byte-identical to the live function; only the IN list
-- changes. Re-stating it in full because CREATE OR REPLACE has no way to
-- patch a single line, and a drifted copy here would be worse than none.
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
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays', 'hints_generated', 'translations') THEN
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

-- ─── Voice caps down, translation cap added ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":9999,"dailyTranslations":90,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    -- COALESCE, not a bare cast: no existing contract_config carries this key,
    -- so a bare cast would make every school student's translation limit NULL.
    'dailyTranslations', GREATEST(
      (personal_limits->>'dailyTranslations')::int,
      COALESCE((school_config->>'dailyTranslations')::int, 0)
    ),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;
