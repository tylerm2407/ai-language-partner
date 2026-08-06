-- 054_revoke_anon_execute_on_internal_functions.sql
-- Clears the Supabase Security Advisor's `anon_security_definer_function_executable`
-- findings.
--
-- Two groups:
--
-- 1. Service-role-only helpers that were left executable by PUBLIC/anon/authenticated.
--    Both are called exclusively by Edge Functions using the service-role key
--    (_shared/burst-limit.ts, _shared/plan-limits.ts) — no client path exists.
--    `increment_rate_limit` is the worse of the two: its cache key is
--    `burst:<action>:<user_id>`, which is guessable, so an anonymous caller could
--    burn another user's burst window and lock them out of AI features.
--
-- 2. RLS predicate helpers. These must stay executable by `authenticated` because
--    RLS policy expressions are evaluated as the calling role, but `anon` never
--    has a legitimate reason to call them.
--
-- Not changed here: the gamification/quota RPCs (increment_xp, spend_heart,
-- update_streak, consume_daily_quota via service role, increment_daily_usage,
-- claim_daily_challenge_bonus, ...). The advisor also flags those as
-- authenticated-executable, but that is by design — each one carries its own
-- `auth.uid()` caller guard and clamping, and they are the sanctioned write path
-- for values the client is not allowed to write directly (migration 036).

-- ─── 1. Service-role only ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.increment_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_effective_limits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_limits(uuid) TO service_role;

-- ─── 2. RLS predicate helpers — anon has no business calling these ───────
REVOKE EXECUTE ON FUNCTION public.is_admin_of_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_enrolled_in_classroom(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_assignment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_chat_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_classroom(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin_of_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_classroom(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_chat_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_classroom(uuid) TO authenticated;

-- ─── 3. Clear a stale foreign-app artefact ───────────────────────────────
-- The table comment still read "CaseMate user legal profiles" — a leftover from
-- when this Postgres instance was shared with another NovaWealth app. The
-- columns are now entirely Fluenci's; only the comment survived.
COMMENT ON TABLE public.user_profiles IS 'Fluenci learner profile: language pair, CEFR level, gamification state (server-authoritative via RPCs, see migration 036), onboarding, and avatar config.';
