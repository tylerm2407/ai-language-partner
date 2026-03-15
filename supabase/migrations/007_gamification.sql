-- 007: Duolingo-inspired gamification system
-- ============================================================================

-- Extend profiles with gamification columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gems INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS league TEXT NOT NULL DEFAULT 'bronze'
  CHECK (league IN ('bronze','silver','gold','diamond','legendary'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS league_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hearts_last_regen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_hearts INTEGER NOT NULL DEFAULT 5;

-- Gem transactions
CREATE TABLE IF NOT EXISTS public.gem_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gem_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gem_tx_select" ON public.gem_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gem_tx_insert" ON public.gem_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_gem_tx_user ON public.gem_transactions (user_id, created_at DESC);

-- Daily quests
CREATE TABLE IF NOT EXISTS public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_type TEXT NOT NULL CHECK (quest_type IN (
    'complete_lessons', 'earn_xp', 'practice_minutes',
    'review_cards', 'perfect_lesson', 'conversation', 'streak_maintain'
  )),
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  gem_reward INTEGER NOT NULL DEFAULT 5,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, quest_type, quest_date)
);
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quests_select" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quests_insert" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quests_update" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_quests_user_date ON public.daily_quests (user_id, quest_date);

-- League history
CREATE TABLE IF NOT EXISTS public.league_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  league TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_xp INTEGER NOT NULL DEFAULT 0,
  final_rank INTEGER,
  promoted BOOLEAN DEFAULT false,
  demoted BOOLEAN DEFAULT false,
  UNIQUE(user_id, week_start)
);
ALTER TABLE public.league_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "league_select" ON public.league_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "league_insert" ON public.league_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_league_history_week ON public.league_history (week_start, league, week_xp DESC);

-- Practice calendar (streak visualization)
CREATE TABLE IF NOT EXISTS public.practice_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  practice_date DATE NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  minutes_practiced INTEGER NOT NULL DEFAULT 0,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  reviews_completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, practice_date)
);
ALTER TABLE public.practice_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_select" ON public.practice_calendar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calendar_insert" ON public.practice_calendar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "calendar_update" ON public.practice_calendar FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_calendar_user_date ON public.practice_calendar (user_id, practice_date DESC);

