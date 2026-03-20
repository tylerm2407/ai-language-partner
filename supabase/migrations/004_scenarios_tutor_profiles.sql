-- Migration 004: Scenarios, Tutor Profiles, News, Conversation Sessions + RLS for all tables
-- Run: npx supabase db push

-- ─── New Tables ───────────────────────────────────────────────

-- Conversation scenarios (Airport, Restaurant, Doctor, etc.)
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ai_persona TEXT NOT NULL DEFAULT '',
  setting TEXT NOT NULL DEFAULT '',
  target_vocab TEXT[] NOT NULL DEFAULT '{}',
  target_grammar TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced')),
  category TEXT NOT NULL DEFAULT 'Daily Life'
    CHECK (category IN ('Travel', 'Social', 'Professional', 'Daily Life', 'Emergency')),
  order_index INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_language ON public.scenarios(language_id);
CREATE INDEX idx_scenarios_category ON public.scenarios(category);
CREATE INDEX idx_scenarios_difficulty ON public.scenarios(difficulty);

-- Adaptive difficulty tracking per user per language
CREATE TABLE IF NOT EXISTS public.tutor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'es',
  cefr_estimate TEXT NOT NULL DEFAULT 'A1'
    CHECK (cefr_estimate IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  common_errors JSONB NOT NULL DEFAULT '{}'::JSONB,
  mastered_vocab JSONB NOT NULL DEFAULT '[]'::JSONB,
  sessions_count INT NOT NULL DEFAULT 0,
  avg_error_rate REAL NOT NULL DEFAULT 0,
  last_recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, language)
);

CREATE INDEX idx_tutor_profiles_user ON public.tutor_profiles(user_id);

-- News articles synced from RSS feeds for reading practice
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_articles_language ON public.news_articles(language);
CREATE INDEX idx_news_articles_synced ON public.news_articles(synced_at DESC);

-- Persistent tutor conversation sessions with memory
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_personality TEXT NOT NULL DEFAULT 'sofia',
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'es',
  level TEXT NOT NULL DEFAULT 'beginner',
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  session_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_sessions_user ON public.conversation_sessions(user_id);
CREATE INDEX idx_conversation_sessions_active ON public.conversation_sessions(last_active_at DESC);

-- ─── ALTER: Add voice preference to user_profiles ─────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS voice_preference TEXT NOT NULL DEFAULT 'sofia';

-- ─── ALTER: Fix subscription tier constraint to include all 4 tiers ──

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'basic', 'premium', 'unlimited'));

-- ─── RLS Policies for ALL tables ──────────────────────────────

-- User Profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Review Items
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review items" ON public.review_items
  FOR ALL USING (auth.uid() = user_id);

-- Review Logs
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review logs" ON public.review_logs
  FOR ALL USING (auth.uid() = user_id);

-- Daily Stats
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily stats" ON public.daily_stats
  FOR ALL USING (auth.uid() = user_id);

-- Practice Sessions
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own practice sessions" ON public.practice_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Daily Usage
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily usage" ON public.daily_usage
  FOR ALL USING (auth.uid() = user_id);

-- Content tables: read-only for all authenticated users
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read courses" ON public.courses
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read units" ON public.units
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read lessons" ON public.lessons
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read cards" ON public.cards
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read exercises" ON public.exercises
  FOR SELECT USING (auth.role() = 'authenticated');

-- Scenarios: read-only
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read scenarios" ON public.scenarios
  FOR SELECT USING (auth.role() = 'authenticated');

-- News Articles: read-only
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read news articles" ON public.news_articles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Tutor Profiles: user owns
ALTER TABLE public.tutor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tutor profile" ON public.tutor_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Conversation Sessions: user owns
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversation sessions" ON public.conversation_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ─── Seed: Default Scenarios ──────────────────────────────────

