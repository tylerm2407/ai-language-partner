-- 121 — Put the Realtime provider call under server control.
--
-- The device receives a single-use Fluenci capability, never a provider
-- credential. The SDP exchange claims that capability atomically; only the
-- service role can read the provider configuration or attach a provider call
-- id to the ledger. A per-user advisory lock also makes "one open tutor call"
-- an invariant of reservation, rather than a client convention.

CREATE TABLE IF NOT EXISTS public.tutor_provider_connections (
  session_id uuid PRIMARY KEY REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  session_config jsonb NOT NULL,
  safety_identifier text NOT NULL CHECK (char_length(safety_identifier) = 64),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_provider_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tutor_provider_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_provider_connections TO service_role;

ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS provider_call_id text,
  ADD COLUMN IF NOT EXISTS provider_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_hangup_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_hangup_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_provenance text NOT NULL DEFAULT 'client_reported'
    CHECK (transcript_provenance IN ('client_reported', 'provider_observed'));

COMMENT ON COLUMN public.tutor_sessions.transcript_provenance IS
  'Trust class for transcript-derived artifacts. Client-reported transcripts may produce learner notes, but never measured proficiency evidence.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_sessions_provider_call
  ON public.tutor_sessions (provider_call_id)
  WHERE provider_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_open_deadline
  ON public.tutor_sessions (provider_deadline_at)
  WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_tutor_provider_connection(
  p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_connection public.tutor_provider_connections%ROWTYPE;
  v_session public.tutor_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_connection
    FROM public.tutor_provider_connections
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF NOT FOUND OR v_connection.expires_at <= now() OR v_connection.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;

  SELECT * INTO v_session
    FROM public.tutor_sessions
   WHERE id = v_connection.session_id
   FOR UPDATE;
  IF NOT FOUND OR v_session.ended_at IS NOT NULL OR v_session.reserved_at IS NULL OR
     v_session.provider_call_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;

  UPDATE public.tutor_provider_connections
     SET claimed_at = now()
   WHERE session_id = v_connection.session_id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'sessionId', v_connection.session_id,
    'sessionConfig', v_connection.session_config,
    'safetyIdentifier', v_connection.safety_identifier
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_tutor_provider_connection(
  p_session_id uuid,
  p_provider_call_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_changed boolean;
BEGIN
  IF p_provider_call_id IS NULL OR length(trim(p_provider_call_id)) < 3 THEN
    RAISE EXCEPTION 'invalid provider call id' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tutor_sessions
     SET provider_call_id = p_provider_call_id,
         provider_connected_at = now(),
         provider_deadline_at = now() + make_interval(secs => granted_seconds),
         last_heartbeat_at = now()
   WHERE id = p_session_id
     AND ended_at IS NULL
     AND provider_call_id IS NULL;
  v_changed := FOUND;
  IF v_changed THEN
    DELETE FROM public.tutor_provider_connections WHERE session_id = p_session_id;
  END IF;
  RETURN v_changed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_tutor_provider_connection(
  p_session_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tutor_provider_connections c
     SET claimed_at = NULL
   WHERE c.session_id = p_session_id
     AND NOT EXISTS (
       SELECT 1 FROM public.tutor_sessions s
        WHERE s.id = c.session_id AND s.provider_call_id IS NOT NULL
     );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_tutor_provider_hangup(
  p_session_id uuid,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.tutor_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.tutor_sessions
   WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'missing'); END IF;
  IF v_session.provider_call_id IS NULL OR v_session.provider_hangup_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already', 'callId', v_session.provider_call_id);
  END IF;
  IF v_session.provider_hangup_claimed_at IS NOT NULL AND
     v_session.provider_hangup_claimed_at > now() - make_interval(secs => p_lease_seconds) THEN
    RETURN jsonb_build_object('status', 'busy');
  END IF;
  UPDATE public.tutor_sessions SET provider_hangup_claimed_at = now()
   WHERE id = p_session_id;
  RETURN jsonb_build_object('status', 'claimed', 'callId', v_session.provider_call_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_tutor_provider_hangup(
  p_session_id uuid,
  p_succeeded boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tutor_sessions
     SET provider_hangup_at = CASE WHEN p_succeeded THEN now() ELSE provider_hangup_at END,
         provider_hangup_claimed_at = NULL
   WHERE id = p_session_id;
END;
$function$;

-- Serialize reservations for one user and refuse a second open session. This
-- restates migration 120's function with only the marked concurrency guard.
CREATE OR REPLACE FUNCTION public.reserve_tutor_session(
  p_session_id uuid, p_user_id uuid, p_daily_limit integer, p_monthly_limit integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.tutor_sessions%ROWTYPE;
  v_day date := public.fluenci_user_today(p_user_id);
  v_month date := public.fluenci_user_month(p_user_id);
  v_daily integer;
  v_monthly integer;
BEGIN
  IF p_daily_limit IS NULL OR p_daily_limit < 0 OR p_monthly_limit IS NULL OR p_monthly_limit < 0 THEN
    RAISE EXCEPTION 'invalid tutor limits' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 917));
  SELECT * INTO v_session FROM public.tutor_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'tutor session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.reserved_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'already_reserved'); END IF;
  IF EXISTS (SELECT 1 FROM public.tutor_sessions WHERE user_id = p_user_id AND ended_at IS NULL AND id <> p_session_id) THEN
    RETURN jsonb_build_object('status', 'active_session');
  END IF;
  INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_day) ON CONFLICT (user_id, date) DO NOTHING;
  INSERT INTO public.monthly_usage (user_id, month) VALUES (p_user_id, v_month) ON CONFLICT (user_id, month) DO NOTHING;
  SELECT tutor_seconds INTO v_daily FROM public.daily_usage WHERE user_id = p_user_id AND date = v_day FOR UPDATE;
  SELECT tutor_cents INTO v_monthly FROM public.monthly_usage WHERE user_id = p_user_id AND month = v_month FOR UPDATE;
  IF COALESCE(v_monthly, 0) + v_session.granted_cents > p_monthly_limit THEN RETURN jsonb_build_object('status', 'monthly_limit'); END IF;
  IF COALESCE(v_daily, 0) + v_session.granted_seconds > p_daily_limit THEN RETURN jsonb_build_object('status', 'daily_limit'); END IF;
  UPDATE public.daily_usage SET tutor_seconds = COALESCE(tutor_seconds, 0) + v_session.granted_seconds WHERE user_id = p_user_id AND date = v_day;
  UPDATE public.monthly_usage SET tutor_cents = COALESCE(tutor_cents, 0) + v_session.granted_cents WHERE user_id = p_user_id AND month = v_month;
  UPDATE public.tutor_sessions SET reservation_date = v_day, reservation_month = v_month,
    reserved_at = now(), observed_seconds = NULL, settled_at = NULL, refunded_seconds = 0,
    refunded_cents = 0, ended_at = NULL, end_reason = NULL WHERE id = p_session_id;
  RETURN jsonb_build_object('status', 'reserved');
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_tutor_provider_connection(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tutor_provider_connection(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_tutor_provider_connection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_tutor_provider_hangup(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_tutor_provider_hangup(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tutor_provider_connection(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_tutor_provider_connection(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_tutor_provider_connection(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_tutor_provider_hangup(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_tutor_provider_hangup(uuid, boolean) TO service_role;

-- Supabase Cron accepts sub-minute intervals. The hard provider deadline is
-- therefore enforced within roughly one tick even if the client keeps sending
-- forged heartbeats.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fluenci-tutor-reaper') THEN
    PERFORM cron.unschedule('fluenci-tutor-reaper');
  END IF;
END $$;
SELECT cron.schedule(
  'fluenci-tutor-reaper', '10 seconds',
  $cron$
  SELECT net.http_post(
    url := 'https://ngqpsuixmumdnqbqxjxv.supabase.co/functions/v1/tutor-session-reaper',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)),
    body := jsonb_build_object('trigger','pg_cron'), timeout_milliseconds := 60000
  );
  $cron$
);