-- AI response cache (for cost reduction)
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);
CREATE INDEX idx_ai_cache_key ON public.ai_response_cache (cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_response_cache (expires_at);

-- AI usage log (for cost monitoring)
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  function_name TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_user ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX idx_ai_usage_daily ON public.ai_usage_log (created_at, function_name);

-- Updated add_xp function with gamification
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  today DATE := CURRENT_DATE;
  yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  new_streak INTEGER;
  new_today_xp INTEGER;
  new_total_xp INTEGER;
  streak_mult NUMERIC;
  adjusted_xp INTEGER;
  gems_earned INTEGER;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Streak multiplier (Duolingo-inspired)
  IF p.streak_days >= 14 THEN streak_mult := 2.0;
  ELSIF p.streak_days >= 7 THEN streak_mult := 1.5;
  ELSIF p.streak_days >= 3 THEN streak_mult := 1.2;
  ELSE streak_mult := 1.0;
  END IF;

  adjusted_xp := CEIL(p_xp_amount * streak_mult);
  new_total_xp := p.total_xp + adjusted_xp;

  -- Reset today_xp if new day
  IF p.last_practice_date IS NOT NULL AND p.last_practice_date < today THEN
    new_today_xp := adjusted_xp;
  ELSE
    new_today_xp := p.today_xp + adjusted_xp;
  END IF;

  -- Streak calculation
  IF p.last_practice_date = today THEN
    new_streak := p.streak_days;
  ELSIF p.last_practice_date = yesterday THEN
    new_streak := p.streak_days + 1;
  ELSIF p.streak_freeze_count > 0 AND p.last_practice_date = yesterday - INTERVAL '1 day' THEN
    -- Streak freeze auto-activates
    new_streak := p.streak_days;
    UPDATE public.profiles SET streak_freeze_count = streak_freeze_count - 1 WHERE id = p_user_id;
  ELSE
    new_streak := 1;
  END IF;

  -- Gems: 1 gem per 10 XP earned
  gems_earned := FLOOR(adjusted_xp / 10);

  UPDATE public.profiles
  SET xp = new_today_xp,
      today_xp = new_today_xp,
      total_xp = new_total_xp,
      streak_days = new_streak,
      last_practice_date = today,
      league_xp = league_xp + adjusted_xp,
      gems = gems + gems_earned,
      updated_at = now()
  WHERE id = p_user_id;

  -- Update practice calendar
  INSERT INTO public.practice_calendar (user_id, practice_date, xp_earned)
  VALUES (p_user_id, today, adjusted_xp)
  ON CONFLICT (user_id, practice_date) DO UPDATE SET
    xp_earned = practice_calendar.xp_earned + adjusted_xp;

  -- Update daily quests progress for XP-based quests
  UPDATE public.daily_quests
  SET current_value = LEAST(current_value + adjusted_xp, target_value),
      completed = (current_value + adjusted_xp >= target_value)
  WHERE user_id = p_user_id
    AND quest_date = today
    AND quest_type = 'earn_xp'
    AND NOT completed;

  -- Log gem transaction if any
  IF gems_earned > 0 THEN
    INSERT INTO public.gem_transactions (user_id, amount, reason)
    VALUES (p_user_id, gems_earned, 'xp_earning');
  END IF;
END;
$$;

-- Function to generate daily quests for a user
CREATE OR REPLACE FUNCTION public.generate_daily_quests(p_user_id UUID)
RETURNS SETOF public.daily_quests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today DATE := CURRENT_DATE;
  quest_count INTEGER;
BEGIN
  -- Check if quests already exist for today
  SELECT COUNT(*) INTO quest_count
  FROM public.daily_quests
  WHERE user_id = p_user_id AND quest_date = today;

  IF quest_count >= 3 THEN
    RETURN QUERY SELECT * FROM public.daily_quests
      WHERE user_id = p_user_id AND quest_date = today
      ORDER BY quest_type;
    RETURN;
  END IF;

  -- Generate 3 quests with varied types
  INSERT INTO public.daily_quests (user_id, quest_type, target_value, gem_reward, xp_reward, quest_date)
  VALUES
    (p_user_id, 'earn_xp', (ARRAY[30, 50, 75, 100])[1 + floor(random() * 4)], 10, 0, today),
    (p_user_id, 'complete_lessons', (ARRAY[1, 2, 3])[1 + floor(random() * 3)], 10, 5, today),
    (p_user_id, 'review_cards', (ARRAY[5, 10, 15])[1 + floor(random() * 3)], 10, 5, today)
  ON CONFLICT (user_id, quest_type, quest_date) DO NOTHING;

  RETURN QUERY SELECT * FROM public.daily_quests
    WHERE user_id = p_user_id AND quest_date = today
    ORDER BY quest_type;
END;
$$;

-- Function to purchase streak freeze with gems
CREATE OR REPLACE FUNCTION public.purchase_streak_freeze(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_gems INTEGER;
  freeze_cost INTEGER := 200;
BEGIN
  SELECT gems INTO current_gems FROM public.profiles WHERE id = p_user_id;
  IF current_gems < freeze_cost THEN RETURN false; END IF;

  UPDATE public.profiles
  SET gems = gems - freeze_cost,
      streak_freeze_count = LEAST(streak_freeze_count + 1, 2)
  WHERE id = p_user_id;

  INSERT INTO public.gem_transactions (user_id, amount, reason)
  VALUES (p_user_id, -freeze_cost, 'streak_freeze_purchase');

  RETURN true;
END;
$$;

-- Function to regenerate hearts based on time elapsed
CREATE OR REPLACE FUNCTION public.regenerate_hearts(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  hours_elapsed NUMERIC;
  hearts_to_add INTEGER;
  new_hearts INTEGER;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- 1 heart per 4 hours
  hours_elapsed := EXTRACT(EPOCH FROM (now() - p.hearts_last_regen_at)) / 3600;
  hearts_to_add := FLOOR(hours_elapsed / 4);

  IF hearts_to_add <= 0 THEN RETURN p.hearts; END IF;

  new_hearts := LEAST(p.hearts + hearts_to_add, p.max_hearts);

  UPDATE public.profiles
  SET hearts = new_hearts,
      hearts_last_regen_at = now()
  WHERE id = p_user_id;

  RETURN new_hearts;
END;
$$;
