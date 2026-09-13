-- 126 — Chat missions: server-owned progression for the guided-chat scenes.
--
-- Applied to production 2026-09-13 via the Supabase MCP (migration name
-- `chat_missions`); this file is the mirror of record.
--
-- Every guidance layer in `ai-chat` was per-turn. Nothing tracked progress per
-- topic: scenes never ended, one `chat_sessions` row per scene resumed forever,
-- and evidence was tagged by level and modality, never by scene. This adds the
-- unit of progression — an authored ladder of four missions per scene
-- (`supabase/functions/_shared/missions.ts`), each attempt its own chat
-- session, each finished attempt a pass/fail with a stored debrief.
--
-- WHY THESE ARE NOT COLUMNS ON chat_sessions
-- `chat_sessions` / `chat_messages` are client-managed `FOR ALL` tables
-- (migration 020a): the client inserts rows and rewrites its own. Anything
-- with competitive meaning — which mission is unlocked, whether an attempt
-- passed — must be written server-side (CLAUDE.md §1.2), so progression state
-- lives in separate tables that only the service role can write. The one
-- column added to `chat_sessions` (`mission_stage`) is informational: it lets
-- `getOrCreateChatSession` keep an assignment on `restaurant` from resuming a
-- mission attempt. The authoritative stage is on `chat_mission_attempts`.
--
-- WHY saved_words IS ON THE ATTEMPT ROW
-- `cards.source_id` is `uuid REFERENCES content_sources`, so a card cannot
-- point at the chat session that produced it. The debrief's "words banked"
-- list therefore accumulates on the attempt row instead, unioned per turn.
--
-- No new `consume_daily_quota` counters: a mission turn is an ordinary text
-- message, and Finish costs one more (degraded to a canned send-off at the
-- limit, never blocked).

-- ─── chat_sessions: informational stage ──────────────────────────────────

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS mission_stage smallint
    CHECK (mission_stage IS NULL OR mission_stage BETWEEN 1 AND 4);

-- ─── conversation_evidence: which session a turn came from ───────────────
--
-- The mission's accuracy is the mean over the attempt's own scored turns, so
-- evidence needs to be attributable to a session. Nullable, and SET NULL on
-- delete: evidence outlives the session it came from, as it always has.

ALTER TABLE public.conversation_evidence
  ADD COLUMN IF NOT EXISTS chat_session_id uuid
    REFERENCES public.chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_evidence_session
  ON public.conversation_evidence (chat_session_id)
  WHERE chat_session_id IS NOT NULL;

-- ─── chat_mission_attempts: one row per attempt ──────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_mission_attempts (
  chat_session_id uuid PRIMARY KEY REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  scenario_key text NOT NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 4),
  -- Union of every objective id the model has reported across the attempt's
  -- turns, whitelisted against the mission's own ids before it is written.
  objectives_met text[] NOT NULL DEFAULT '{}',
  -- Words that became review cards during this attempt (see header).
  saved_words text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  passed boolean,
  accuracy numeric CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 1)),
  scored_turns integer,
  -- The debrief payload as returned to the client at finish time. Source of
  -- truth for the debrief screen on a cold open; second finish returns it.
  result jsonb,
  CHECK ((finished_at IS NULL) = (passed IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_chat_mission_attempts_user
  ON public.chat_mission_attempts (user_id, started_at DESC);

ALTER TABLE public.chat_mission_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mission attempts" ON public.chat_mission_attempts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.chat_mission_attempts FROM anon, authenticated;

-- ─── chat_mission_progress: best result per (scene, stage) ───────────────
--
-- Unlocked stage = max passed stage + 1. At most 32 rows per learner per
-- language (8 scenes × 4 stages).

CREATE TABLE IF NOT EXISTS public.chat_mission_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  scenario_key text NOT NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 4),
  attempts integer NOT NULL DEFAULT 0,
  best_accuracy numeric CHECK (best_accuracy IS NULL OR (best_accuracy >= 0 AND best_accuracy <= 1)),
  passed_at timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_language, scenario_key, stage)
);

ALTER TABLE public.chat_mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mission progress" ON public.chat_mission_progress
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.chat_mission_progress FROM anon, authenticated;

-- ─── mission_phrase_cache: warm-up phrases, generated once per tuple ─────
--
-- Keyed on sha256 of [scenarioKey, stage, targetLanguage, nativeLanguage,
-- version]. Curriculum-capped keyspace (8 × 4 × languages × version), so no
-- daily metering and no retention sweep. A version bump needs a manual
-- `DELETE FROM mission_phrase_cache WHERE version < N`.
--
-- Service-role only: RLS on with NO policies, exactly like hint_cache. The
-- advisor's INFO `rls_enabled_no_policy` is the intended state (CLAUDE.md §4).

CREATE TABLE IF NOT EXISTS public.mission_phrase_cache (
  hash text PRIMARY KEY,
  scenario_key text NOT NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 4),
  target_language text NOT NULL,
  native_language text NOT NULL,
  version integer NOT NULL,
  phrases jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_phrase_cache ENABLE ROW LEVEL SECURITY;
