-- ═══════════════════════════════════════════════════════════════
-- 045: refund_daily_quota — give back a consumed daily-quota unit
--
-- grade-writing consumes the writing_grades quota atomically BEFORE
-- calling the model (migration 037/044 consume_daily_quota). When the
-- AI pipeline fails and the honest no-grade fallback ships
-- (graded: false, all-zero scores), a starter-tier user burned their
-- 1/day grade and got nothing. This RPC lets the edge function refund
-- that unit. Counterpart of consume_daily_quota: same counter
-- whitelist, same user-local day (fluenci_user_today, migration 044),
-- same dynamic-SQL style. Floors at 0; missing row is a no-op.
--
-- Service-role only — a refund is a server-side decision (the edge
-- function knows whether a real grade shipped); never client-callable.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_amount integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated') THEN
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
$$;

REVOKE ALL ON FUNCTION public.refund_daily_quota(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_daily_quota(uuid, text, integer) TO service_role;
