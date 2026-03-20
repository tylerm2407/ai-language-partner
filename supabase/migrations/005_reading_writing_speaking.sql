-- Migration 005: Reading library, writing practice, speaking practice, AI usage ledger
-- Run: npx supabase db push

-- ─── CEFR Level Enum ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE cefr_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Add CEFR level to units ────────────────────────────────────

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS cefr_level cefr_level;

-- ─── Writing Prompt Type Enum ───────────────────────────────────

DO $$ BEGIN
  CREATE TYPE writing_prompt_type AS ENUM ('phrase', 'sentence', 'paragraph', 'letter', 'essay');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── AI Feature Enum ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ai_feature AS ENUM ('chat', 'tutor_conversation', 'writing_feedback', 'pronunciation_feedback');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Reading Materials ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reading_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  level cefr_level NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  is_public_domain BOOLEAN NOT NULL DEFAULT false,
  text TEXT NOT NULL,
  summary TEXT,
  word_count INTEGER,
  difficulty_score NUMERIC(4,2),  -- 0.00–10.00 scale
  download_url_pdf TEXT,
  download_url_epub TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reading_materials_course ON public.reading_materials(course_id);
CREATE INDEX idx_reading_materials_level ON public.reading_materials(level);
CREATE INDEX idx_reading_materials_difficulty ON public.reading_materials(difficulty_score);

-- ─── Reading Audio ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reading_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  voice_type TEXT,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reading_audio_reading ON public.reading_audio(reading_id);

-- ─── Writing Prompts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.writing_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  level cefr_level NOT NULL,
  type writing_prompt_type NOT NULL,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  min_words INTEGER,
  max_words INTEGER,
  sample_outline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_writing_prompts_course ON public.writing_prompts(course_id);
CREATE INDEX idx_writing_prompts_level ON public.writing_prompts(level);
CREATE INDEX idx_writing_prompts_type ON public.writing_prompts(type);

-- ─── Writing Submissions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.writing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.writing_prompts(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  level cefr_level,
  text TEXT NOT NULL,
  ai_feedback_json JSONB,
  grammar_score NUMERIC(4,2),
  vocab_score NUMERIC(4,2),
  coherence_score NUMERIC(4,2),
  spelling_score NUMERIC(4,2),
  overall_score NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_writing_submissions_user ON public.writing_submissions(user_id);
CREATE INDEX idx_writing_submissions_prompt ON public.writing_submissions(prompt_id);
CREATE INDEX idx_writing_submissions_created ON public.writing_submissions(created_at DESC);

-- ─── Speaking Attempts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.speaking_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reading_id UUID REFERENCES public.reading_materials(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  target_text_ref TEXT,   -- paragraph index, card reference, etc.
  pronunciation_score NUMERIC(4,2),
  fluency_score NUMERIC(4,2),
  rhythm_score NUMERIC(4,2),
  overall_score NUMERIC(4,2),
  ai_feedback_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_speaking_attempts_user ON public.speaking_attempts(user_id);
CREATE INDEX idx_speaking_attempts_reading ON public.speaking_attempts(reading_id);
CREATE INDEX idx_speaking_attempts_created ON public.speaking_attempts(created_at DESC);

-- ─── AI Usage Ledger ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature ai_feature NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_free_tier BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_ai_usage_ledger_user ON public.ai_usage_ledger(user_id);
CREATE INDEX idx_ai_usage_ledger_user_feature ON public.ai_usage_ledger(user_id, feature);
CREATE INDEX idx_ai_usage_ledger_timestamp ON public.ai_usage_ledger(timestamp DESC);

-- ─── RLS Policies ───────────────────────────────────────────────

-- Reading Materials: read-only for authenticated users
ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read reading materials"
  ON public.reading_materials FOR SELECT
  USING (auth.role() = 'authenticated');

-- Reading Audio: read-only for authenticated users
ALTER TABLE public.reading_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read reading audio"
  ON public.reading_audio FOR SELECT
  USING (auth.role() = 'authenticated');

-- Writing Prompts: read-only for authenticated users
ALTER TABLE public.writing_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read writing prompts"
  ON public.writing_prompts FOR SELECT
  USING (auth.role() = 'authenticated');

-- Writing Submissions: users own their submissions
ALTER TABLE public.writing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own writing submissions"
  ON public.writing_submissions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own writing submissions"
  ON public.writing_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert writing submissions"
  ON public.writing_submissions FOR INSERT
  WITH CHECK (true);

-- Speaking Attempts: users own their attempts
ALTER TABLE public.speaking_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own speaking attempts"
  ON public.speaking_attempts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own speaking attempts"
  ON public.speaking_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert speaking attempts"
  ON public.speaking_attempts FOR INSERT
  WITH CHECK (true);

-- AI Usage Ledger: users can read own; service role inserts
ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own AI usage"
  ON public.ai_usage_ledger FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert AI usage"
  ON public.ai_usage_ledger FOR INSERT
  WITH CHECK (true);
