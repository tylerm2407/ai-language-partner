-- 149 — Purchased tutor minutes: a lot ledger, not a balance.
--
-- VIP learners who exhaust the monthly tutor budget can buy more minutes as a
-- consumable in-app purchase. Three constraints shaped this table, and none of
-- them is negotiable:
--
-- 1. APPLE GUIDELINE 3.1.1: "Any credits or in-game currencies purchased via
--    in-app purchase may not expire." There is no expiry column here and there
--    must never be one. A lapsed VIP keeps their balance AND must be able to
--    spend it — minutes that die with the subscription are expired minutes
--    wearing a different hat.
--
-- 2. LOTS, NOT A RUNNING TOTAL. When a refund is requested Apple sends
--    CONSUMPTION_REQUEST and gives twelve hours to answer with delivery and
--    consumption data; V2 of that endpoint carries a PRORATED refund
--    preference, which is the only lever we have against "they burned 42 of
--    the 60 minutes and then asked for the money back". Answering it requires
--    knowing how much of ONE TRANSACTION was consumed. A single balance column
--    cannot answer it, and retrofitting per-transaction burn later means
--    reconstructing it from session rows that were never joined to a purchase.
--
-- 3. THE BALANCE MUST BE ABLE TO GO NEGATIVE, in effect. Apple decides refunds
--    unilaterally and there is no reversal; a consumable refunded after it was
--    consumed is money returned for minutes already delivered. That is why the
--    ledger lives here rather than in RevenueCat's Virtual Currency feature,
--    which is otherwise a good fit and would have done the bookkeeping for us:
--    its balances are clamped to 0..2e9, so it cannot represent a clawed-back
--    user at all. `tutor_credit_deficit` is that representation.
--
-- Spending order is PLAN FIRST, always — see `reserve_tutor_session` below. A
-- learner must never burn paid minutes on a day their included allowance was
-- still available; that is both a margin leak and a refund magnet.

-- ─── 1. The lots ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tutor_credit_lots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The store's transaction id. UNIQUE is the idempotency guarantee: webhook
  -- retries reuse the same event id AND the same transaction id, so a replay
  -- cannot grant twice even if the event-level claim is bypassed.
  store_transaction_id text NOT NULL UNIQUE,
  product_id           text NOT NULL,
  seconds_purchased    integer NOT NULL CHECK (seconds_purchased > 0),
  seconds_consumed     integer NOT NULL DEFAULT 0 CHECK (seconds_consumed >= 0),
  -- Set when the store takes the money back. The lot stops counting toward the
  -- balance; whatever was already consumed becomes deficit.
  refunded_at          timestamptz,
  purchased_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_credit_lots_not_overdrawn CHECK (seconds_consumed <= seconds_purchased)
);

CREATE INDEX IF NOT EXISTS tutor_credit_lots_user_open_idx
  ON public.tutor_credit_lots (user_id, purchased_at)
  WHERE refunded_at IS NULL;

COMMENT ON TABLE public.tutor_credit_lots IS
  'Purchased live-tutor minutes, one row per store transaction. Per-transaction '
  'burn is recorded so Apple CONSUMPTION_REQUEST can be answered with a prorated '
  'refund preference. Never expires (App Store guideline 3.1.1).';

-- ─── 2. The clawback watermark ───────────────────────────────────────────
--
-- Deliberately a separate number rather than a negative lot. A refund can
-- arrive after every lot it relates to is fully consumed, so there is no row
-- left to make negative; and a permanent watermark subtracted from the balance
-- is self-correcting without a state machine. It never decays: the next
-- purchase is netted against it automatically by `tutor_credit_seconds`.

