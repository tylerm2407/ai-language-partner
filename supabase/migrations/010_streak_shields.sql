-- Streak shields and streak event logging
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS streak_shield_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_shield_used_at DATE;

CREATE TABLE IF NOT EXISTS streak_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('streak_broken', 'streak_repaired', 'shield_activated', 'shield_used', 'freeze_used')),
  streak_at_time INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE streak_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streak events"
  ON streak_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak events"
  ON streak_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
