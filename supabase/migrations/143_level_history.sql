-- ─────────────────────────────────────────────────────────────────────────────
-- 143 — Level history: when the learner's measured band changed, and from what
--
-- WHY THIS TABLE EXISTS
--
-- The proficiency report has always been a snapshot. It answers "what am I?"
-- and has never been able to answer "am I moving?", which is the question a
-- learner actually asks on their fifth visit. Every visit looked identical
-- unless a band happened to flip that week, and a band flips rarely by design
-- (the interaction strand alone carries a twelve-day calendar term). So the one
-- surface in the app whose entire job is to show progress showed none.
--
-- One row per CHANGE, not per measurement. A daily snapshot of an unchanged
-- band would grow without bound and say nothing; the interesting event is the
-- transition, and `previous_band` keeps it readable without a self-join.
--
-- WHO MAY WRITE IT
--
-- Service role only. No policy grants INSERT, so this is deny-all to clients
-- exactly like `checkpoints` — and for the same reason. A band is competitive
-- (it picks the cohort board) and it is the app's central claim about the
-- learner, so a client-writable history would be a self-assigned level with an
-- audit trail attached, which is worse than no history at all.
--
-- `source` is the honest part. Two producers are anticipated and they are NOT
-- equivalent evidence:
--
--   'test'     — a graded checkpoint. Fresh items, chosen server-side, graded
--                server-side. The `checkpoint` edge function writes this row
--                in the same request that scores the attempt.
--
--   'practice' — the weighted six-strand estimate from `buildProficiencyReport`.
--                NOT WRITTEN YET, and the column allows it rather than the
--                writer existing: that engine is 1900 lines of app-bundle
--                TypeScript with no Deno home, so the only way to record a
--                practice-derived band today would be to let the client assert
--                it. That is precisely the self-assigned level this table's
--                service-role-only rule exists to prevent. The value is
--                permitted here so the writer can land the day the engine gets
--                a server-side home, without a second migration and without
--                the report having to special-case a missing enum value.
--
-- Until then the report shows its live practice estimate as the current state
-- and this table as the recorded history behind it, which is an honest
-- division: the estimate is recomputed from evidence on every load, so it
-- needs no persistence to be trustworthy — it just cannot be looked back at.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.level_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Per language, like every other proficiency surface since migration 133.
  -- A learner who switches from Spanish to French has two histories, not one
  -- history with a cliff in it.
  language      text NOT NULL,
  band          text NOT NULL CHECK (band IN ('A1','A2','B1','B2','C1','C2')),
  -- Null on the first recorded band: there was nothing before it. A demotion
  -- is a legitimate row — a history that only ever went up would be a
  -- different kind of vanity metric.
  previous_band text CHECK (previous_band IN ('A1','A2','B1','B2','C1','C2')),
  source        text NOT NULL CHECK (source IN ('test','practice')),
  -- The attempt this row came from, for a 'test' row. Null for 'practice'.
  -- ON DELETE SET NULL so pruning attempts never rewrites the learner's history.
  checkpoint_id uuid REFERENCES public.checkpoints(id) ON DELETE SET NULL,
  measured_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.level_history IS
  'One row per change in a learner''s measured CEFR band, per language. '
  'Written by the service role only — a client-writable row would be a '
  'self-assigned level. See the migration header for why ''practice'' is an '
  'allowed source with no writer yet.';

-- The only read the report makes: this learner, this language, newest first.
CREATE INDEX IF NOT EXISTS idx_level_history_user
  ON public.level_history (user_id, language, measured_at DESC);

ALTER TABLE public.level_history ENABLE ROW LEVEL SECURITY;

-- Read-only to the learner. Every write goes through an edge function.
CREATE POLICY "Users read own level history" ON public.level_history
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
