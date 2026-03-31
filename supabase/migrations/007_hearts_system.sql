-- Hearts system: 5 hearts, regen 1 per 4 hours, unlimited for paid users
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS hearts INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_hearts INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_heart_lost_at TIMESTAMPTZ;
