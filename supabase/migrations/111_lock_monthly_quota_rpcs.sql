-- 111 — Lock the monthly quota RPCs to the service role.
--
-- Found by the Supabase advisor while adding the tutor spend ceiling (109).
--
-- consume_monthly_quota and refund_monthly_quota have been EXECUTE-able by the
-- `authenticated` role since migration 105, and reachable over PostgREST at
-- /rest/v1/rpc/refund_monthly_quota. Their DAILY siblings were revoked when
-- they were written; the monthly pair was not, and nobody noticed because the
-- only counter was avatars_generated and self-refunding three avatars a month
-- is cheap enough to hide.
--
-- Migration 109 changed the stakes. `tutor_cents` is now on that whitelist, and
-- it is not a feature counter — it IS the per-user monthly spend ceiling, the
-- single mechanism guaranteeing the live tutor cannot run margin-negative. A
-- signed-in learner could call:
--
--     POST /rest/v1/rpc/refund_monthly_quota
--     { "p_user_id": "<their own id>", "p_counter": "tutor_cents",
--       "p_amount": 999999 }
--
-- and reset their own ceiling to zero as often as they liked. GREATEST(0, ...)
-- floors it at zero, so this is not even a subtle abuse — it is unlimited
-- Realtime spend for the price of one HTTP call. Exactly the class of hole
-- CLAUDE.md section 1.2 exists to prevent: anything with economic meaning is
-- written server-side, never by the client.
--
-- The only legitimate caller is generate-avatar/index.ts:182, which runs with
-- the service role and is unaffected. tutor-session will do the same.
--
-- fluenci_user_month is revoked from anon for consistency with
-- fluenci_user_today, which never granted it. It only returns a date, so this
-- is tidying rather than a fix.
--
-- Applied to production 2026-09-06.

REVOKE EXECUTE ON FUNCTION public.consume_monthly_quota(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_monthly_quota(uuid, text, integer, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.refund_monthly_quota(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_monthly_quota(uuid, text, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.fluenci_user_month(uuid) FROM anon;
