-- 084 — Remove hearts; meter the free tier on new cards per day instead.
--
-- Hearts are gone for the same reason streaks were (083): they metered
-- MISTAKES. In a spaced-repetition app that is backwards — it makes attempting
-- material at the edge of your ability expensive, so learners guess safe and
-- avoid exactly the items worth practising. They were also inert: nothing in
-- the app ever blocked on reaching zero, so "unlimited hearts" was being sold
-- on the paywall as a benefit over a limit that did not exist.
--
-- What replaces them meters ACQUISITION RATE instead: `dailyNewCards`, the
-- number of previously-unseen cards a learner may introduce per day.
--
--   starter (free) ....  5
--   basic ............. 20   (the research-backed default, research.md §5.2)
--   premium / vip ..... 9999 (effectively uncapped)
--
-- Review of already-learned material stays unlimited on every tier, forever,
-- and being wrong costs nothing. The limit is on taking on new material, which
-- is the thing that actually drives future review load — so the gate and the
-- pedagogy point the same way, and the paywall line is true rather than spin.
--
-- SECURITY: `try_consume_new_card_slot` took the cap AS A PARAMETER from the
-- client, bounded only to 1..100. A patched client could therefore hand itself
-- 100 new cards a day and the gate was decorative. The cap is now derived
-- server-side from `get_effective_limits(auth.uid())`, and the old signature is
-- dropped so nothing can keep calling it.

-- ─── 1. Effective limits: hearts out, dailyNewCards in ───────────────────
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
  -- The period bound (083) makes entitlement fail closed when a renewal
  -- webhook is missed, rather than granting the tier indefinitely.
  SELECT COALESCE(s.tier, 'free') INTO personal_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.is_active = TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":30,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":20,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":10,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"audiobookNarration":false,"offlineMode":false}'::jsonb
    -- 'free' / 'starter' / anything unrecognised: no AI, and the small
    -- new-card allowance. Note this is NOT zero — a free account must stay a
    -- usable product, just a slower one.
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    -- COALESCE, not a bare cast: contracts written before this migration have
    -- no dailyNewCards key, and a classroom must never lower a learner's
    -- personal allowance.
    'dailyNewCards', GREATEST(
      (personal_limits->>'dailyNewCards')::int,
      COALESCE((school_config->>'dailyNewCards')::int, 0)
    ),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;

-- ─── 2. New-card gate, with the cap derived server-side ──────────────────
CREATE OR REPLACE FUNCTION public.try_consume_new_card_slot()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_cap int;
  v_consumed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- The caller does not get a say. This is the whole point of the rewrite:
  -- the previous signature accepted the cap as an argument, so the tier that
  -- decides how much the free plan is worth was being asserted by the client.
  v_cap := COALESCE((public.get_effective_limits(v_uid) ->> 'dailyNewCards')::int, 5);

  v_today := public.fluenci_user_today(v_uid);

  INSERT INTO public.daily_stats (user_id, date)
  VALUES (v_uid, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Single check-and-increment so two concurrent sessions cannot both pass a
  -- separate read-then-write check.
  UPDATE public.daily_stats d
     SET cards_learned = COALESCE(d.cards_learned, 0) + 1
   WHERE d.user_id = v_uid AND d.date = v_today
     AND COALESCE(d.cards_learned, 0) < v_cap
  RETURNING true INTO v_consumed;

  RETURN COALESCE(v_consumed, false);
END;
$function$;

-- Read-only companion so the UI can say "3 of 5 today" without consuming one.
CREATE OR REPLACE FUNCTION public.new_card_allowance()
RETURNS TABLE(used integer, cap integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(v_uid);

  RETURN QUERY
  SELECT COALESCE((SELECT d.cards_learned FROM public.daily_stats d
                    WHERE d.user_id = v_uid AND d.date = v_today), 0)::int,
         COALESCE((public.get_effective_limits(v_uid) ->> 'dailyNewCards')::int, 5);
END;
$function$;

-- The client-supplied-cap version must go, or it stays callable.
DROP FUNCTION IF EXISTS public.try_consume_new_card_slot(integer);

-- ─── 3. Retire the hearts RPCs ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.spend_heart();
DROP FUNCTION IF EXISTS public.sync_hearts();

-- ─── 4. Gamification guard: hearts out ───────────────────────────────────
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
    NEW.free_avatar_used_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.total_xp            IS DISTINCT FROM OLD.total_xp
     OR NEW.xp_level         IS DISTINCT FROM OLD.xp_level
     OR NEW.league_tier      IS DISTINCT FROM OLD.league_tier
     -- Economic: gates a paid image generation (083).
     OR NEW.free_avatar_used_at IS DISTINCT FROM OLD.free_avatar_used_at
  THEN
    RAISE EXCEPTION 'gamification columns are server-managed; use the RPCs (increment_xp, increment_xp_idempotent)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── 5. Drop the hearts schema ───────────────────────────────────────────
-- `cards_learned` on daily_stats is deliberately KEPT — it is now the counter
-- the free tier is metered on, not a vanity stat.
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS hearts,
  DROP COLUMN IF EXISTS max_hearts,
  DROP COLUMN IF EXISTS last_heart_lost_at;

-- Existing contracts carry a now-meaningless unlimitedHearts key.
UPDATE public.organizations
   SET contract_config = contract_config - 'unlimitedHearts'
 WHERE contract_config ? 'unlimitedHearts';
