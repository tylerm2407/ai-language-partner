-- 120 — Make tutor reservation and settlement single database transactions.
--
-- The original edge flow changed monthly_usage, daily_usage and tutor_sessions
-- in separate requests. A worker crash between those requests could either
-- strand a charge or refund a reservation twice. These RPCs lock the ledger
-- rows and change all three records in one Postgres transaction.

ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS reservation_date date,
  ADD COLUMN IF NOT EXISTS reservation_month date,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_attempts integer NOT NULL DEFAULT 0
    CHECK (analysis_attempts >= 0),
  ADD COLUMN IF NOT EXISTS analysis_last_error text,
  ADD COLUMN IF NOT EXISTS refunded_seconds integer NOT NULL DEFAULT 0
    CHECK (refunded_seconds >= 0),
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_cents >= 0);

-- Recover the original local accounting period for existing sessions. Invalid
-- profile timezones deliberately fall back to UTC, matching fluenci_user_today.
WITH periods AS (
  SELECT ts.id,
         (ts.started_at AT TIME ZONE COALESCE(tz.name, 'UTC'))::date AS local_day
    FROM public.tutor_sessions ts
    LEFT JOIN public.user_profiles p ON p.user_id = ts.user_id
    LEFT JOIN pg_timezone_names tz ON tz.name = p.timezone
)
UPDATE public.tutor_sessions ts
   SET reservation_date = p.local_day,
       reservation_month = date_trunc('month', p.local_day)::date,
       reserved_at = ts.started_at,
       settled_at = CASE WHEN ts.observed_seconds IS NOT NULL
                         THEN COALESCE(ts.ended_at, ts.started_at) END
  FROM periods p
 WHERE p.id = ts.id
   AND (ts.reservation_date IS NULL OR ts.reservation_month IS NULL OR ts.reserved_at IS NULL);

ALTER TABLE public.tutor_sessions
  ADD CONSTRAINT tutor_sessions_reservation_periods_consistent CHECK (
    (reserved_at IS NULL AND reservation_date IS NULL AND reservation_month IS NULL)
    OR
    (reserved_at IS NOT NULL AND reservation_date IS NOT NULL AND reservation_month IS NOT NULL)
  );

COMMENT ON COLUMN public.tutor_sessions.reservation_date IS
  'The user-local daily_usage date charged at reservation time; settlement refunds this exact row.';
COMMENT ON COLUMN public.tutor_sessions.reservation_month IS
  'The user-local monthly_usage month charged at reservation time; settlement refunds this exact row.';

CREATE OR REPLACE FUNCTION public.reserve_tutor_session(
  p_session_id uuid,
  p_user_id uuid,
  p_daily_limit integer,
  p_monthly_limit integer
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
  IF p_daily_limit IS NULL OR p_daily_limit < 0 OR
     p_monthly_limit IS NULL OR p_monthly_limit < 0 THEN
    RAISE EXCEPTION 'invalid tutor limits' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
    FROM public.tutor_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'tutor session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.reserved_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_reserved');
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, v_day) ON CONFLICT (user_id, date) DO NOTHING;
  INSERT INTO public.monthly_usage (user_id, month)
  VALUES (p_user_id, v_month) ON CONFLICT (user_id, month) DO NOTHING;

  -- Lock in a fixed order in every invocation. No counter moves until both
  -- ceilings have been checked under their row locks.
  SELECT tutor_seconds INTO v_daily
    FROM public.daily_usage
   WHERE user_id = p_user_id AND date = v_day
   FOR UPDATE;
  SELECT tutor_cents INTO v_monthly
    FROM public.monthly_usage
   WHERE user_id = p_user_id AND month = v_month
   FOR UPDATE;

  IF COALESCE(v_monthly, 0) + v_session.granted_cents > p_monthly_limit THEN
    RETURN jsonb_build_object('status', 'monthly_limit');
  END IF;
  IF COALESCE(v_daily, 0) + v_session.granted_seconds > p_daily_limit THEN
    RETURN jsonb_build_object('status', 'daily_limit');
  END IF;

  UPDATE public.daily_usage
     SET tutor_seconds = COALESCE(tutor_seconds, 0) + v_session.granted_seconds
   WHERE user_id = p_user_id AND date = v_day;
  UPDATE public.monthly_usage
     SET tutor_cents = COALESCE(tutor_cents, 0) + v_session.granted_cents
   WHERE user_id = p_user_id AND month = v_month;

  UPDATE public.tutor_sessions
     SET reservation_date = v_day,
         reservation_month = v_month,
         reserved_at = now(),
         observed_seconds = NULL,
         settled_at = NULL,
         refunded_seconds = 0,
         refunded_cents = 0,
         ended_at = NULL,
         end_reason = NULL
   WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'reserved');
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_tutor_analysis_failure(
  p_session_id uuid,
  p_user_id uuid,
  p_error text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_attempts integer;
BEGIN
  UPDATE public.tutor_sessions
     SET analysis_attempts = analysis_attempts + 1,
         analysis_last_error = left(COALESCE(p_error, 'unknown analysis failure'), 500)
   WHERE id = p_session_id
     AND user_id = p_user_id
     AND ended_at IS NULL
  RETURNING analysis_attempts INTO v_attempts;

  IF v_attempts IS NULL THEN
    RAISE EXCEPTION 'open tutor session not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_attempts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_tutor_session(
  p_session_id uuid,
  p_user_id uuid,
  p_observed_seconds integer,
  p_refund_seconds integer,
  p_refund_cents integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.tutor_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
    FROM public.tutor_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'tutor session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.reserved_at IS NULL THEN
    RAISE EXCEPTION 'tutor session was not reserved' USING ERRCODE = '55000';
  END IF;
  IF v_session.settled_at IS NOT NULL OR v_session.observed_seconds IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'observedSeconds', v_session.observed_seconds,
      'refundSeconds', v_session.refunded_seconds,
      'refundCents', v_session.refunded_cents
    );
  END IF;
  IF p_observed_seconds IS NULL OR p_observed_seconds < 0 OR
     p_observed_seconds > v_session.granted_seconds OR
     p_refund_seconds <> v_session.granted_seconds - p_observed_seconds OR
     p_refund_cents IS NULL OR p_refund_cents < 0 OR
     p_refund_cents > v_session.granted_cents THEN
    RAISE EXCEPTION 'invalid tutor settlement' USING ERRCODE = '22023';
  END IF;

  -- Missing usage rows indicate ledger corruption. Raising here rolls back the
  -- entire function, including observed_seconds, so the next worker can retry.
  UPDATE public.daily_usage
     SET tutor_seconds = tutor_seconds - p_refund_seconds
   WHERE user_id = p_user_id
     AND date = v_session.reservation_date
     AND tutor_seconds >= p_refund_seconds;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'daily tutor reservation row missing or inconsistent' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.monthly_usage
     SET tutor_cents = tutor_cents - p_refund_cents
   WHERE user_id = p_user_id
     AND month = v_session.reservation_month
     AND tutor_cents >= p_refund_cents;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'monthly tutor reservation row missing or inconsistent' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tutor_sessions
     SET observed_seconds = p_observed_seconds,
         refunded_seconds = p_refund_seconds,
         refunded_cents = p_refund_cents,
         settled_at = now()
   WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'observedSeconds', p_observed_seconds,
    'refundSeconds', p_refund_seconds,
    'refundCents', p_refund_cents
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_tutor_session(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tutor_session(uuid, uuid, integer, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.settle_tutor_session(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tutor_session(uuid, uuid, integer, integer, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_tutor_analysis_failure(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tutor_analysis_failure(uuid, uuid, text)
  TO service_role;
