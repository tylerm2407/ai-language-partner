-- 086 — Wrap bare `auth.uid()` in every RLS policy that still uses it.
--
-- CLAUDE.md §4 mandates `(select auth.uid())`, not bare `auth.uid()`:
--
--   > bare `auth.uid()` is re-evaluated per row (it parses the JWT claims JSON
--   > each time) and can stop the planner using a `user_id` index as an index
--   > qual. The `select` wrapper makes it a once-per-query InitPlan.
--
-- Migration 058 fixed the missing `TO authenticated` clauses but never applied
-- the wrapper. 41 policies across 23 tables were still bare, including the ones
-- on the hottest per-learner reads: `review_items`, `review_logs`,
-- `lesson_completions`, `chat_messages`, `user_profiles`. On `chat_messages`
-- the predicate is a subquery against `chat_sessions`, so a bare `auth.uid()`
-- there is re-parsed once per message row.
--
-- WHY THIS IS GENERATED RATHER THAN 41 HAND-WRITTEN POLICIES
--
-- The rewrite must preserve each policy's command, roles, USING and WITH CHECK
-- *exactly* — the only intended change is the wrapper. Transcribing 41 policies
-- by hand is precisely how an access set gets altered by accident, and several
-- of these carry non-trivial predicates (an EXISTS against
-- `organization_members`, an IN against `chat_sessions`). Reading them back out
-- of `pg_policies` and re-emitting them cannot drift.
--
-- The block is idempotent: it skips any policy whose expression already
-- contains `select auth.uid()`, so re-running it is a no-op.
--
-- NOT changed here, deliberately:
--   * No policy is added, removed, or re-scoped. `pg_policies` is the source
--     and the target.
--   * `FOR UPDATE` policies without an explicit WITH CHECK keep that shape.
--     Postgres falls back to USING for the new row, and USING is
--     `auth.uid() = user_id`, so the row still cannot be reassigned to another
--     user. Adding an explicit clause would be a behaviour change, not a
--     mechanical rewrite.
--   * Verified before writing this: zero `FOR ALL` policies lack a WITH CHECK,
--     so the migration-057 self-grant class is already closed.

DO $$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '(^|[^.a-z_])auth\.uid\(\)'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~* 'select\s+auth\.uid\(\)'
    ORDER BY tablename, policyname
  LOOP
    v_using := CASE
      WHEN r.qual IS NULL THEN NULL
      ELSE regexp_replace(r.qual, '(^|[^.a-zA-Z_])auth\.uid\(\)', '\1(select auth.uid())', 'g')
    END;
    v_check := CASE
      WHEN r.with_check IS NULL THEN NULL
      ELSE regexp_replace(r.with_check, '(^|[^.a-zA-Z_])auth\.uid\(\)', '\1(select auth.uid())', 'g')
    END;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
      r.policyname,
      r.tablename,
      r.cmd,
      replace(replace(r.roles, '{', ''), '}', ''),
      CASE WHEN v_using IS NULL THEN '' ELSE ' USING (' || v_using || ')' END,
      CASE WHEN v_check IS NULL THEN '' ELSE ' WITH CHECK (' || v_check || ')' END
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'rewrote % policies to use (select auth.uid())', v_count;
END $$;
