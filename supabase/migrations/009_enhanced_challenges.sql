-- Enhanced daily challenges with streak tracking
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_completed BOOLEAN DEFAULT false,
  bonus_xp_claimed BOOLEAN DEFAULT false,
  challenge_streak INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- RLS
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenges"
  ON daily_challenges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own challenges"
  ON daily_challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own challenges"
  ON daily_challenges FOR UPDATE
  USING (auth.uid() = user_id);
