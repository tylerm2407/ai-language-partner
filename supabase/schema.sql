-- Fluenci Base Schema (Run this FIRST in Supabase SQL Editor)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  native_language TEXT NOT NULL DEFAULT 'English',
  target_language TEXT NOT NULL DEFAULT 'Spanish',
  level TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','elementary','intermediate','advanced')),
  xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_practice_date DATE,
  daily_goal_xp INTEGER NOT NULL DEFAULT 100,
  today_xp INTEGER NOT NULL DEFAULT 0,
  hearts INTEGER NOT NULL DEFAULT 5,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','family')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_own_full ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_own_full ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update   ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, full_name, avatar_url, target_language,
         total_xp, today_xp, streak_days, subscription_tier
  FROM public.profiles;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  topic TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  xp_earned INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_own ON public.conversations;
CREATE POLICY conversations_own ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL CHECK (category IN ('streak','conversation','lesson','mastery','social'))
);

INSERT INTO public.achievements (id,title,description,icon,xp_reward,category) VALUES
  ('streak_3','3-Day Streak','Practice 3 days in a row','🔥',25,'streak'),
  ('streak_7','Week Warrior','Practice 7 days in a row','🔥',75,'streak'),
  ('streak_14','Fortnight Force','Practice 14 days in a row','⚡',150,'streak'),
  ('streak_30','Monthly Master','Practice 30 days in a row','🏆',300,'streak'),
  ('streak_100','Century Club','Practice 100 days in a row','💎',1000,'streak'),
  ('first_convo','First Words','Complete your first conversation','💬',50,'conversation'),
  ('convo_10','Chatterbox','Complete 10 conversations','🗣️',100,'conversation'),
  ('convo_50','Conversationalist','Complete 50 conversations','🎙️',250,'conversation'),
  ('convo_100','Fluent Speaker','Complete 100 conversations','🌟',500,'conversation'),
  ('long_convo','Deep Diver','Have a conversation over 10 minutes','⏱️',75,'conversation'),
  ('perfect_convo','Flawless','Complete a conversation with no errors','✨',100,'conversation'),
  ('multilingual','Multilingual','Converse in 3 different languages','🌍',200,'conversation'),
  ('xp_500','Rising Star','Earn 500 total XP','⭐',25,'mastery'),
  ('xp_2000','Scholar','Earn 2,000 total XP','📚',50,'mastery'),
  ('xp_10000','Linguist','Earn 10,000 total XP','🎓',200,'mastery'),
  ('xp_50000','Polyglot','Earn 50,000 total XP','🌐',1000,'mastery'),
  ('daily_goal','Goal Getter','Hit your daily XP goal','🎯',30,'mastery'),
  ('daily_goal_7','On a Roll','Hit daily goal 7 days in a row','🎯',100,'mastery'),
  ('first_lesson','Student','Complete your first lesson','📖',20,'lesson'),
  ('lesson_10','Dedicated','Complete 10 lessons','📝',75,'lesson'),
  ('lesson_50','Committed','Complete 50 lessons','🏅',200,'lesson'),
  ('perfect_lesson','Perfectionist','Get 100% on a lesson','💯',50,'lesson')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ua_own ON public.user_achievements;
CREATE POLICY ua_own ON public.user_achievements FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.add_xp(user_id UUID, xp_amount INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  today DATE := CURRENT_DATE;
  yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  new_streak INTEGER;
  new_today_xp INTEGER;
  new_total_xp INTEGER;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = user_id;
  IF NOT FOUND THEN RETURN; END IF;
  new_total_xp := p.total_xp + xp_amount;
  IF p.last_practice_date IS NOT NULL AND p.last_practice_date < today THEN
    new_today_xp := xp_amount;
  ELSE
    new_today_xp := p.today_xp + xp_amount;
  END IF;
  IF p.last_practice_date = today THEN
    new_streak := p.streak_days;
  ELSIF p.last_practice_date = yesterday THEN
    new_streak := p.streak_days + 1;
  ELSE
    new_streak := 1;
  END IF;
  UPDATE public.profiles
  SET xp=new_today_xp, today_xp=new_today_xp, total_xp=new_total_xp,
      streak_days=new_streak, last_practice_date=today, updated_at=now()
  WHERE id=user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
