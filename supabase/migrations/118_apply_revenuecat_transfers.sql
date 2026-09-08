-- 118 — Apply every account affected by a RevenueCat transfer atomically.
-- Provider state is fetched for both transferred_from and transferred_to by
-- the webhook. This function commits all subscription rows and the durable
-- event completion together, so a retry can never observe a half-transfer.
BEGIN;

CREATE FUNCTION public.apply_revenuecat_transfer_event(
  p_event_id text,p_lease_token uuid,p_states jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_state jsonb;
  v_user_id uuid;
  v_tier text;
  v_is_active boolean;
  v_status text;
  v_period_end timestamptz;
  v_cancel boolean;
  v_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.fluenci_revenuecat_events
   WHERE event_id=p_event_id AND lease_token=p_lease_token
     AND event_type='TRANSFER' AND status='processing'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer event is not processing' USING ERRCODE='55000';
  END IF;
  IF p_states IS NULL OR jsonb_typeof(p_states)<>'array' THEN
    RAISE EXCEPTION 'transfer states must be an array' USING ERRCODE='22023';
  END IF;

  FOR v_state IN SELECT value FROM jsonb_array_elements(p_states)
  LOOP
    v_count := v_count+1;
    v_user_id := (v_state->>'userId')::uuid;
    v_tier := v_state->>'tier';
    v_is_active := (v_state->>'isActive')::boolean;
    v_status := v_state->>'subscriptionStatus';
    v_period_end := NULLIF(v_state->>'currentPeriodEnd','')::timestamptz;
    v_cancel := COALESCE((v_state->>'cancelAtPeriodEnd')::boolean,false);
    IF v_tier NOT IN ('starter','basic','premium','vip')
       OR v_status NOT IN ('active','inactive')
       OR v_is_active IS DISTINCT FROM (v_status='active')
       OR (v_is_active AND v_tier='starter')
       OR (NOT v_is_active AND v_tier<>'starter') THEN
      RAISE EXCEPTION 'invalid reconciled subscription state' USING ERRCODE='22023';
    END IF;
    -- A transfer may name a previously deleted application account. Its
    -- subscription row is already gone by cascade; skip it without preventing
    -- the still-valid destination account from being reconciled.
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id=v_user_id);
    INSERT INTO public.subscriptions
      (user_id,tier,is_active,subscription_status,current_period_end,
       cancel_at_period_end,updated_at)
    VALUES
      (v_user_id,v_tier,v_is_active,v_status,v_period_end,v_cancel,now())
    ON CONFLICT (user_id) DO UPDATE SET
      tier=EXCLUDED.tier,is_active=EXCLUDED.is_active,
      subscription_status=EXCLUDED.subscription_status,
      current_period_end=EXCLUDED.current_period_end,
      cancel_at_period_end=EXCLUDED.cancel_at_period_end,
      updated_at=EXCLUDED.updated_at;
  END LOOP;
  IF v_count=0 THEN
    RAISE EXCEPTION 'transfer states cannot be empty' USING ERRCODE='22023';
  END IF;

  UPDATE public.fluenci_revenuecat_events
     SET status='completed',lease_token=NULL,lease_until=NULL,last_error=NULL,
         completed_at=now(),updated_at=now()
   WHERE event_id=p_event_id AND lease_token=p_lease_token;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_revenuecat_transfer_event(text,uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_revenuecat_transfer_event(text,uuid,jsonb)
  TO service_role;

COMMIT;
