-- 057_lock_down_subscriptions_writes.sql
--
-- SECURITY: any authenticated user could grant themselves the top paid tier.
--
-- The policy "Users read own subscription" was declared FOR ALL with
-- USING (auth.uid() = user_id) and NO WITH CHECK. For a FOR ALL policy Postgres
-- falls back to the USING expression as the check — and that expression stays
-- true when you change your own row's `tier`, because it only constrains
-- `user_id`. Combined with table-level INSERT/UPDATE grants to `authenticated`
-- and no trigger on the table, this was directly exploitable:
--
--     update subscriptions
--        set tier = 'vip', is_active = true, current_period_end = '2099-01-01'
--      where user_id = auth.uid();
--
-- get_effective_limits() reads that row to decide daily AI quotas, so a user
-- could self-grant unlimited paid-model usage. Same class of hole as the
-- daily_usage one closed in migration 050 — this is the write side of it.
--
-- The client only ever SELECTs this table (fetchSubscription in
-- lib/supabase-queries.ts). Every write comes from the Stripe / RevenueCat
-- webhooks running as service_role, which bypasses RLS entirely.

-- 1. Remove the writable owner policy.
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;

-- 2. Keep read access, scoped to signed-in users only.
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 3. Belt and braces: remove the table-level write grants so no future
--    permissive policy can re-open this path by accident.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