CREATE TABLE IF NOT EXISTS public.tutor_credit_deficit (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seconds    integer NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_credit_deficit IS
  'Seconds delivered from lots that were later refunded. Subtracted from the '
  'usable balance forever; the next purchase pays it down first.';

-- ─── 3. RLS ──────────────────────────────────────────────────────────────
--
-- Read-your-own, and nothing else. A balance is economic state, so every write
-- is service_role (the RevenueCat webhook) or SECURITY DEFINER (the ledger
-- functions below). FOR SELECT rather than FOR ALL on purpose: a FOR ALL
-- policy reuses its USING expression as the write check, which is exactly how
-- a learner would be able to grant themselves minutes.

ALTER TABLE public.tutor_credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_credit_deficit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own tutor credit lots" ON public.tutor_credit_lots;
CREATE POLICY "Users read their own tutor credit lots" ON public.tutor_credit_lots
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read their own tutor credit deficit" ON public.tutor_credit_deficit;
CREATE POLICY "Users read their own tutor credit deficit" ON public.tutor_credit_deficit
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─── 4. The balance ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tutor_credit_seconds(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT GREATEST(0,
    COALESCE((
      SELECT SUM(l.seconds_purchased - l.seconds_consumed)::integer
        FROM public.tutor_credit_lots l
       WHERE l.user_id = p_user_id AND l.refunded_at IS NULL
    ), 0)
    - COALESCE((SELECT d.seconds FROM public.tutor_credit_deficit d WHERE d.user_id = p_user_id), 0)
  );
$function$;

COMMENT ON FUNCTION public.tutor_credit_seconds(uuid) IS
  'Usable purchased seconds: live lots minus the clawback watermark.';

-- ─── 5. Granting a purchase ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_tutor_credit_lot(
  p_user_id uuid,
  p_store_transaction_id text,
  p_product_id text,
  p_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted uuid;
BEGIN
  IF p_seconds IS NULL OR p_seconds < 1 THEN
    RAISE EXCEPTION 'invalid credit seconds' USING ERRCODE = '22023';
  END IF;
  IF p_store_transaction_id IS NULL OR length(p_store_transaction_id) = 0 THEN
    RAISE EXCEPTION 'missing store transaction id' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tutor_credit_lots (user_id, store_transaction_id, product_id, seconds_purchased)
  VALUES (p_user_id, p_store_transaction_id, p_product_id, p_seconds)
  ON CONFLICT (store_transaction_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    -- A replayed webhook delivery. Not an error, and must not grant again.
    RETURN jsonb_build_object('status', 'duplicate', 'balanceSeconds', public.tutor_credit_seconds(p_user_id));
  END IF;

  RETURN jsonb_build_object(
    'status', 'granted',
    'lotId', v_inserted,
    'balanceSeconds', public.tutor_credit_seconds(p_user_id)
  );
END;
$function$;

-- ─── 6. Clawing one back ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_tutor_credit_lot(
  p_user_id uuid,
  p_store_transaction_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_lot public.tutor_credit_lots%ROWTYPE;
BEGIN
  SELECT * INTO v_lot FROM public.tutor_credit_lots
   WHERE store_transaction_id = p_store_transaction_id AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    -- A refund for a purchase we never recorded. Acknowledge rather than
    -- raise: retrying cannot make the lot appear, and a 500 here would have
    -- RevenueCat redelivering forever.
    RETURN jsonb_build_object('status', 'unknown_lot');
  END IF;
  IF v_lot.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_refunded');
  END IF;

  UPDATE public.tutor_credit_lots SET refunded_at = now() WHERE id = v_lot.id;

  -- Unconsumed seconds simply leave the balance with the lot. Seconds already
  -- DELIVERED are the abuse surface: the learner keeps the tutoring and gets
  -- the money back, so they become a permanent watermark instead.
  IF v_lot.seconds_consumed > 0 THEN
    INSERT INTO public.tutor_credit_deficit (user_id, seconds)
    VALUES (p_user_id, v_lot.seconds_consumed)
    ON CONFLICT (user_id) DO UPDATE
      SET seconds = public.tutor_credit_deficit.seconds + EXCLUDED.seconds,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'status', 'refunded',
    'deficitAdded', v_lot.seconds_consumed,
    'balanceSeconds', public.tutor_credit_seconds(p_user_id)
  );
END;
$function$;

-- ─── 7. The session row learns where its money came from ─────────────────

ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS funded_from text NOT NULL DEFAULT 'plan'
    CHECK (funded_from IN ('plan', 'credits')),
  ADD COLUMN IF NOT EXISTS credit_allocations jsonb;

COMMENT ON COLUMN public.tutor_sessions.funded_from IS
  'Which pocket paid for this session. A session is funded ENTIRELY by plan or '
  'ENTIRELY by credits — never split — so settlement always knows which to '
  'refund. Decided under lock in reserve_tutor_session, never by the caller.';
COMMENT ON COLUMN public.tutor_sessions.credit_allocations IS
  'For funded_from = credits: [{lotId, seconds}] in the order the lots were '
  'debited. Settlement returns seconds to these exact lots, and it is what lets '
  'a CONSUMPTION_REQUEST be answered per transaction.';

-- ─── 8. Reservation: plan first, then credits ────────────────────────────
--
-- Body restated from the live definition (migration 123) and extended. The
-- credit branch deliberately touches NEITHER counter — not daily_usage.
-- tutor_seconds, not monthly_usage.tutor_cents. That is the whole mechanism
-- behind "purchased minutes bypass the daily cap": there is no cap to bypass
-- because the counters the caps read are never incremented.
--
-- Session-level bounds still apply and are unchanged: TUTOR_MAX_SESSION_SECONDS
-- caps one call at twenty minutes, and the one-open-session rule below stands,
-- so a large balance cannot become a single runaway call.

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
  v_plan_ok boolean;
  v_credit integer;
  v_needed integer;
  v_take integer;
  v_lot RECORD;
  v_allocations jsonb := '[]'::jsonb;
BEGIN
  IF p_daily_limit IS NULL OR p_daily_limit < 0 OR
     p_monthly_limit IS NULL OR p_monthly_limit < 0 THEN
    RAISE EXCEPTION 'invalid tutor limits' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 917));

  SELECT * INTO v_session FROM public.tutor_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND OR v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'tutor session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.reserved_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_reserved');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tutor_sessions
     WHERE user_id = p_user_id AND ended_at IS NULL AND id <> p_session_id
  ) THEN
    RETURN jsonb_build_object('status', 'active_session');
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, v_day) ON CONFLICT (user_id, date) DO NOTHING;
  INSERT INTO public.monthly_usage (user_id, month)
  VALUES (p_user_id, v_month) ON CONFLICT (user_id, month) DO NOTHING;

  SELECT tutor_seconds INTO v_daily
    FROM public.daily_usage WHERE user_id = p_user_id AND date = v_day FOR UPDATE;
  SELECT tutor_cents INTO v_monthly
    FROM public.monthly_usage WHERE user_id = p_user_id AND month = v_month FOR UPDATE;

  v_plan_ok :=
    COALESCE(v_monthly, 0) + v_session.granted_cents <= p_monthly_limit AND
    COALESCE(v_daily, 0) + v_session.granted_seconds <= p_daily_limit;

  IF v_plan_ok THEN
    UPDATE public.daily_usage
       SET tutor_seconds = COALESCE(tutor_seconds, 0) + v_session.granted_seconds
     WHERE user_id = p_user_id AND date = v_day;
    UPDATE public.monthly_usage
       SET tutor_cents = COALESCE(tutor_cents, 0) + v_session.granted_cents
     WHERE user_id = p_user_id AND month = v_month;

    UPDATE public.tutor_sessions
       SET reservation_date = v_day, reservation_month = v_month, reserved_at = now(),
           funded_from = 'plan', credit_allocations = NULL,
           observed_seconds = NULL, settled_at = NULL,
           refunded_seconds = 0, refunded_cents = 0, ended_at = NULL, end_reason = NULL
     WHERE id = p_session_id;

    RETURN jsonb_build_object('status', 'reserved', 'fundedFrom', 'plan');
  END IF;

  -- ── The plan cannot cover it. Purchased minutes, or nothing. ──────────
  v_credit := public.tutor_credit_seconds(p_user_id);
  IF v_credit < v_session.granted_seconds THEN
    -- Name the binding PLAN ceiling, because that is what the learner needs
    -- told: the monthly one does not come back tonight, the daily one does.
    IF COALESCE(v_monthly, 0) + v_session.granted_cents > p_monthly_limit THEN
      RETURN jsonb_build_object('status', 'monthly_limit');
    END IF;
    RETURN jsonb_build_object('status', 'daily_limit');
  END IF;

  -- Debit lots oldest first. FIFO is what makes the consumption report
  -- defensible: the oldest purchase is the one most likely to be past its
  -- refund window, so the seconds most at risk of clawback are spent last.
  v_needed := v_session.granted_seconds;
  FOR v_lot IN
    SELECT id, seconds_purchased - seconds_consumed AS remaining
      FROM public.tutor_credit_lots
     WHERE user_id = p_user_id AND refunded_at IS NULL
       AND seconds_purchased > seconds_consumed
     ORDER BY purchased_at, id
     FOR UPDATE
  LOOP
    EXIT WHEN v_needed <= 0;
    v_take := LEAST(v_needed, v_lot.remaining);
    UPDATE public.tutor_credit_lots
       SET seconds_consumed = seconds_consumed + v_take
     WHERE id = v_lot.id;
    v_allocations := v_allocations || jsonb_build_object('lotId', v_lot.id, 'seconds', v_take);
    v_needed := v_needed - v_take;
  END LOOP;

  IF v_needed > 0 THEN
    -- The balance said yes but the lots could not cover it, which means the
    -- deficit ate into them. Roll the whole transaction back rather than
    -- granting a short session nobody asked for.
    RAISE EXCEPTION 'tutor credit balance inconsistent' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tutor_sessions
     SET reservation_date = v_day, reservation_month = v_month, reserved_at = now(),
         funded_from = 'credits', credit_allocations = v_allocations,
         observed_seconds = NULL, settled_at = NULL,
         refunded_seconds = 0, refunded_cents = 0, ended_at = NULL, end_reason = NULL
   WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'reserved', 'fundedFrom', 'credits');
