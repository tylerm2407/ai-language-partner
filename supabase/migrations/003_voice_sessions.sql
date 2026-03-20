-- Voice conversation sessions for real-time AI voice practice
-- Stores session metadata, transcripts, corrections, and vocabulary extracted by the voice agent

CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'Free Conversation',
  target_language TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'beginner',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  transcript JSONB NOT NULL DEFAULT '[]'::JSONB,
  corrections JSONB NOT NULL DEFAULT '[]'::JSONB,
  vocabulary JSONB NOT NULL DEFAULT '[]'::JSONB,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX idx_voice_sessions_created_at ON voice_sessions(created_at DESC);

-- RLS
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read own voice sessions"
  ON voice_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (Python agent writes via REST API)
CREATE POLICY "Service role can insert voice sessions"
  ON voice_sessions FOR INSERT
  WITH CHECK (true);

-- Users can update their own sessions (for client-side duration/xp updates)
CREATE POLICY "Users can update own voice sessions"
  ON voice_sessions FOR UPDATE
  USING (auth.uid() = user_id);
