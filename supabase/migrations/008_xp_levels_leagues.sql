-- XP levels and league tiers
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS xp_level INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS league_tier TEXT DEFAULT 'bronze'
    CHECK (league_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));
