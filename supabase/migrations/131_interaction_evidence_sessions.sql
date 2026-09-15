-- 131 — Attribute live-tutor conversation evidence to its session.
--
-- WHY
--
-- The measured CEFR level now weights live conversation at 0.55, and the
-- interaction strand's unit is a SESSION rather than a turn: a band needs a
-- number of conversations, each of a few real turns, spread over a number of
-- days. Per-turn counting was priced for a strand worth a fifth of the level
-- and is far too cheap at more than half of it — one long session would clear
-- a band's whole volume gate.
--
-- Grouping turns into sessions needs every turn to say which session it came
-- from. Migration 126 added `chat_session_id` for the text chat, because a
-- mission attempt's accuracy is the mean over its own turns. The live voice
-- tutor never had an equivalent: `tutor-writeback` inserts one
-- `conversation_evidence` row per analysed turn with no session reference at
-- all, so voice evidence cannot be grouped and — under the session rule —
-- would be silently dropped from the strand that is supposed to carry the
-- most weight. The most expensive surface in the app would contribute nothing
-- again, which is the exact failure the interaction strand exists to fix.
--
-- Nullable, and ON DELETE SET NULL, matching `chat_session_id`: evidence
-- outlives the session it came from, as it always has. Rows written before
-- this migration keep a null on both columns and are simply not groupable —
-- they are not backfillable either, since nothing recorded the association.

ALTER TABLE public.conversation_evidence
  ADD COLUMN IF NOT EXISTS tutor_session_id uuid
    REFERENCES public.tutor_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_evidence_tutor_session
  ON public.conversation_evidence (tutor_session_id)
  WHERE tutor_session_id IS NOT NULL;

COMMENT ON COLUMN public.conversation_evidence.tutor_session_id IS
  'The live-tutor session this turn came from, for the interaction strand''s '
  'per-session grouping. Null for text-chat turns (see chat_session_id) and '
  'for every row written before migration 131.';

-- The strand reads turns for one learner and one language, newest first, then
-- groups by session. The existing (user_id, modality, created_at DESC) index
-- from migration 095 no longer matches that shape now that modality is not a
-- filter — interaction pools typed and spoken turns together.
CREATE INDEX IF NOT EXISTS idx_conversation_evidence_user_lang_time
  ON public.conversation_evidence (user_id, target_language, created_at DESC);
