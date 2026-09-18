-- 148 — Referrals: invite a friend, earn free time when they pay.
--
-- THE RULE (Tyler, 2026-09-17)
--   A learner shares their invite code. When someone who used it makes their
--   first REAL payment, and it survives a 7-day refund hold, the referrer earns:
--     • on Basic or Premium (App Store): one month free   — 30-day renewal extension
--     • on VIP (App Store):              half a month free — 15-day renewal extension
--                                        (the value of 50% off one month)
--     • not currently paying:            one month of Premium, granted as a
--                                        RevenueCat promotional entitlement
--   The friend gets nothing extra. There are no discount codes.
--
-- WHY THE REWARD IS NOT A DISCOUNT ON APPLE'S PRICE
--   App Store subscribers are billed by Apple, not by us. Flipping a row here
--   would not stop Apple charging them. The only server-side way to give an
--   App Store subscriber free time is Apple's "extend subscription renewal
--   date" (App Store Server API), which pushes the next charge back by N days
--   (1–90, at most twice per subscription per 365 days). Anyone not on a store
--   subscription gets RevenueCat promotional access instead.
--
-- SHAPE
--   referral_codes        one code per learner, created on first ask
--   referrals             who invited whom; one referrer per referee, ever
--   referral_rewards      ledger: one row per qualified referral
--   referral_deliveries   one attempt to hand out 1..n rewards to a referrer
--   store_subscription_identities
--                         the store + original transaction id per learner, as
--                         seen by the RevenueCat webhook. Apple needs the
--                         original transaction id to extend, and it is also the
--                         self-referral signal (same Apple ID on both sides).
--
-- Every table is RLS-enabled with NO policies: deny-all to clients, the same
-- intended state as api_cache (CLAUDE.md §4). Clients reach this only through
-- the SECURITY DEFINER RPCs below, and never learn another learner's id.
--
-- Money-shaped state is written only by the service role (the webhook and the
-- referral-rewards worker), per CLAUDE.md §1.2.

