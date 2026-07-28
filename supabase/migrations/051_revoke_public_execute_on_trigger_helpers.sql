-- ═══════════════════════════════════════════════════════════════
-- 051: Revoke public EXECUTE on non-RPC helper functions
--
-- Supabase advisor lints 0028 / 0029 flagged two SECURITY DEFINER functions
-- as callable over /rest/v1/rpc/ by the anon and authenticated roles.
-- Neither is an application RPC:
--
--   handle_updated_at()  RETURNS trigger        -- trigger body only
--   rls_auto_enable()    RETURNS event_trigger  -- DDL event-trigger body only
--
-- Both carried a PUBLIC grant (=X/postgres in proacl), which is what actually
-- exposes them. Revoking anon/authenticated alone would leave EXECUTE
-- inherited through PUBLIC, so PUBLIC is revoked in the same statement.
--
-- Trigger invocation is unaffected: PostgreSQL checks EXECUTE on a trigger
-- function when the trigger is CREATED (by postgres, which keeps its explicit
-- grant), not on each firing. Event-trigger functions are likewise invoked by
-- the DDL event mechanism as the owner, never through a caller's EXECUTE
-- privilege. handle_updated_at backs 0 triggers in this database today.
--
-- SHARED PROJECT: this database also serves CostClarity and other NovaWealth
-- apps. postgres, service_role, and authenticator all keep their explicit
-- grants, so every app's migrations and edge functions are unaffected.
-- ═══════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.handle_updated_at()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