INSERT INTO public.scenarios (language_id, title, description, ai_persona, setting, target_vocab, target_grammar, difficulty, category, order_index) VALUES
  ('es', 'At the Airport', 'Navigate check-in, security, and boarding', 'Airport staff member', 'International airport terminal', ARRAY['boarding pass', 'gate', 'departure', 'luggage', 'customs'], ARRAY['present tense questions', 'modal verbs'], 'beginner', 'Travel', 1),
  ('es', 'Hotel Check-In', 'Book a room, ask about amenities, handle issues', 'Friendly hotel receptionist', 'Hotel lobby', ARRAY['reservation', 'room key', 'floor', 'breakfast', 'checkout'], ARRAY['polite requests', 'conditional'], 'beginner', 'Travel', 2),
  ('es', 'Ordering at a Restaurant', 'Read a menu, order food, ask for the bill', 'Waiter at a local restaurant', 'Traditional restaurant', ARRAY['menu', 'appetizer', 'main course', 'dessert', 'bill'], ARRAY['would like', 'comparatives'], 'beginner', 'Daily Life', 3),
  ('es', 'At the Doctor', 'Describe symptoms, understand diagnosis', 'General practitioner', 'Medical clinic', ARRAY['headache', 'fever', 'prescription', 'appointment', 'symptoms'], ARRAY['present perfect', 'body parts'], 'intermediate', 'Emergency', 4),
  ('es', 'Job Interview', 'Answer questions about experience and skills', 'HR manager at a tech company', 'Corporate office', ARRAY['experience', 'skills', 'salary', 'responsibilities', 'team'], ARRAY['past tense', 'future plans', 'conditionals'], 'upper_intermediate', 'Professional', 5),
  ('es', 'Shopping for Clothes', 'Ask about sizes, colors, prices, try on', 'Shop assistant', 'Clothing store', ARRAY['size', 'fitting room', 'discount', 'receipt', 'exchange'], ARRAY['demonstratives', 'comparisons'], 'beginner', 'Daily Life', 6),
  ('es', 'Asking for Directions', 'Navigate a city, find landmarks', 'Helpful local pedestrian', 'City street corner', ARRAY['turn left', 'straight ahead', 'block', 'intersection', 'landmark'], ARRAY['imperatives', 'prepositions of place'], 'beginner', 'Travel', 7),
  ('es', 'Phone Call to a Business', 'Make appointments, ask about services', 'Business receptionist', 'Phone conversation', ARRAY['appointment', 'available', 'hold', 'transfer', 'message'], ARRAY['phone etiquette', 'future tense'], 'intermediate', 'Professional', 8),
  ('es', 'At the Bank', 'Open account, exchange currency, handle transactions', 'Bank teller', 'Bank branch', ARRAY['account', 'transfer', 'exchange rate', 'withdrawal', 'balance'], ARRAY['numbers', 'formal requests'], 'intermediate', 'Daily Life', 9),
  ('es', 'Meeting Someone New', 'Introduce yourself, small talk, exchange contacts', 'Fellow student at a language exchange', 'Casual cafe meetup', ARRAY['nice to meet you', 'hometown', 'hobbies', 'contact', 'plans'], ARRAY['present tense', 'question formation'], 'beginner', 'Social', 10),
  ('fr', 'At the Airport', 'Navigate check-in, security, and boarding', 'Airport staff member', 'International airport terminal', ARRAY['carte d''embarquement', 'porte', 'depart', 'bagages', 'douane'], ARRAY['present tense questions', 'modal verbs'], 'beginner', 'Travel', 1),
  ('fr', 'Ordering at a Restaurant', 'Read a menu, order food, ask for the bill', 'Waiter at a Parisian bistro', 'Traditional French restaurant', ARRAY['menu', 'entree', 'plat principal', 'dessert', 'addition'], ARRAY['conditional', 'partitive articles'], 'beginner', 'Daily Life', 2),
  ('de', 'At the Airport', 'Navigate check-in, security, and boarding', 'Airport staff member', 'International airport terminal', ARRAY['Bordkarte', 'Flugsteig', 'Abflug', 'Gepack', 'Zoll'], ARRAY['present tense questions', 'modal verbs'], 'beginner', 'Travel', 1),
  ('de', 'Ordering at a Restaurant', 'Read a menu, order food, ask for the bill', 'Waiter at a German restaurant', 'Traditional German restaurant', ARRAY['Speisekarte', 'Vorspeise', 'Hauptgericht', 'Nachspeise', 'Rechnung'], ARRAY['modal verbs', 'accusative case'], 'beginner', 'Daily Life', 2);
