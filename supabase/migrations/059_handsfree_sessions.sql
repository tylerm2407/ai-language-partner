-- Migration 059: Hands-free session records + idempotent review logs
--
-- Two unrelated-looking changes that ship together because hands-free needs
-- both and neither is useful alone.
--
-- 1. `handsfree_sessions`
--    Analytics for eyes-free commute sessions. Deliberately thin: ratings,
--    XP and SRS state all flow through the EXISTING review path, so this table
--    records only what is specific to the session itself — how long it was
--    meant to run, how long it actually ran, and why it stopped. It exists to
--    answer "does hands-free actually retain better?", which cannot be
--    answered from review_logs alone because those rows look identical
--    whichever surface produced them.
--
-- 2. `review_logs.client_log_id`
--    A commute goes through tunnels. Review writes are queued offline and
--    replayed on reconnect, but `review_logs` is an append-only INSERT with no
--    conflict target, so a retried flush inserts the same review twice —
--    corrupting accuracy history and the interleaving gate that reads it.
--    A client-generated id plus a partial unique index makes the insert
--    idempotent via ON CONFLICT DO NOTHING.
--
--    `text`, not `uuid`, on purpose: there is no UUID generator on the client
--    (expo-crypto is not installed, and adding a native dependency for this
--    would be absurd), so ids come from the same `randomId()` helper the
--    offline queue already uses.
--
-- Policies follow the tightened convention in CLAUDE.md §5: explicit per-verb
-- policies rather than FOR ALL, `TO authenticated`, and `(select auth.uid())`
-- wrapped so it is evaluated once per query rather than once per row.

-- ─── 1. Hands-free session records ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.handsfree_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  planned_duration_ms integer NOT NULL,
  actual_duration_ms  integer,
  items_attempted     integer NOT NULL DEFAULT 0,
  items_correct       integer NOT NULL DEFAULT 0,
  -- 'in_app' is all Phase A can produce. The other values are listed now so
  -- that adding lock-screen or CarPlay later is a code change, not a migration.
  surface             text NOT NULL DEFAULT 'in_app'
                        CHECK (surface IN ('in_app', 'lock_screen', 'carplay', 'android_auto')),
  ended_reason        text
                        CHECK (ended_reason IS NULL OR ended_reason IN
                          ('completed', 'user_ended', 'interrupted', 'error')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handsfree_sessions_user_started_idx
  ON public.handsfree_sessions (user_id, started_at DESC);

ALTER TABLE public.handsfree_sessions ENABLE ROW LEVEL SECURITY;

-- The client genuinely writes this one: a row is opened when the session
-- starts and closed when it ends. Nothing here has economic meaning — no tier,
-- no quota, no XP — so a client write is appropriate. Note there is
-- deliberately no DELETE policy: a learner editing their own session history
-- would make the retention question unanswerable.
DROP POLICY IF EXISTS "Users can read own handsfree sessions" ON public.handsfree_sessions;
CREATE POLICY "Users can read own handsfree sessions"
  ON public.handsfree_sessions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own handsfree sessions" ON public.handsfree_sessions;
CREATE POLICY "Users can insert own handsfree sessions"
  ON public.handsfree_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Both USING and WITH CHECK: USING decides which rows may be updated, WITH
-- CHECK decides what they may become. Supplying only USING would let a row be
-- updated to point at another user.
DROP POLICY IF EXISTS "Users can update own handsfree sessions" ON public.handsfree_sessions;
CREATE POLICY "Users can update own handsfree sessions"
  ON public.handsfree_sessions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMENT ON TABLE public.handsfree_sessions IS
  'One row per eyes-free commute session. Ratings and XP are NOT recorded here — they flow through the normal review path — so this table only carries session-shape data.';

-- ─── 2. Idempotent review logs ────────────────────────────────────────────

ALTER TABLE public.review_logs
  ADD COLUMN IF NOT EXISTS client_log_id text;

-- Partial, so the ~all existing rows with a NULL id do not collide with each
-- other. Scoped by user so two learners cannot interfere via a guessed id.
CREATE UNIQUE INDEX IF NOT EXISTS review_logs_user_client_log_id_idx
  ON public.review_logs (user_id, client_log_id)
  WHERE client_log_id IS NOT NULL;

COMMENT ON COLUMN public.review_logs.client_log_id IS
  'Client-generated id making an offline replay idempotent. NULL for rows written before migration 059 and for any online write that does not supply one.';
