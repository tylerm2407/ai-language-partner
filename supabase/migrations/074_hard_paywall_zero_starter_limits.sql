-- 074 — hard paywall (design 7c): an unsubscribed user gets no AI allowance.
--
-- Before this migration the ELSE branch of get_effective_limits handed every
-- non-subscriber the old free-tier quotas (5 voice minutes, 10 messages,
-- 1 writing grade, 2 pronunciation scores). The 7c paywall removes the free
-- tier, so that branch now returns zeros and matches:
--   - lib/plans.ts                          PLANS.starter
--   - supabase/functions/_shared/plan-limits.ts  PLAN_LIMITS.starter
--
-- Server and client must agree. A client that thinks the gate is closed while
-- this function still grants quota is the same class of bug as migration 057.
--
-- Classroom students are deliberately unaffected: the school branch below
-- merges org contract_config with GREATEST(), so a 0 personal quota still
-- resolves to the school's allowance. That is what keeps the B2B pilots
-- working behind a consumer hard paywall.

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
  WHERE s.user_id = p_user_id AND s.is_active = TRUE
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":30,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":20,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":10,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":false,"offlineMode":false}'::jsonb
    -- 'free' / 'starter' / anything unrecognised: no subscription, no AI.
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"unlimitedHearts":false,"streakShield":false,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    'streakShield', COALESCE((personal_limits->>'streakShield')::boolean, false) OR COALESCE((school_config->>'streakShield')::boolean, false),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;