END;
$function$;

-- ─── 9. Settlement returns to the pocket that paid ───────────────────────
--
-- Body restated from migration 123 and extended with the credit branch. The
-- plan branch is unchanged, including the invariant that refunds go against
-- the session's STORED reservation_date / reservation_month rather than
-- today's rows: a session started before midnight and settled after must give
-- its minutes back to the day it took them from.

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
  v_alloc jsonb;
  v_left integer;
  v_give integer;
  v_consumed integer;
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
  -- A refund may be at most the unused share and never negative. It may be
  -- LESS (down to zero) when the caller forfeits it because the provider
  -- call could not be confirmed ended — the reservation IS the ceiling, and
  -- keeping it charged is the only way the ceiling stays one.
  IF p_observed_seconds IS NULL OR p_observed_seconds < 0 OR
     p_observed_seconds > v_session.granted_seconds OR
     p_refund_seconds IS NULL OR p_refund_seconds < 0 OR
     p_refund_seconds > v_session.granted_seconds - p_observed_seconds OR
     p_refund_cents IS NULL OR p_refund_cents < 0 OR
     p_refund_cents > v_session.granted_cents THEN
    RAISE EXCEPTION 'invalid tutor settlement' USING ERRCODE = '22023';
  END IF;

  IF v_session.funded_from = 'credits' THEN
    -- Nothing was ever added to daily_usage or monthly_usage for this session,
    -- so there is nothing there to give back. Unused seconds return to the
    -- exact lots they came from, most recent allocation first — the mirror of
    -- the FIFO debit, so the oldest lot stays spent and the seconds still at
    -- risk of a clawback are the ones handed back.
    v_left := p_refund_seconds;
    FOR v_alloc IN
      SELECT t.value
        FROM jsonb_array_elements(COALESCE(v_session.credit_allocations, '[]'::jsonb))
             WITH ORDINALITY AS t(value, ord)
       ORDER BY t.ord DESC
    LOOP
      EXIT WHEN v_left <= 0;
      SELECT seconds_consumed INTO v_consumed
        FROM public.tutor_credit_lots
       WHERE id = (v_alloc->>'lotId')::uuid
       FOR UPDATE;
      IF v_consumed IS NULL THEN CONTINUE; END IF;
      v_give := LEAST(v_left, (v_alloc->>'seconds')::integer, v_consumed);
      IF v_give > 0 THEN
        UPDATE public.tutor_credit_lots
           SET seconds_consumed = seconds_consumed - v_give
         WHERE id = (v_alloc->>'lotId')::uuid;
        v_left := v_left - v_give;
      END IF;
    END LOOP;
  ELSE
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
    'refundCents', p_refund_cents,
    'fundedFrom', v_session.funded_from
  );
END;
$function$;

-- ─── 10. Grants ──────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.grant_tutor_credit_lot(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_tutor_credit_lot(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tutor_credit_lot(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_tutor_credit_lot(uuid, text) TO service_role;
-- The balance is readable by its owner: the tutor screen shows it, and RLS on
-- the underlying tables already scopes what a learner can see.
GRANT EXECUTE ON FUNCTION public.tutor_credit_seconds(uuid) TO authenticated, service_role;
