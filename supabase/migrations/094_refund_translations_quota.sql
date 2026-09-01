-- 094 — Let a failed translation be refunded.
--
-- Migration 093 metered `translate`, but `refund_daily_quota` carries its OWN
-- whitelist, separate from `consume_daily_quota`'s and narrower. So a
-- translation could be charged and then not delivered, with no way to give it
-- back.
--
-- Found the honest way: tapping Translate against the live function. The
-- counter went to 2 (the client retries once) and the learner got an error
-- both times. Two of their ten daily translations, spent on nothing.
--
-- The rule this encodes: a quota is a charge for a delivered thing. Consume
-- before the paid call, because that is the only way to bound spend — but
-- refund when the paid call does not produce anything.
--
-- Body is otherwise identical to the live function; only the IN list changes.
CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid, p_counter text, p_amount integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'hints_generated', 'translations') THEN
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
