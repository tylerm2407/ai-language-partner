-- 070_close_dead_write_policies.sql
--
-- Closes four client-write surfaces that no client code uses, plus the dead
-- function that would break under the daily_stats revoke.
--
-- Found by the 2026-08-24 security audit. The unifying defect is not a broken
-- policy — every policy here evaluates correctly. It is that correctly-guarded
-- RPCs read their trust inputs from tables the client can freely write. The
-- migration-036 trigger blocks writing `streak` directly; nobody extended that
-- reasoning to `daily_stats`, which is what `update_streak()` derives it from.
--
-- Every DROP below was proven unused by a write-verb sweep across app/,
-- components/, lib/, stores/, hooks/, scripts/ AND lib/offline-queue.ts (whose
-- replay paths a static screen grep misses). Edge functions are unaffected:
-- they use the service role, which bypasses RLS entirely.
--
-- Rollback is at the bottom of this file.

-- ---------------------------------------------------------------------------
-- P1 · classroom_enrollments — direct insert bypassed every admission control
--
-- The policy checked only invite_code_active and archived. The `school` edge
-- function (index.ts:194-247) additionally enforces the invite code itself, org
-- is_active, the seat limit against organizations.max_seats, and the
-- institutional email-domain allowlist. Anyone holding a classroom UUID could
-- enrol without a matching @institution.edu address, without consuming a seat,
-- and without appearing on the org roster — then read the classroom's
-- invite_code. For a university pilot the domain allowlist IS the access
-- control, so this was a real authorization gap.
--
-- Client is SELECT-only on this table (supabase-queries.ts:2802, 2997, 3011).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can insert own enrollments" ON public.classroom_enrollments;

-- ---------------------------------------------------------------------------
-- P2 · classrooms — any authenticated user could create a classroom in any org
--
-- WITH CHECK was only (teacher_id = auth.uid()); nothing tied organization_id
-- to the caller. A student knowing their own org UUID could self-promote to
-- teacher_id of a classroom that org admins see, that seat accounting counts,
-- and in which they could create assignments. No cross-tenant read — that still
-- requires an organization_members row, which has no INSERT policy.
--
-- Classroom creation is service-role only (school/index.ts:162-174).
-- Client is SELECT-only (supabase-queries.ts:2788).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teachers can insert own classrooms" ON public.classrooms;

-- ---------------------------------------------------------------------------
-- P2 · lesson_completions — drop ONLY the FOR ALL
--
-- The FOR ALL granted exactly one capability the three narrower policies do
-- not: DELETE, which nothing uses. It also silently superseded them, which the
-- advisor reports three times as multiple_permissive_policies.
--
-- DO NOT ALSO DROP "Users can update own completions". upsertLessonCompletion()
-- (supabase-queries.ts:1184) compiles to INSERT ... ON CONFLICT (user_id,
-- lesson_id) DO UPDATE, and Postgres requires an UPDATE policy for the conflict
-- branch. Dropping it fails every repeat of an already-completed lesson — and
-- because offline-queue.ts:311-321 replays completions through the same
-- function, a throw there stalls the queue flush and every later queued item
-- behind it, including xp-award. That is a silent, compounding failure.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own lesson completions" ON public.lesson_completions;

-- ---------------------------------------------------------------------------
-- P1 · daily_stats — the derivation source for streaks
--
-- update_streak() counts consecutive active days out of daily_stats, then
-- writes user_profiles.streak / longest_streak through the lockdown trigger's
-- own GUC bypass. With the table client-writable, backfilling a year of rows
-- and calling the RPC produced a 365-day streak that repair_streak_with_freeze
-- then makes sticky. try_consume_new_card_slot() also counts against
-- daily_stats.cards_learned, so the free-tier new-card cap was resettable.
--
-- All legitimate writes already go through SECURITY DEFINER RPCs, verified
-- against live pg_proc: upsert_daily_stats (prosecdef = true) and
-- try_consume_new_card_slot (prosecdef = true). Neither is affected by the
-- revoke. Client is SELECT-only (supabase-queries.ts:606, 669, 741).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own daily stats" ON public.daily_stats;

CREATE POLICY "Users can read own daily stats" ON public.daily_stats
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.daily_stats FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- increment_daily_stats — dead, and broken-by-design after the revoke above
--
-- SECURITY INVOKER (prosecdef = false), so it executes with the caller's
-- privileges and the revoke would leave it permanently failing. Zero call sites
-- across the client tree and supabase/functions. Superseded by
-- upsert_daily_stats. Dropping it rather than leaving an anon-executable
-- function that can only ever error.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_daily_stats(
  uuid, date, integer, integer, integer, real, real, real, real, real, integer, integer, integer);

-- ---------------------------------------------------------------------------
-- ROLLBACK
--
-- Symptom of a bad drop is a 42501 RLS error on a write. Restore with:
--
--   CREATE POLICY "Students can insert own enrollments" ON public.classroom_enrollments
--     FOR INSERT TO authenticated
--     WITH CHECK ((student_id = auth.uid()) AND (EXISTS (
--       SELECT 1 FROM classrooms c
--        WHERE c.id = classroom_enrollments.classroom_id
--          AND c.invite_code_active = true AND c.archived = false)));
--
--   CREATE POLICY "Teachers can insert own classrooms" ON public.classrooms
--     FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
--
--   CREATE POLICY "Users can manage own lesson completions" ON public.lesson_completions
--     FOR ALL TO authenticated
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--
--   DROP POLICY "Users can read own daily stats" ON public.daily_stats;
--   CREATE POLICY "Users can manage own daily stats" ON public.daily_stats
--     FOR ALL TO authenticated
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--   GRANT INSERT, UPDATE, DELETE ON public.daily_stats TO anon, authenticated;
--
-- increment_daily_stats is not restored — it is dead and was broken by the
-- revoke; recover from migration history if ever genuinely needed.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- DELIBERATELY NOT IN THIS MIGRATION
--
-- daily_challenges (unbounded XP mint, ~100 XP per two-request loop):
-- claim_daily_challenge_bonus() trusts all_completed, bonus_xp_claimed and
-- challenge_streak, all client-writable. It cannot be fixed from SQL alone —
-- useDailyChallenges.ts:59 sets challenge_streak from a client-computed carried
-- value on insert, and :92 echoes bonus_xp_claimed/challenge_streak back on
-- every progress update. Both a guard trigger and column-level grants would
-- break the feature unless the client stops writing those columns in the same
-- change. Needs a paired app + DB change; tracked separately.
-- ---------------------------------------------------------------------------
