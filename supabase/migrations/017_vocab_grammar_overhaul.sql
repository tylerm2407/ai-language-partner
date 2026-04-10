-- Migration 017: Vocabulary & Grammar Course System Overhaul
-- Adds content provenance tracking, grammar rules, enhanced exercise types,
-- and richer metadata for vocabulary and grammar exercises.

-- ═══════════════════════════════════════════════════════════════
-- 1. Content Sources — provenance tracking for all imported data
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT,
  license TEXT NOT NULL,
  attribution TEXT,
  description TEXT,
  last_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_sources_read_all" ON public.content_sources
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 2. Grammar Rules — structured grammar reference per language
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.grammar_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  rule_name TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  examples JSONB NOT NULL DEFAULT '[]',
  common_errors JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  source_id UUID REFERENCES public.content_sources(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(language, rule_name)
);

ALTER TABLE public.grammar_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grammar_rules_read_all" ON public.grammar_rules
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 3. Cards — add provenance + enhanced vocab metadata
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS cefr_level TEXT,
  ADD COLUMN IF NOT EXISTS skill_type TEXT DEFAULT 'vocabulary'
    CHECK (skill_type IN ('vocabulary', 'grammar')),
  ADD COLUMN IF NOT EXISTS subskill TEXT,
  ADD COLUMN IF NOT EXISTS word_family TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collocations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS frequency_rank INT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'seed'
    CHECK (source_type IN ('imported', 'ai_generated', 'seed', 'manual')),
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.content_sources(id),
  ADD COLUMN IF NOT EXISTS source_item_id TEXT,
  ADD COLUMN IF NOT EXISTS license TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 4. Exercises — expand types, add skill targeting + provenance
-- ═══════════════════════════════════════════════════════════════

-- Drop existing type constraint and add expanded one
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_type_check
  CHECK (type IN (
    'multiple_choice', 'listening_choice', 'listening_type',
    'translate_to_target', 'translate_to_native',
    'speaking', 'fill_blank', 'free_production',
    'cloze_deletion', 'sentence_construction', 'dictation',
    'error_correction',
    'collocation_match', 'word_form',
    'sentence_transformation', 'mini_dialogue'
  ));

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS skill_type TEXT DEFAULT 'vocabulary'
    CHECK (skill_type IN ('vocabulary', 'grammar', 'mixed')),
  ADD COLUMN IF NOT EXISTS subskill TEXT,
  ADD COLUMN IF NOT EXISTS response_mode TEXT DEFAULT 'tap'
    CHECK (response_mode IN ('tap', 'type', 'speak')),
  ADD COLUMN IF NOT EXISTS target_word TEXT,
  ADD COLUMN IF NOT EXISTS target_grammar TEXT,
  ADD COLUMN IF NOT EXISTS accepted_speech_variants TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS distractors TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'seed'
    CHECK (source_type IN ('imported', 'ai_generated', 'seed', 'manual')),
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.content_sources(id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Indexes for new query patterns
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cards_language_level ON public.cards(language, cefr_level);
CREATE INDEX IF NOT EXISTS idx_cards_source ON public.cards(source_type);
CREATE INDEX IF NOT EXISTS idx_cards_source_dedup ON public.cards(source_id, source_item_id);
CREATE INDEX IF NOT EXISTS idx_exercises_skill_type ON public.exercises(skill_type);
CREATE INDEX IF NOT EXISTS idx_exercises_response_mode ON public.exercises(response_mode);
CREATE INDEX IF NOT EXISTS idx_grammar_rules_lang ON public.grammar_rules(language, cefr_level);

-- ═══════════════════════════════════════════════════════════════
-- 6. Backfill language/cefr_level on existing cards from course
-- ═══════════════════════════════════════════════════════════════

UPDATE public.cards c SET
  language = co.target_language,
  cefr_level = co.cefr_level
FROM public.courses co
WHERE c.course_id = co.id AND c.language IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 7. Register seed generator as a content source
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.content_sources (name, license, description)
VALUES ('fluenci_seed', 'proprietary', 'Auto-generated seed content from generate_seed.py')
ON CONFLICT (name) DO NOTHING;
