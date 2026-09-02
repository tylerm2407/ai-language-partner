-- 102 — Audiobook narration starts at Premium, not VIP.
--
-- `get_effective_limits` had `audiobookNarration` true only for vip. The
-- Phase 2 decision is Premium and up, and the feature only became real with
-- migration 101 — until now the flag gated a VIP "narration" toggle that was
-- expo-speech reading the screen aloud in the device voice, not narration.
--
-- Only TWO copies carry this flag, not the usual three: `_shared/plan-limits.ts`
-- never mirrored `audiobookNarration` — it reads the RPC's other keys and
-- ignores this one — so the enforcing copies are the CASE below and the
-- `audiobook` function's own `get_effective_limits` check. `lib/plans.ts` is
-- the display copy and moves in the same commit.
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
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":9999,"dailyTranslations":90,"dailyWordLookups":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"dailyWordLookups":600,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"dailyWordLookups":300,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"dailyWordLookups":60,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    'dailyNewCards', GREATEST((personal_limits->>'dailyNewCards')::int, COALESCE((school_config->>'dailyNewCards')::int, 0)),
    'dailyHints', GREATEST((personal_limits->>'dailyHints')::int, COALESCE((school_config->>'dailyHints')::int, 0)),
    'dailyTranslations', GREATEST((personal_limits->>'dailyTranslations')::int, COALESCE((school_config->>'dailyTranslations')::int, 0)),
    'dailyWordLookups', GREATEST((personal_limits->>'dailyWordLookups')::int, COALESCE((school_config->>'dailyWordLookups')::int, 0)),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;
