-- ─────────────────────────────────────────────────────────────────────────────
-- 146 — The level test measures conversation
--
-- Interaction is 0.55 of the practice model (`STRAND_WEIGHTS` in
-- lib/cefr-proficiency.ts) and was 0% of the level test. The test graded
-- listening, reading, writing and speaking — four things that together carry
-- 0.33 of what the app says a level is — and then, since migration 143's work,
-- published that as a learner's level whenever practice had measured none. The
-- strand the whole product is built around had no say in it.
--
-- HOW IT IS MEASURED, AND WHY NOT AS AN ITEM
--
-- Every other strand is a pool item with an answer key. A conversation is not:
-- it is a session, it is pitched at ONE band (you cannot hold three
-- simultaneous conversations at three levels in one test), and its score comes
-- from what the learner produced rather than from matching a key.
--
-- So the checkpoint opens a `chat_sessions` row, the learner holds a short
-- spoken conversation against `ai-chat` exactly as they would anywhere else,
-- and `ai-chat` writes `conversation_evidence` rows stamped with that session
-- id — the same rows, written by the same shared module
-- (`_shared/conversation-evidence.ts`), that the proficiency report reads. The
-- checkpoint then reads them BACK at submit and scores the strand from them.
--
-- That readback is the point of `interaction_session_id` being a column rather
-- than a request parameter. It is the same discipline the speaking strand
-- already follows: `score-pronunciation` writes under the service role and the
-- checkpoint reads the rows, because a client-supplied score is a self-assigned
-- band. If `submit` took the session id from the request body, a learner could
-- point it at a conversation they held at their best on a different day.
-- Binding it to the attempt at `start` closes that.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.checkpoints
  -- The conversation opened for THIS attempt. Null on every attempt taken
  -- before this migration, and on any attempt whose session could not be
  -- created — the strand is then absent, never zero.
  ADD COLUMN IF NOT EXISTS interaction_session_id uuid
    REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  -- Mean of the attempt's scored turns, on the same 0–1 scale as every other
  -- strand column. Null when the learner held no scoreable conversation.
  ADD COLUMN IF NOT EXISTS interaction_score real
    CHECK (interaction_score BETWEEN 0 AND 1);

COMMENT ON COLUMN public.checkpoints.interaction_session_id IS
  'The chat_sessions row opened for this attempt. Written by the checkpoint '
  'edge function at start and read back at submit — never accepted from a '
  'client, which could otherwise point the strand at a better conversation.';

COMMENT ON COLUMN public.checkpoints.interaction_score IS
  'Mean combined score over this attempt''s conversation_evidence rows, 0-1. '
  'Null means the conversation was skipped or produced no scoreable turn; the '
  'composite EXCLUDES it rather than scoring it zero.';

-- The submit readback: this attempt's turns, by session.
CREATE INDEX IF NOT EXISTS idx_conversation_evidence_session
  ON public.conversation_evidence (chat_session_id, created_at);
