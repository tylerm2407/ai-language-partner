-- 117 — Retire client-awarded XP.
--
-- XP, numeric levels and leagues are no longer part of the learner-facing
-- product (091/092), but the legacy RPCs still let any authenticated client
-- choose an amount and mint hidden XP. A per-call cap and idempotency key do
-- not prove that learning occurred. Preserve historical totals for existing
-- profiles, but remove every authenticated award path.
BEGIN;

REVOKE ALL ON FUNCTION public.increment_xp(uuid,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.increment_xp_idempotent(integer,text)
  FROM PUBLIC,anon,authenticated;

-- Compatibility shim for already-installed clients. They still render a
-- claim button after completing the daily three. A successful zero-reward
-- response retires that UI without preserving an XP mint or causing a noisy
-- rollout failure.
CREATE OR REPLACE FUNCTION public.claim_daily_challenge_bonus()
RETURNS TABLE(bonus_xp integer,total_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_total integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  v_today := public.fluenci_user_today(v_uid);
  PERFORM set_config('fluenci.challenge_write','1',true);
  UPDATE public.daily_challenges
     SET bonus_xp_claimed=true,all_completed=true
   WHERE user_id=v_uid AND date=v_today;
  SELECT total_xp INTO v_total FROM public.user_profiles WHERE user_id=v_uid;
  RETURN QUERY SELECT 0,COALESCE(v_total,0);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_daily_challenge_bonus()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_challenge_bonus()
  TO authenticated;

-- Older clients continue to send p_xp_earned through upsert_daily_stats.
-- Coerce that one retired field instead of breaking all useful activity
-- rollups during the client rollout. The stats remain presentation-only and
-- can no longer unlock the retired daily XP reward above.
CREATE FUNCTION public.fluenci_retire_daily_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.xp_earned := 0;
  ELSE
    NEW.xp_earned := OLD.xp_earned;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_retire_daily_xp_trigger ON public.daily_stats;
CREATE TRIGGER fluenci_retire_daily_xp_trigger
  BEFORE INSERT OR UPDATE OF xp_earned ON public.daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_retire_daily_xp();

-- Lesson completions historically stored the client-computed award for
-- profile history. Keep the completion, score and duration; new or replayed
-- rows no longer persist a point value that a modified client can choose.
CREATE FUNCTION public.fluenci_retire_lesson_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.xp_earned := 0;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_retire_lesson_xp_trigger ON public.lesson_completions;
CREATE TRIGGER fluenci_retire_lesson_xp_trigger
  BEFORE INSERT OR UPDATE OF xp_earned ON public.lesson_completions
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_retire_lesson_xp();

REVOKE ALL ON FUNCTION public.fluenci_retire_daily_xp()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fluenci_retire_lesson_xp()
  FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION public.increment_xp(uuid,integer) IS
  'Legacy service-only XP function. Learner-facing XP was retired in migration 117.';
COMMENT ON FUNCTION public.increment_xp_idempotent(integer,text) IS
  'Legacy service-only XP function. Learner-facing XP was retired in migration 117.';
COMMENT ON FUNCTION public.claim_daily_challenge_bonus() IS
  'Compatibility acknowledgement for retired daily XP reward; always grants zero XP.';

-- Fail the migration if a drifted grant leaves any known client role able to
-- call an award function.
DO $postflight$
BEGIN
  IF has_function_privilege('anon','public.increment_xp(uuid,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.increment_xp(uuid,integer)','EXECUTE')
     OR has_function_privilege('anon','public.increment_xp_idempotent(integer,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.increment_xp_idempotent(integer,text)','EXECUTE') THEN
    RAISE EXCEPTION 'client XP execute privilege remains after migration 117';
  END IF;
END;
$postflight$;

COMMIT;
