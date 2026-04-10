-- 016_avatar_system.sql
-- Avatar customization system: config on user_profiles, accessories catalog, and unlock tracking

-- 1. Add avatar_config column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_config jsonb DEFAULT '{"headShape":"round","skinTone":"#F5C7A1","hairStyle":"short","hairColor":"#2C1B0E","eyeStyle":"round","eyeColor":"#4A3728","mouthStyle":"smile","accessory":null,"outfit":null,"background":null}'::jsonb;

-- 2. Create avatar_accessories catalog table
CREATE TABLE IF NOT EXISTS avatar_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('hat', 'glasses', 'earrings', 'necklace', 'mask')),
  svg_data text NOT NULL,
  unlock_type text NOT NULL CHECK (unlock_type IN ('free', 'level', 'achievement', 'streak', 'purchase')),
  unlock_requirement jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Create user_avatar_unlocks junction table
CREATE TABLE IF NOT EXISTS user_avatar_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessory_id uuid NOT NULL REFERENCES avatar_accessories(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, accessory_id)
);

-- 4. RLS policies

-- avatar_accessories: read-only for authenticated users
ALTER TABLE avatar_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view accessories"
  ON avatar_accessories
  FOR SELECT
  TO authenticated
  USING (true);

-- user_avatar_unlocks: users can read and insert their own rows
ALTER TABLE user_avatar_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unlocks"
  ON user_avatar_unlocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unlocks"
  ON user_avatar_unlocks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_user_avatar_unlocks_user_id ON user_avatar_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_accessories_category ON avatar_accessories(category);
CREATE INDEX IF NOT EXISTS idx_avatar_accessories_unlock_type ON avatar_accessories(unlock_type);

-- 6. Seed initial accessories

-- Free items
INSERT INTO avatar_accessories (name, category, svg_data, unlock_type, unlock_requirement) VALUES
  ('Classic Glasses', 'glasses', '<svg><path d="M10 20 Q15 15 20 20 M30 20 Q35 15 40 20" fill="none" stroke="#333" stroke-width="2"/></svg>', 'free', '{}'::jsonb),
  ('Baseball Cap', 'hat', '<svg><path d="M10 25 Q25 5 40 25" fill="#3B82F6" stroke="#1E40AF" stroke-width="1"/></svg>', 'free', '{}'::jsonb),
  ('Small Studs', 'earrings', '<svg><circle cx="10" cy="25" r="3" fill="#C0C0C0"/><circle cx="40" cy="25" r="3" fill="#C0C0C0"/></svg>', 'free', '{}'::jsonb),
  ('Reading Glasses', 'glasses', '<svg><rect x="8" y="18" width="14" height="10" rx="3" fill="none" stroke="#8B4513"/><rect x="28" y="18" width="14" height="10" rx="3" fill="none" stroke="#8B4513"/></svg>', 'free', '{}'::jsonb),
  ('Beanie', 'hat', '<svg><path d="M8 28 Q25 10 42 28" fill="#6B21A8"/><circle cx="25" cy="10" r="3" fill="#6B21A8"/></svg>', 'free', '{}'::jsonb);

-- Locked items
INSERT INTO avatar_accessories (name, category, svg_data, unlock_type, unlock_requirement) VALUES
  ('Gold Crown', 'hat', '<svg><path d="M10 30 L15 15 L20 25 L25 10 L30 25 L35 15 L40 30 Z" fill="#FFD700" stroke="#DAA520"/></svg>', 'level', '{"min_level": 25}'::jsonb),
  ('Diamond Tiara', 'hat', '<svg><path d="M12 28 Q25 8 38 28" fill="none" stroke="#00CED1" stroke-width="2"/><polygon points="25,10 23,16 27,16" fill="#E0FFFF"/></svg>', 'level', '{"min_level": 50}'::jsonb),
  ('Aviator Sunglasses', 'glasses', '<svg><path d="M8 20 Q15 28 22 20 M28 20 Q35 28 42 20" fill="#1a1a1a" stroke="#C0C0C0" stroke-width="1"/></svg>', 'streak', '{"min_streak": 30}'::jsonb),
  ('Monocle', 'glasses', '<svg><circle cx="32" cy="22" r="8" fill="none" stroke="#DAA520" stroke-width="2"/><line x1="32" y1="30" x2="32" y2="45" stroke="#DAA520"/></svg>', 'achievement', '{"achievement_id": "polyglot"}'::jsonb),
  ('Star Earrings', 'earrings', '<svg><polygon points="10,20 11,24 15,24 12,27 13,31 10,28 7,31 8,27 5,24 9,24" fill="#FFD700"/><polygon points="40,20 41,24 45,24 42,27 43,31 40,28 37,31 38,27 35,24 39,24" fill="#FFD700"/></svg>', 'level', '{"min_level": 10}'::jsonb),
  ('Headband', 'hat', '<svg><rect x="8" y="20" width="34" height="5" rx="2" fill="#EC4899"/></svg>', 'streak', '{"min_streak": 7}'::jsonb),
  ('Party Hat', 'hat', '<svg><polygon points="25,5 35,30 15,30" fill="#F59E0B" stroke="#D97706"/><circle cx="25" cy="5" r="3" fill="#EF4444"/></svg>', 'achievement', '{"achievement_id": "first_lesson"}'::jsonb),
  ('Heart Glasses', 'glasses', '<svg><path d="M10 22 Q10 16 15 16 Q20 16 20 22 Q20 28 10 32 Q0 28 0 22" fill="#EF4444" transform="translate(5,0) scale(0.8)"/><path d="M10 22 Q10 16 15 16 Q20 16 20 22 Q20 28 10 32 Q0 28 0 22" fill="#EF4444" transform="translate(22,0) scale(0.8)"/></svg>', 'level', '{"min_level": 15}'::jsonb),
  ('Wizard Hat', 'hat', '<svg><polygon points="25,2 38,35 12,35" fill="#4338CA"/><polygon points="17,35 33,35 36,38 14,38" fill="#4338CA"/><polygon points="23,8 27,8 26,15 24,15" fill="#FDE68A"/></svg>', 'level', '{"min_level": 75}'::jsonb),
  ('Masquerade Mask', 'mask', '<svg><path d="M8 22 Q25 12 42 22 Q25 32 8 22 Z" fill="#7C3AED" stroke="#5B21B6"/><circle cx="17" cy="22" r="5" fill="#000"/><circle cx="33" cy="22" r="5" fill="#000"/></svg>', 'level', '{"min_level": 100}'::jsonb);
