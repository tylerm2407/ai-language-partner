-- 116 — Durable RevenueCat event inbox. Receipt, processing and completion
-- are distinct states. Entitlement mutation and completion are transactional.
BEGIN;

CREATE TABLE public.fluenci_revenuecat_events (
  event_id text PRIMARY KEY CHECK (char_length(event_id) BETWEEN 1 AND 255),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending','processing','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fluenci_revenuecat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fluenci_revenuecat_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fluenci_revenuecat_events TO service_role;
CREATE INDEX fluenci_revenuecat_events_pending_idx
  ON public.fluenci_revenuecat_events (status, lease_until, received_at)
  WHERE status <> 'completed';

CREATE FUNCTION public.claim_revenuecat_event(
  p_event_id text, p_event_type text, p_user_id uuid, p_event_data jsonb,
  p_lease_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_row public.fluenci_revenuecat_events%ROWTYPE;
  v_lease_token uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_lease_seconds NOT BETWEEN 10 AND 300 THEN
    RAISE EXCEPTION 'invalid lease' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fluenci_revenuecat_events
    (event_id,event_type,user_id,event_data,status,attempts,lease_token,lease_until)
  VALUES
    (p_event_id,p_event_type,p_user_id,COALESCE(p_event_data,'{}'::jsonb),
     'processing',1,v_lease_token,now()+make_interval(secs=>p_lease_seconds))
  ON CONFLICT (event_id) DO NOTHING RETURNING * INTO v_row;
  IF FOUND THEN
    RETURN jsonb_build_object('status','claimed','lease_token',v_lease_token);
  END IF;

  SELECT * INTO v_row FROM public.fluenci_revenuecat_events
   WHERE event_id=p_event_id FOR UPDATE;
  IF v_row.event_type IS DISTINCT FROM p_event_type
     OR v_row.user_id IS DISTINCT FROM p_user_id
     OR v_row.event_data IS DISTINCT FROM COALESCE(p_event_data,'{}'::jsonb) THEN
    RAISE EXCEPTION 'event identity mismatch' USING ERRCODE = '22023';
  END IF;
  IF v_row.status='completed' THEN
    RETURN jsonb_build_object('status','completed');
  END IF;
  IF v_row.status='processing' AND v_row.lease_until>now() THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  UPDATE public.fluenci_revenuecat_events
     SET status='processing', attempts=attempts+1,
         lease_token=v_lease_token,
         lease_until=now()+make_interval(secs=>p_lease_seconds),
         last_error=NULL, updated_at=now()
   WHERE event_id=p_event_id;
  RETURN jsonb_build_object('status','claimed','lease_token',v_lease_token);
END;
$function$;

CREATE FUNCTION public.fail_revenuecat_event(
  p_event_id text,p_lease_token uuid,p_error text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.fluenci_revenuecat_events
     SET status='pending',lease_token=NULL,lease_until=NULL,
         last_error=left(COALESCE(p_error,'unknown error'),500),updated_at=now()
   WHERE event_id=p_event_id AND status='processing'
     AND lease_token=p_lease_token;
END;
$function$;

CREATE FUNCTION public.complete_revenuecat_event(
  p_event_id text,p_lease_token uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.fluenci_revenuecat_events
     SET status='completed',lease_token=NULL,lease_until=NULL,last_error=NULL,
         completed_at=COALESCE(completed_at,now()),updated_at=now()
   WHERE event_id=p_event_id AND status='processing'
     AND lease_token=p_lease_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'event is not processing' USING ERRCODE='55000'; END IF;
END;
$function$;

CREATE FUNCTION public.apply_revenuecat_entitlement_event(
  p_event_id text,p_lease_token uuid,p_user_id uuid,p_tier text,p_is_active boolean,
  p_subscription_status text,p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.fluenci_revenuecat_events
   WHERE event_id=p_event_id AND lease_token=p_lease_token
     AND user_id=p_user_id AND status='processing'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event is not processing' USING ERRCODE='55000'; END IF;
  INSERT INTO public.subscriptions
    (user_id,tier,is_active,subscription_status,current_period_end,
     cancel_at_period_end,updated_at)
  VALUES
    (p_user_id,p_tier,p_is_active,p_subscription_status,p_current_period_end,
     p_cancel_at_period_end,now())
  ON CONFLICT (user_id) DO UPDATE SET
    tier=EXCLUDED.tier,is_active=EXCLUDED.is_active,
    subscription_status=EXCLUDED.subscription_status,
    current_period_end=EXCLUDED.current_period_end,
    cancel_at_period_end=EXCLUDED.cancel_at_period_end,
    updated_at=EXCLUDED.updated_at;
  UPDATE public.fluenci_revenuecat_events
   SET status='completed',lease_token=NULL,lease_until=NULL,last_error=NULL,
       completed_at=now(),updated_at=now()
   WHERE event_id=p_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_revenuecat_event(text,text,uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_revenuecat_event(text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_revenuecat_event(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_revenuecat_entitlement_event(text,uuid,uuid,text,boolean,text,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_revenuecat_event(text,text,uuid,jsonb,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_revenuecat_event(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_revenuecat_event(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_revenuecat_entitlement_event(text,uuid,uuid,text,boolean,text,timestamptz,boolean) TO service_role;
COMMIT;
