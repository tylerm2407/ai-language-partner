-- ============================================================================
-- Migration: Correction Log
-- ============================================================================
-- Logs every AI-flagged correction so the chat UI can display "you've made
-- this error Nx this week" repetition awareness next to each new correction.
-- Writes happen only from the ai-chat Edge Function (service-role). Users can
-- read their own rows for analytics / future "my weak spots" screen.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.correction_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  target_language TEXT,
  error_type   TEXT NOT NULL
    CHECK (error_type IN ('grammar','vocabulary','spelling','word_order','tense','gender','other')),
  severity     TEXT NOT NULL
    CHECK (severity IN ('minor','moderate','critical')),
  short_label  TEXT,
  original     TEXT,
  corrected    TEXT,
  explanation  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for "how many times has this user hit this short_label lately"
CREATE INDEX IF NOT EXISTS idx_correction_log_user_label_time
  ON public.correction_log (user_id, short_label, created_at DESC);

-- Secondary index for aggregated weak-spot queries by error type
CREATE INDEX IF NOT EXISTS idx_correction_log_user_type_time
  ON public.correction_log (user_id, error_type, created_at DESC);

ALTER TABLE public.correction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own correction log"
  ON public.correction_log FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: writes only via service-role from
-- Edge Functions (ai-chat). Users cannot tamper with their own error history.
