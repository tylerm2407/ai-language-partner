-- Languages
CREATE TABLE IF NOT EXISTS public.languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  flag TEXT NOT NULL DEFAULT '🌐',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  learner_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "languages_public_read" ON public.languages FOR SELECT USING (true);

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  level_min TEXT NOT NULL DEFAULT 'A1',
  level_max TEXT NOT NULL DEFAULT 'C2',
  type TEXT NOT NULL DEFAULT 'core' CHECK (type IN ('core','reading_writing','conversation','music','news')),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_public_read" ON public.courses FOR SELECT USING (is_published = true);

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'reading' CHECK (kind IN ('vocab','reading','writing','conversation','music','news')),
  level TEXT NOT NULL DEFAULT 'A1',
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_public_read" ON public.lessons FOR SELECT USING (is_published = true);

-- Lesson contents
CREATE TABLE IF NOT EXISTS public.lesson_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','article_link','public_domain_text','music_snippet','vocab_list','exercise')),
  body TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  license_info TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_contents_public_read" ON public.lesson_contents FOR SELECT USING (true);

-- News articles
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'B1',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_public_read" ON public.news_articles FOR SELECT USING (true);

-- Music tracks
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  external_url TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'B1',
  snippet TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music_public_read" ON public.music_tracks FOR SELECT USING (true);

-- User language progress (extends existing profiles)
CREATE TABLE IF NOT EXISTS public.user_language_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  approx_level TEXT NOT NULL DEFAULT 'A1',
  words_read_count INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  conversations_completed INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, language_id)
);

ALTER TABLE public.user_language_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ulp_own" ON public.user_language_progress FOR ALL USING (auth.uid() = user_id);

-- User lesson progress
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  last_score NUMERIC,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_submitted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ull_own" ON public.user_lesson_progress FOR ALL USING (auth.uid() = user_id);

-- Writing submissions
CREATE TABLE IF NOT EXISTS public.user_writing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  ai_feedback TEXT,
  ai_score NUMERIC,
  feedback_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_writing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uws_own" ON public.user_writing_submissions FOR ALL USING (auth.uid() = user_id);

-- Tutor profiles (one per user per language)
CREATE TABLE IF NOT EXISTS public.tutor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{"common_errors":[],"mastered_vocab":[],"preferred_topics":[],"cefr_estimate":"A1","session_count":0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, language_id)
);

ALTER TABLE public.tutor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_own" ON public.tutor_profiles FOR ALL USING (auth.uid() = user_id);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  mode TEXT NOT NULL DEFAULT 'text' CHECK (mode IN ('text','voice')),
  transcript JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  vocab_list JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_own" ON public.conversation_sessions FOR ALL USING (auth.uid() = user_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_own" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- =====================
-- SEED DATA
-- =====================

INSERT INTO public.languages (name, code, slug, flag, description, is_active, learner_count) VALUES
  ('Spanish',          'es', 'spanish',    '🇪🇸', 'The world''s second most spoken language. From Madrid to Mexico City.',        true, 52000),
  ('French',           'fr', 'french',     '🇫🇷', 'The language of love, cuisine, and international diplomacy.',                 true, 31000),
  ('Japanese',         'ja', 'japanese',   '🇯🇵', 'Master hiragana, katakana, kanji, and the art of polite conversation.',       true, 18000),
  ('Mandarin Chinese', 'zh', 'mandarin',   '🇨🇳', 'The most spoken language on Earth. Open doors across Asia and beyond.',      true, 24000),
  ('German',           'de', 'german',     '🇩🇪', 'Precision, philosophy, and one of Europe''s strongest economies.',            true, 14000),
  ('Portuguese',       'pt', 'portuguese', '🇧🇷', 'From Lisbon to Sao Paulo - a language spanning continents.',                 true, 11000),
  ('Italian',          'it', 'italian',    '🇮🇹', 'The language of art, opera, and the world''s best food.',                    true,  9000),
  ('Korean',           'ko', 'korean',     '🇰🇷', 'K-pop, K-drama, and one of the most logical writing systems ever created.',   true,  8000),
  ('Arabic',           'ar', 'arabic',     '🇸🇦', 'Over 400 million speakers across 22 countries. The language of the Quran.',  true,  7000),
  ('Russian',          'ru', 'russian',    '🇷🇺', 'Literature, science, and space exploration - all in one rich language.',     true,  6000)
ON CONFLICT (slug) DO NOTHING;

-- Helper function: get user plan
CREATE OR REPLACE FUNCTION public.get_user_plan(uid UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE plan TEXT;
BEGIN
  SELECT s.plan INTO plan FROM public.subscriptions s WHERE s.user_id = uid;
  IF NOT FOUND THEN RETURN 'free'; END IF;
  RETURN COALESCE(plan, 'free');
END;
$$;

-- Helper function: upsert language progress
CREATE OR REPLACE FUNCTION public.upsert_language_progress(
  p_user_id UUID, p_language_id UUID, p_words_delta INT DEFAULT 0,
  p_sessions_delta INT DEFAULT 0, p_convos_delta INT DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_language_progress (user_id, language_id, words_read_count, sessions_completed, conversations_completed, last_activity_at)
  VALUES (p_user_id, p_language_id, p_words_delta, p_sessions_delta, p_convos_delta, now())
  ON CONFLICT (user_id, language_id) DO UPDATE SET
    words_read_count = user_language_progress.words_read_count + p_words_delta,
    sessions_completed = user_language_progress.sessions_completed + p_sessions_delta,
    conversations_completed = user_language_progress.conversations_completed + p_convos_delta,
    last_activity_at = now(),
    updated_at = now();
END;
$$;
