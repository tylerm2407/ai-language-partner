-- 105 — A monthly allowance primitive, and avatars move onto it.
--
-- Avatars were 1/day. Nobody regenerates a profile picture daily, but a
-- ceiling has to assume they might: at ~$0.211 an image on gpt-image-2
-- 'high', 1/day is ~$6.33/user/month — 75% of net revenue on basic, and the
-- largest per-user line left once the curriculum caches are warmed.
--
-- A DAILY cap is simply the wrong SHAPE for this feature. Someone setting up
-- a profile wants two or three attempts in one sitting and then nothing for
-- months. 3/month serves that better than 1/day and costs ten times less
-- (~$0.63 vs ~$6.33) — cheaper AND more generous in the way that matters.
--
-- `monthly_usage` deliberately mirrors `daily_usage`: same shape, same atomic
-- check-and-increment, so the next monthly-shaped allowance needs no new
-- thinking. Keyed on the first of the learner's LOCAL month, for the same
-- reason the daily counters use fluenci_user_today — a learner at UTC+13 must
-- not roll over on someone else's calendar.
--
-- Applied to production 2026-09-02. Verified by probe: with a limit of 3 the
-- fourth consume returned false and a refund freed exactly one slot.

CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  avatars_generated integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, month)
);

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;

-- Read-only to the owner; every write goes through the SECURITY DEFINER RPC.
-- Consistent with daily_usage: a client that can write its own usage row can
-- grant itself unlimited paid calls.
CREATE POLICY "Users read own monthly usage" ON public.monthly_usage
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_user_month
  ON public.monthly_usage (user_id, month);

CREATE OR REPLACE FUNCTION public.fluenci_user_month(p_user_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT date_trunc('month', public.fluenci_user_today(p_user_id))::date $$;

CREATE OR REPLACE FUNCTION public.consume_monthly_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_month date;
BEGIN
  IF p_counter NOT IN ('avatars_generated') THEN
    RAISE EXCEPTION 'invalid monthly quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  v_month := public.fluenci_user_month(p_user_id);

  INSERT INTO public.monthly_usage (user_id, month) VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, month) DO NOTHING;

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
  IF p_counter NOT IN ('avatars_generated') THEN
    RAISE EXCEPTION 'invalid monthly quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  EXECUTE format(
    'UPDATE public.monthly_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND month = $3', p_counter)
  USING p_user_id, p_amount, v_month;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_monthly_quota(uuid, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_monthly_quota(uuid, text, integer) FROM anon;
