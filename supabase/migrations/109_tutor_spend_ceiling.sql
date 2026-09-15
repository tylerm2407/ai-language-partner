-- 109 — The live voice tutor, part 3: the per-user monthly spend ceiling.
--
-- The 2026-09-04 cost pass got worst-case margin to +5%/+5%/+7% and recorded
-- that "25% at worst case is NOT reachable by caps" — the only mechanism that
-- guarantees a floor by construction is a per-user monthly spend ceiling, and
-- it was never built. The live tutor is the feature that finally forces it:
-- it is the one thing in the app whose worst case is margin-NEGATIVE, and this
-- column is the entire mitigation.
--
-- Applied to production 2026-09-06.

ALTER TABLE public.monthly_usage
  ADD COLUMN IF NOT EXISTS tutor_cents integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.monthly_usage.tutor_cents IS
  'Estimated cents of OpenAI Realtime spend RESERVED for live tutor sessions '
  'this month. Derived from server-measured wall-clock seconds times '
  '_shared/tutor-pricing.ts TUTOR_CENTS_PER_MINUTE, and deliberately NOT from '
  'provider-reported token counts: those reach us only via the client, which '
  'is untrusted, and a ceiling a client can under-report is not a ceiling.';

-- ─── consume_monthly_quota / refund_monthly_quota ────────────────────────
--
-- Bodies copied verbatim from the LIVE definitions (pg_get_functiondef,
-- 2026-09-06). Both currently hard-code a single-element whitelist, and
-- CREATE OR REPLACE cannot patch one line, so the whole body is restated.

CREATE OR REPLACE FUNCTION public.consume_monthly_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_month date;
BEGIN
  IF p_counter NOT IN ('avatars_generated','tutor_cents') THEN
    RAISE EXCEPTION 'invalid monthly quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  v_month := public.fluenci_user_month(p_user_id);

  INSERT INTO public.monthly_usage (user_id, month) VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- Single atomic check-and-increment, so concurrent taps cannot both pass.
  EXECUTE format(
    'UPDATE public.monthly_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND month = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true', p_counter)
  USING p_user_id, p_limit, p_amount, v_month INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_monthly_quota(
  p_user_id uuid, p_counter text, p_amount integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := public.fluenci_user_month(p_user_id);
BEGIN
  IF p_counter NOT IN ('avatars_generated','tutor_cents') THEN
    RAISE EXCEPTION 'invalid monthly quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  EXECUTE format(
    'UPDATE public.monthly_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND month = $3', p_counter)
  USING p_user_id, p_amount, v_month;
END;
$function$;

-- ─── get_effective_limits — two new keys ─────────────────────────────────
--
-- Body copied verbatim from the LIVE definition and extended. Two things about
-- this function that have bitten before and would bite again:
--
-- 1. The four ORIGINAL merge entries (dailyVoiceMinutes, dailyTextMessages,
--    dailyWritingGrades, dailyPronunciationScores) use a BARE ::int on
--    school_config. Every key added since uses COALESCE(..., 0), and it must:
--    no existing organizations.contract_config carries the tutor keys, and a
--    bare cast of a missing key yields NULL, which makes GREATEST return NULL
--    and silently drops every classroom student's tutor allowance to nothing.
--
-- 2. The tier key for the free plan is 'free' (the ELSE branch), not 'starter'.
--    The TypeScript PlanTier calls it 'starter'. They are the same tier.
--
-- dailyTutorMinutes stops one bad day; monthlyTutorCents is the margin floor.
-- At TUTOR_CENTS_PER_MINUTE = 12 the monthly ceilings resolve to roughly
-- 25 / 66 / 116 minutes per month for basic / premium / vip. THE MONTHLY
-- CEILING IS THE REAL LIMIT — the daily cap only shapes how it is spent, so
-- the number the plans are sold on is the monthly one.

CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  personal_tier TEXT; personal_limits JSONB; school_config JSONB; result JSONB;
BEGIN
  SELECT COALESCE(s.tier,'free') INTO personal_tier FROM public.subscriptions s
  WHERE s.user_id=p_user_id AND s.is_active=TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now()) LIMIT 1;
  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":150,"dailyTranslations":90,"dailyWordLookups":800,"dailyChatCards":50,"dailyGoalTracks":1,"dailyAudiobookChapters":5,"monthlyAvatarGenerations":3,"dailyTutorMinutes":45,"monthlyTutorCents":1400,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"dailyWordLookups":600,"dailyChatCards":30,"dailyGoalTracks":1,"dailyAudiobookChapters":3,"monthlyAvatarGenerations":3,"dailyTutorMinutes":30,"monthlyTutorCents":800,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":20,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"dailyWordLookups":300,"dailyChatCards":15,"dailyGoalTracks":1,"dailyAudiobookChapters":0,"monthlyAvatarGenerations":3,"dailyTutorMinutes":15,"monthlyTutorCents":300,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"dailyWordLookups":60,"dailyChatCards":3,"dailyGoalTracks":1,"dailyAudiobookChapters":0,"monthlyAvatarGenerations":0,"dailyTutorMinutes":0,"monthlyTutorCents":0,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean,false) OR COALESCE((school_config->>'audiobookNarration')::boolean,false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean,false) OR COALESCE((school_config->>'offlineMode')::boolean,false)
  );
  RETURN result;
END;
$function$;
