-- 056_api_cache_lockdown_and_duplicate_policies.sql
--
-- ─── 1. SECURITY: api_cache was world-writable ───────────────────────────
--
-- The policy was named "Allow service role full access to cache" but was
-- declared FOR ALL TO public USING (true) WITH CHECK (true). The name is a lie:
-- `public` means EVERY role, so any authenticated (or anon) user could read,
-- update, and delete the whole table through PostgREST.
--
-- That matters because api_cache is the burst rate-limit store. increment_rate_limit()
-- keeps its counter in api_cache.data->>'count' under the key `burst:<action>:<user_id>`.
-- So any signed-in user could run
--     update api_cache set data = '{"count":0}' where cache_key = 'burst:ai-chat:<own uuid>'
-- and reset their own burst window at will — defeating every burst limit on the
-- AI endpoints, and letting them clear other users' windows too.
--
-- Nothing outside service-role code touches this table (only
-- _shared/burst-limit.ts, via the SECURITY DEFINER RPC). service_role bypasses
-- RLS entirely, so the correct state is RLS enabled with NO policies — exactly
-- how hint_cache and translation_cache are already configured.
DROP POLICY IF EXISTS "Allow service role full access to cache" ON public.api_cache;
-- Redundant even before that: service_role bypasses RLS, so a policy gating on
-- auth.role() = 'service_role' can never be the thing granting it access.
DROP POLICY IF EXISTS "Service role select on api_cache" ON public.api_cache;

-- ─── 2. Byte-identical duplicate policies ────────────────────────────────
-- Each pair below has the same command, same role, and the same USING/WITH CHECK
-- expression — the result of similar migrations being applied twice under
-- slightly different names. Permissive policies are OR'd, so dropping one of
-- each pair cannot change who can see what; it only stops Postgres evaluating
-- the same predicate twice per row.
DROP POLICY IF EXISTS "Authenticated users can read cards"     ON public.cards;
DROP POLICY IF EXISTS "Authenticated users can read courses"   ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can read exercises" ON public.exercises;
DROP POLICY IF EXISTS "Authenticated users can read lessons"   ON public.lessons;
DROP POLICY IF EXISTS "Authenticated users can read units"     ON public.units;

-- Same predicate, but these four lacked an explicit WITH CHECK. For a FOR ALL
-- policy Postgres falls back to the USING expression as the check, so the pair
-- is functionally identical — keep the one that states the check explicitly.
DROP POLICY IF EXISTS "Users manage own daily stats"     ON public.daily_stats;
DROP POLICY IF EXISTS "Users manage own sessions"        ON public.practice_sessions;
DROP POLICY IF EXISTS "Users manage own reviews"         ON public.review_items;
DROP POLICY IF EXISTS "Users manage own review logs"     ON public.review_logs;
