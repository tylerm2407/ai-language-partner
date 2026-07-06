-- ═══════════════════════════════════════════════════════════════
-- 046: Idempotent XP awards — offline-queue replay safety
--
-- The offline write queue (lib/offline-queue.ts) replays XP awards after
-- a network blip. increment_xp (migration 036 §3) is NOT idempotent: a
-- lost-response retry would double-award. This migration adds a per-user
-- idempotency ledger (client_events) and increment_xp_idempotent
-- (p_amount, p_key): the first call with a given key grants XP through
-- the exact same guarded path increment_xp uses; any replay of the same
-- key is a no-op that returns the current total_xp unchanged.
--
-- ⚠ ORCHESTRATOR NOTE — prod drift check BEFORE applying:
--   Prod function bodies have drifted from migration files before (see
--   044's increment_daily_usage note: prod had lost the 031 caller
--   guard). The XP-grant path below is copied from migration 036 §3
--   increment_xp, which assumes:
--     • amount validation / per-call cap: 1..500
--     • transaction-local GUC fluenci.gamification_write = '1' is what
--       the lockdown trigger (036 §2) recognizes
--     • total_xp += amount; xp_level via fluenci_level_for_xp;
--       league_tier via fluenci_league_for_level; updated_at = now()
--   Run against prod:
--     SELECT pg_get_functiondef('public.increment_xp(uuid, integer)'::regprocedure);
--   and diff it against 036 §3. If prod's increment_xp has drifted
--   (different cap, extra columns, changed derivation, different GUC),
--   mirror the PROD grant path here before applying.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Idempotency ledger ──
-- RPC-only access: RLS is enabled with NO policies, so PostgREST clients
-- can neither read nor write rows directly; the SECURITY DEFINER RPC
-- below (function owner bypasses RLS) is the only access path.
CREATE TABLE IF NOT EXISTS public.client_events (
  user_id    uuid        NOT NULL,
  event_key  text        NOT NULL CHECK (char_length(event_key) BETWEEN 8 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_key)
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

-- ── 2. increment_xp_idempotent ──
CREATE OR REPLACE FUNCTION public.increment_xp_idempotent(p_amount integer, p_key text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted boolean;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid XP amount (1-500)' USING ERRCODE = '22023';
  END IF;
  IF p_key IS NULL OR char_length(p_key) < 8 OR char_length(p_key) > 128 THEN
    RAISE EXCEPTION 'invalid idempotency key (8-128 chars)' USING ERRCODE = '22023';
  END IF;

  -- Claim the key and grant in ONE transaction. A concurrent duplicate
  -- blocks on the PK insert until the first call commits, then hits the
  -- conflict and takes the replay path — so the grant runs at most once
  -- per (user, key) even under concurrent retries.
  INSERT INTO public.client_events (user_id, event_key)
  VALUES (v_uid, p_key)
  ON CONFLICT (user_id, event_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    -- Replay: XP for this key was already granted — return the total unchanged.
    SELECT p.total_xp INTO v_new_xp
      FROM public.user_profiles p
     WHERE p.user_id = v_uid;
    RETURN COALESCE(v_new_xp, 0);
  END IF;

  -- Grant XP through the exact same guarded path increment_xp uses
  -- (migration 036 §3): GUC recognized by the lockdown trigger, same
  -- level/league derivation.
  PERFORM set_config('fluenci.gamification_write', '1', true);

  UPDATE public.user_profiles
     SET total_xp    = total_xp + p_amount,
         xp_level    = public.fluenci_level_for_xp(total_xp + p_amount),
         league_tier = public.fluenci_league_for_level(public.fluenci_level_for_xp(total_xp + p_amount)),
         updated_at  = now()
   WHERE user_id = v_uid
   RETURNING total_xp INTO v_new_xp;

  RETURN COALESCE(v_new_xp, 0);
END;
$$;

-- ── 3. Grants (house style: migrations 036/043/044) ──
REVOKE ALL ON FUNCTION public.increment_xp_idempotent(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_xp_idempotent(integer, text) TO authenticated;
