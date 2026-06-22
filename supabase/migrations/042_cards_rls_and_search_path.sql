-- 042: Security hardening (MEDIUM cleanups + advisor warnings).
-- Applied to prod 2026-06-22 via Supabase MCP.
--
-- 1) cards INSERT was WITH CHECK (true) — any authenticated user could insert
--    rows into the shared content table. Cards are seed/AI-generated content
--    written by edge functions via the service role (which bypasses RLS), so
--    no client INSERT path is needed.
DROP POLICY IF EXISTS "Authenticated users can insert cards" ON public.cards;

-- 2) Pin search_path on functions flagged by the security advisor
--    (function_search_path_mutable).
ALTER FUNCTION public.generate_invite_code() SET search_path = public;
ALTER FUNCTION public.check_student_submission_update() SET search_path = public;
ALTER FUNCTION public.fluenci_guard_gamification() SET search_path = public;
ALTER FUNCTION public.fluenci_level_for_xp(integer) SET search_path = public;
ALTER FUNCTION public.fluenci_league_for_level(integer) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.increment_daily_stats(uuid, date, integer, integer, integer, real, real, real, real, real, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.increment_daily_usage(uuid, date, integer, real) SET search_path = public;
ALTER FUNCTION public.increment_daily_usage(uuid, date, integer, real, real) SET search_path = public;
ALTER FUNCTION public.increment_daily_usage(uuid, date, integer, real, real, integer, integer, integer) SET search_path = public;