-- ─── Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 8 characters from a 32-symbol alphabet with no 0/O/1/I, so it can be read
  -- aloud and typed from a screenshot. 2^40 codes; guessing one only attaches
  -- you to a stranger, which pays nobody.
  code       text        NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: a referee who deletes their account after paying
  -- still earned the referrer their reward.
  referee_id          uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  code                text        NOT NULL,
  status              text        NOT NULL DEFAULT 'attached'
                                  CHECK (status IN ('attached','qualified','capped','rewarded','void')),
  void_reason         text,
  attached_at         timestamptz NOT NULL DEFAULT now(),
  qualified_at        timestamptz,
  qualifying_event_id text,
  CHECK (referee_id IS NULL OR referee_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, attached_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_deliveries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method                  text        NOT NULL CHECK (method IN ('apple_extension','revenuecat_promo')),
  days                    integer     NOT NULL CHECK (days BETWEEN 1 AND 400),
  original_transaction_id text,
  environment             text,
  -- Promotional grants are not idempotent at RevenueCat, so the target end
  -- time is fixed here BEFORE the first call and every retry sends the same
  -- one. Granting the same end twice leaves the same entitlement.
  promo_end_at            timestamptz,
  status                  text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','succeeded','failed')),
  attempts                integer     NOT NULL DEFAULT 1,
  claimed_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz,
  external_ref            text,
  error                   text,
  CHECK (method <> 'apple_extension' OR (days <= 90 AND original_transaction_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS referral_deliveries_pending_idx
  ON public.referral_deliveries (claimed_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS referral_deliveries_apple_idx
  ON public.referral_deliveries (original_transaction_id, completed_at)
  WHERE method = 'apple_extension' AND status = 'succeeded';

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id  uuid        NOT NULL UNIQUE REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'holding'
                           CHECK (status IN ('holding','ready','delivering','delivered','void','needs_attention')),
  available_at timestamptz NOT NULL,
  delivery_id  uuid        REFERENCES public.referral_deliveries(id) ON DELETE SET NULL,
  -- What the referrer actually received, filled on delivery.
  method       text,
  days         integer,
  attempts     integer     NOT NULL DEFAULT 0,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx ON public.referral_rewards (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_rewards_due_idx
  ON public.referral_rewards (status, available_at) WHERE status IN ('holding','ready');

CREATE TABLE IF NOT EXISTS public.store_subscription_identities (
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store                   text        NOT NULL CHECK (length(store) BETWEEN 1 AND 32),
  original_transaction_id text,
  product_id              text,
  environment             text,
  expires_at              timestamptz,
  -- First time we saw real money on this store. Never cleared.
  paid_at                 timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store)
);
CREATE INDEX IF NOT EXISTS store_subscription_identities_otid_idx
  ON public.store_subscription_identities (store, original_transaction_id);

ALTER TABLE public.referral_codes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscription_identities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.referral_codes, public.referrals, public.referral_deliveries,
              public.referral_rewards, public.store_subscription_identities
  FROM anon, authenticated;

-- ─── Constants ───────────────────────────────────────────────────────────
-- Kept as SQL functions so the worker, the webhook RPC and the summary all
-- read one definition.

-- Refund window before a reward is handed out.
CREATE OR REPLACE FUNCTION public.fluenci_referral_hold() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '7 days' $$;

-- Most rewards one referrer can earn in any 365 days.
CREATE OR REPLACE FUNCTION public.fluenci_referral_annual_cap() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 12 $$;

-- How long after sign-up a learner may still enter someone's code.
CREATE OR REPLACE FUNCTION public.fluenci_referral_attach_window() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '30 days' $$;

-- Gmail ignores dots and +tags; everyone ignores +tags and case. Used only to
-- stop a learner inviting their own second account.
CREATE OR REPLACE FUNCTION public.fluenci_normalize_email(p_email text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_local  text;
  v_domain text;
BEGIN
  IF p_email IS NULL OR position('@' IN p_email) = 0 THEN RETURN NULL; END IF;
  v_local  := lower(split_part(p_email, '@', 1));
  v_domain := lower(split_part(p_email, '@', 2));
  v_local  := split_part(v_local, '+', 1);
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local  := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  END IF;
  RETURN v_local || '@' || v_domain;
END $$;

-- ─── Client RPC: my code (created on first ask) ──────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_code     text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes    bytea;
  v_idx      integer;
  v_try      integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  LOOP
    v_try := v_try + 1;
    v_code := '';
    v_bytes := extensions.gen_random_bytes(8);
    FOR v_idx IN 0..7 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_idx) % 32) + 1, 1);
    END LOOP;
    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (v_uid, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Either a code collision (retry) or a concurrent first call for the
      -- same user (read theirs back).
      SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ─── Client RPC: enter someone's code ────────────────────────────────────
-- Returns {ok: true} or {ok: false, error: CODE}. Errors are RETURNED, not
-- raised, so the rate-limit increment commits with the failed attempt.

CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_code        text;
  v_referrer    uuid;
  v_created_at  timestamptz;
  v_my_email    text;
  v_their_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT increment_rate_limit('referral_redeem:' || v_uid::text, 10, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  END IF;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF v_code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REFERRED');
  END IF;

  SELECT user_id INTO v_referrer FROM referral_codes WHERE code = v_code;
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;
  IF v_referrer = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWN_CODE');
  END IF;

  SELECT created_at, email INTO v_created_at, v_my_email FROM auth.users WHERE id = v_uid;
  SELECT email INTO v_their_email FROM auth.users WHERE id = v_referrer;
  IF fluenci_normalize_email(v_my_email) IS NOT NULL
     AND fluenci_normalize_email(v_my_email) = fluenci_normalize_email(v_their_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWN_CODE');
  END IF;

  -- A referral is for bringing in someone new. Anyone who has already paid
  -- on any store, or signed up long ago, cannot be claimed after the fact.
  IF EXISTS (SELECT 1 FROM store_subscription_identities WHERE user_id = v_uid AND paid_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM subscriptions WHERE user_id = v_uid AND stripe_subscription_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_SUBSCRIBED');
  END IF;
  IF v_created_at < now() - fluenci_referral_attach_window() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TOO_LATE');
  END IF;

  BEGIN
    INSERT INTO referrals (referrer_id, referee_id, code) VALUES (v_referrer, v_uid, v_code);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REFERRED');
  END;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ─── Client RPC: the invite screen ───────────────────────────────────────
-- Counts and reward rows only. No referee ids, names or emails leave here.

CREATE OR REPLACE FUNCTION public.get_my_referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_redeemable boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT created_at INTO v_created_at FROM auth.users WHERE id = v_uid;
  v_redeemable :=
    NOT EXISTS (SELECT 1 FROM referrals WHERE referee_id = v_uid)
    AND NOT EXISTS (SELECT 1 FROM store_subscription_identities WHERE user_id = v_uid AND paid_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = v_uid AND stripe_subscription_id IS NOT NULL)
    AND v_created_at >= now() - fluenci_referral_attach_window();

  RETURN jsonb_build_object(
    'code', get_my_referral_code(),
    'joined',   (SELECT count(*) FROM referrals WHERE referrer_id = v_uid AND status <> 'void'),
    'waiting',  (SELECT count(*) FROM referrals WHERE referrer_id = v_uid AND status = 'attached'),
    'subscribed', (SELECT count(*) FROM referrals WHERE referrer_id = v_uid AND status IN ('qualified','capped','rewarded')),
    'has_referrer', EXISTS (SELECT 1 FROM referrals WHERE referee_id = v_uid),
    'can_redeem', v_redeemable,
    'annual_cap', fluenci_referral_annual_cap(),
    'rewards', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id,
               'status', r.status,
               'available_at', r.available_at,
               'delivered_at', r.delivered_at,
               'method', r.method,
               'days', r.days
             ) ORDER BY r.created_at DESC)
        FROM (SELECT * FROM referral_rewards WHERE referrer_id = v_uid
               ORDER BY created_at DESC LIMIT 50) r
    ), '[]'::jsonb)
  );
END $$;

-- ─── Service RPC: every RevenueCat event passes through here ─────────────
-- Records the store identity, qualifies a pending referral on the referee's
-- first real payment, and voids a held reward on a refund. Idempotent: a
-- redelivered event finds the referral already moved on and does nothing.

CREATE OR REPLACE FUNCTION public.record_referral_store_event(
  p_user_id                 uuid,
  p_event_id                text,
  p_event_type              text,
  p_store                   text,
  p_environment             text,
  p_original_transaction_id text,
  p_product_id              text,
  p_period_type             text,
  p_price                   numeric,
  p_expires_at              timestamptz,
  p_is_revocation           boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid     boolean;
  v_referral referrals%ROWTYPE;
  v_recent   integer;
  v_outcome  text := 'none';
BEGIN
  IF p_user_id IS NULL OR coalesce(p_store, '') = '' THEN
    RETURN jsonb_build_object('outcome', 'skipped');
  END IF;

  -- Real money: a store that bills, a positive price, not a trial and not a
  -- RevenueCat promotional grant (which is how referral rewards themselves
  -- arrive — a reward must never qualify another referral).
  v_paid := p_store IN ('APP_STORE','MAC_APP_STORE','PLAY_STORE','STRIPE','RC_BILLING','AMAZON')
            AND coalesce(p_price, 0) > 0
            AND coalesce(p_period_type, '') NOT IN ('TRIAL','PROMOTIONAL')
            AND p_event_type IN ('INITIAL_PURCHASE','RENEWAL','NON_RENEWING_PURCHASE','PRODUCT_CHANGE')
            AND NOT coalesce(p_is_revocation, false);

  INSERT INTO store_subscription_identities AS s
    (user_id, store, original_transaction_id, product_id, environment, expires_at, paid_at, updated_at)
  VALUES
    (p_user_id, p_store, p_original_transaction_id, p_product_id, p_environment, p_expires_at,
     CASE WHEN v_paid THEN now() END, now())
  ON CONFLICT (user_id, store) DO UPDATE SET
    original_transaction_id = coalesce(EXCLUDED.original_transaction_id, s.original_transaction_id),
    product_id  = coalesce(EXCLUDED.product_id, s.product_id),
    environment = coalesce(EXCLUDED.environment, s.environment),
    -- Deliveries are unordered; only a revocation may pull the end backwards.
    expires_at  = CASE
                    WHEN p_is_revocation THEN EXCLUDED.expires_at
                    WHEN s.expires_at IS NULL THEN EXCLUDED.expires_at
                    WHEN EXCLUDED.expires_at IS NULL THEN s.expires_at
                    ELSE greatest(s.expires_at, EXCLUDED.expires_at)
                  END,
    paid_at     = coalesce(s.paid_at, EXCLUDED.paid_at),
    updated_at  = now();

  IF v_paid THEN
    SELECT * INTO v_referral FROM referrals
     WHERE referee_id = p_user_id AND status = 'attached'
     FOR UPDATE;
    IF FOUND THEN
      IF p_original_transaction_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM store_subscription_identities
            WHERE user_id = v_referral.referrer_id
              AND store = p_store
              AND original_transaction_id = p_original_transaction_id) THEN
        -- Same Apple ID / Google account on both sides: one person, two logins.
        UPDATE referrals SET status = 'void', void_reason = 'same_store_account',
               qualified_at = now(), qualifying_event_id = p_event_id
         WHERE id = v_referral.id;
        v_outcome := 'void_same_account';
      ELSE
        SELECT count(*) INTO v_recent FROM referral_rewards
         WHERE referrer_id = v_referral.referrer_id
           AND status <> 'void'
           AND created_at > now() - interval '365 days';
        IF v_recent >= fluenci_referral_annual_cap() THEN
          UPDATE referrals SET status = 'capped', qualified_at = now(), qualifying_event_id = p_event_id
           WHERE id = v_referral.id;
          v_outcome := 'capped';
        ELSE
          UPDATE referrals SET status = 'qualified', qualified_at = now(), qualifying_event_id = p_event_id
           WHERE id = v_referral.id;
          INSERT INTO referral_rewards (referral_id, referrer_id, available_at)
          VALUES (v_referral.id, v_referral.referrer_id, now() + fluenci_referral_hold())
          ON CONFLICT (referral_id) DO NOTHING;
          v_outcome := 'qualified';
        END IF;
      END IF;
    END IF;
  END IF;

  IF coalesce(p_is_revocation, false) THEN
    -- Refund or chargeback inside the hold: the reward goes with the money.
    -- A reward already delivered stays delivered; Apple extensions cannot be
    -- reversed, and the hold exists so that this is rare.
    UPDATE referral_rewards rw SET status = 'void', last_error = 'referee_refunded'
      FROM referrals rf
     WHERE rw.referral_id = rf.id
       AND rf.referee_id = p_user_id
       AND rw.status IN ('holding','ready');
    IF FOUND THEN
      UPDATE referrals SET status = 'void', void_reason = 'referee_refunded'
       WHERE referee_id = p_user_id AND status = 'qualified';
      v_outcome := 'voided_on_refund';
    END IF;
  END IF;

  RETURN jsonb_build_object('outcome', v_outcome);
END $$;

-- ─── Service RPC: the worker picks up what is due ────────────────────────
-- Moves held rewards past their hold to 'ready', re-offers deliveries whose
-- worker died mid-flight, then opens at most one delivery per referrer.
-- The delivery method is decided HERE, from what the referrer is paying for
-- at delivery time, not when the friend subscribed.

CREATE OR REPLACE FUNCTION public.claim_referral_deliveries(
  p_apple_enabled boolean,
  p_limit         integer DEFAULT 25
)
RETURNS SETOF public.referral_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer  uuid;
  v_apple     store_subscription_identities%ROWTYPE;
  v_other     boolean;
  v_used      integer;
  v_per_days  integer;
  v_ids       uuid[];
  v_days      integer;
  v_delivery  referral_deliveries%ROWTYPE;
  v_reward    record;
BEGIN
  UPDATE referral_rewards SET status = 'ready'
   WHERE status = 'holding' AND available_at <= now();

  -- A worker that crashed between the external call and the finish leaves a
  -- 'pending' delivery. Re-offer it with the SAME id: Apple dedupes on the
  -- request identifier, and the promo end time is already fixed.
  RETURN QUERY
    UPDATE referral_deliveries
       SET claimed_at = now(), attempts = attempts + 1
     WHERE id IN (SELECT id FROM referral_deliveries
                   WHERE status = 'pending' AND claimed_at < now() - interval '15 minutes'
                   ORDER BY claimed_at LIMIT p_limit
                   FOR UPDATE SKIP LOCKED)
    RETURNING *;

  FOR v_referrer IN
    SELECT rw.referrer_id
      FROM referral_rewards rw
     WHERE rw.status = 'ready'
       AND NOT EXISTS (SELECT 1 FROM referral_deliveries d
                        WHERE d.referrer_id = rw.referrer_id AND d.status = 'pending')
     GROUP BY rw.referrer_id
     ORDER BY min(rw.available_at)
     LIMIT p_limit
  LOOP
    -- One worker per referrer at a time.
    IF NOT pg_try_advisory_xact_lock(hashtext('referral_delivery:' || v_referrer::text)) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_apple FROM store_subscription_identities
     WHERE user_id = v_referrer AND store = 'APP_STORE'
       AND paid_at IS NOT NULL AND original_transaction_id IS NOT NULL
       AND expires_at > now();

    v_other := EXISTS (SELECT 1 FROM store_subscription_identities
                        WHERE user_id = v_referrer
                          AND store NOT IN ('APP_STORE','PROMOTIONAL')
                          AND paid_at IS NOT NULL AND expires_at > now());

    v_ids := '{}';
    v_days := 0;

    IF v_apple.user_id IS NOT NULL THEN
      IF NOT p_apple_enabled THEN CONTINUE; END IF;
      -- Apple allows two extensions per subscription per 365 days. Past that
      -- the rewards wait; once the subscription lapses they become Premium
      -- promo time on a later run.
      SELECT count(*) INTO v_used FROM referral_deliveries
       WHERE method = 'apple_extension' AND status = 'succeeded'
         AND original_transaction_id = v_apple.original_transaction_id
         AND completed_at > now() - interval '365 days';
      IF v_used >= 2 THEN CONTINUE; END IF;

      -- VIP earns half a month (the value of 50% off); Basic/Premium a month.
      v_per_days := CASE WHEN v_apple.product_id ILIKE '%vip%' THEN 15 ELSE 30 END;
      FOR v_reward IN
        SELECT id FROM referral_rewards
         WHERE referrer_id = v_referrer AND status = 'ready'
         ORDER BY available_at
         FOR UPDATE SKIP LOCKED
      LOOP
        EXIT WHEN v_days + v_per_days > 90;
        v_ids := v_ids || v_reward.id;
        v_days := v_days + v_per_days;
      END LOOP;
      IF v_days = 0 THEN CONTINUE; END IF;

      INSERT INTO referral_deliveries (referrer_id, method, days, original_transaction_id, environment)
      VALUES (v_referrer, 'apple_extension', v_days, v_apple.original_transaction_id, v_apple.environment)
      RETURNING * INTO v_delivery;
      UPDATE referral_rewards SET status = 'delivering', delivery_id = v_delivery.id,
             method = 'apple_extension', days = v_per_days
       WHERE id = ANY (v_ids);
      RETURN NEXT v_delivery;

    ELSIF v_other THEN
      -- Google Play / web billing: no automated path is built for these
      -- rails yet (the app sells through the App Store only). Park the
      -- rewards where support can see them rather than lose them.
      UPDATE referral_rewards SET status = 'needs_attention', last_error = 'unsupported_store'
       WHERE referrer_id = v_referrer AND status = 'ready';

    ELSE
      FOR v_reward IN
        SELECT id FROM referral_rewards
         WHERE referrer_id = v_referrer AND status = 'ready'
         ORDER BY available_at
         LIMIT fluenci_referral_annual_cap()
         FOR UPDATE SKIP LOCKED
      LOOP
        v_ids := v_ids || v_reward.id;
        v_days := v_days + 30;
      END LOOP;
      IF v_days = 0 THEN CONTINUE; END IF;

      INSERT INTO referral_deliveries (referrer_id, method, days)
      VALUES (v_referrer, 'revenuecat_promo', v_days)
      RETURNING * INTO v_delivery;
      UPDATE referral_rewards SET status = 'delivering', delivery_id = v_delivery.id,
             method = 'revenuecat_promo', days = 30
       WHERE id = ANY (v_ids);
      RETURN NEXT v_delivery;
    END IF;
  END LOOP;
END $$;

-- ─── Service RPC: fix a promo delivery's end time before calling out ─────
-- First caller wins; every retry reads back the same value.

CREATE OR REPLACE FUNCTION public.set_referral_promo_target(p_delivery_id uuid, p_end_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE referral_deliveries
     SET promo_end_at = coalesce(promo_end_at, p_end_at)
   WHERE id = p_delivery_id AND method = 'revenuecat_promo' AND status = 'pending'
  RETURNING promo_end_at;
$$;

-- ─── Service RPC: record how a delivery went ─────────────────────────────

CREATE OR REPLACE FUNCTION public.finish_referral_delivery(
  p_delivery_id  uuid,
  p_success      boolean,
  p_external_ref text,
  p_error        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery referral_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_delivery FROM referral_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.status <> 'pending' THEN
    RETURN;  -- already settled by an earlier attempt
  END IF;

  IF p_success THEN
    UPDATE referral_deliveries
       SET status = 'succeeded', completed_at = now(), external_ref = left(p_external_ref, 200), error = NULL
     WHERE id = p_delivery_id;
    UPDATE referral_rewards SET status = 'delivered', delivered_at = now(), last_error = NULL
     WHERE delivery_id = p_delivery_id AND status = 'delivering';
    UPDATE referrals SET status = 'rewarded'
     WHERE id IN (SELECT referral_id FROM referral_rewards WHERE delivery_id = p_delivery_id)
       AND status = 'qualified';

    -- Promotional access has to reach the server-side quota source too. The
    -- RevenueCat webhook may also report it; both writes agree. Only ever
    -- lengthens: never shortens a period, never downgrades a VIP.
    IF v_delivery.method = 'revenuecat_promo' AND v_delivery.promo_end_at IS NOT NULL THEN
      INSERT INTO subscriptions AS s (user_id, tier, is_active, subscription_status, current_period_end, cancel_at_period_end)
      VALUES (v_delivery.referrer_id, 'premium', true, 'active', v_delivery.promo_end_at, false)
      ON CONFLICT (user_id) DO UPDATE SET
        tier = CASE WHEN s.is_active AND s.current_period_end > now() AND s.tier = 'vip' THEN s.tier ELSE 'premium' END,
        is_active = true,
        subscription_status = 'active',
        current_period_end = greatest(coalesce(s.current_period_end, EXCLUDED.current_period_end), EXCLUDED.current_period_end),
        cancel_at_period_end = false,
        updated_at = now();
    END IF;
  ELSE
    UPDATE referral_deliveries
       SET status = 'failed', completed_at = now(), error = left(p_error, 500)
     WHERE id = p_delivery_id;
    -- Back in the queue; five strikes and a human looks at it.
    UPDATE referral_rewards
       SET attempts = attempts + 1,
           last_error = left(p_error, 500),
           delivery_id = NULL,
           method = NULL,
           days = NULL,
           status = CASE WHEN attempts + 1 >= 5 THEN 'needs_attention' ELSE 'ready' END
     WHERE delivery_id = p_delivery_id AND status = 'delivering';
  END IF;
END $$;

-- ─── Privileges ──────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_my_referral_code()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_referral_code(text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_referral_summary()        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_summary()     TO authenticated;

REVOKE ALL ON FUNCTION public.record_referral_store_event(uuid, text, text, text, text, text, text, text, numeric, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_referral_deliveries(boolean, integer)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_referral_promo_target(uuid, timestamptz)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_referral_delivery(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_referral_store_event(uuid, text, text, text, text, text, text, text, numeric, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_referral_deliveries(boolean, integer)    TO service_role;
GRANT EXECUTE ON FUNCTION public.set_referral_promo_target(uuid, timestamptz)   TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_referral_delivery(uuid, boolean, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.fluenci_normalize_email(text) FROM PUBLIC, anon, authenticated;

-- ─── Schedule ────────────────────────────────────────────────────────────
-- Hourly is plenty against a 7-day hold. Same Vault cron secret as the other
-- workers. Apply only AFTER the referral-rewards function is deployed, or
-- every tick 404s until it is.
SELECT cron.unschedule('fluenci-referral-rewards')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fluenci-referral-rewards');
SELECT cron.schedule(
  'fluenci-referral-rewards',
  '23 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngqpsuixmumdnqbqxjxv.supabase.co/functions/v1/referral-rewards',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1
      )
    ),
    body := jsonb_build_object('trigger', 'pg_cron')
  )
  $cron$
);
