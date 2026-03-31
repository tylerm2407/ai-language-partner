-- Migration 003: Reading, Writing & New Exercise Types
-- Adds tables for reading passages, writing prompts, and new exercise types.
-- Run: npx supabase db push

-- ─── Reading Passages ─────────────────────────────────────────────

CREATE TABLE public.reading_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_translation TEXT,
  word_count INT NOT NULL DEFAULT 0,
  audio_url TEXT,
  image_url TEXT,
  source_attribution TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Reading Annotations (tap-to-translate vocabulary) ────────────

CREATE TABLE public.reading_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  word_or_phrase TEXT NOT NULL,
  translation TEXT NOT NULL,
  start_index INT NOT NULL,
  end_index INT NOT NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  audio_url TEXT,
  part_of_speech TEXT
);

-- ─── Reading Comprehension Questions ──────────────────────────────

CREATE TABLE public.reading_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer', 'true_false')),
  correct_answer TEXT NOT NULL,
  accepted_answers TEXT[] NOT NULL DEFAULT '{}',
  options TEXT[]
);

-- ─── Writing Prompts ──────────────────────────────────────────────

CREATE TABLE public.writing_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  prompt_text TEXT NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('guided', 'free', 'error_correction', 'dictation', 'sentence_construction')),
  example_response TEXT,
  target_vocabulary TEXT[] NOT NULL DEFAULT '{}',
  target_grammar TEXT[] NOT NULL DEFAULT '{}',
  max_words INT,
  min_words INT,
  rubric_criteria JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── User Writing Submissions ─────────────────────────────────────

CREATE TABLE public.user_writing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.writing_prompts(id) ON DELETE CASCADE,
  submission_text TEXT NOT NULL,
  ai_feedback JSONB,
  overall_score REAL,
  word_count INT NOT NULL DEFAULT 0,
  time_spent_ms INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── User Reading Progress ────────────────────────────────────────

CREATE TABLE public.user_reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passage_id UUID NOT NULL REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  comprehension_score REAL,
  words_looked_up INT NOT NULL DEFAULT 0,
  time_spent_ms INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, passage_id)
);

-- ─── Alter cards: add context sentences & collocations ────────────

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS context_sentences JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS collocations TEXT[] NOT NULL DEFAULT '{}';

-- ─── Alter exercises: expand type enum, add metadata ──────────────

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_type_check
  CHECK (type IN (
    'multiple_choice', 'listening_choice', 'listening_type',
    'translate_to_target', 'translate_to_native',
    'speaking', 'fill_blank', 'free_production',
    'cloze_deletion', 'sentence_construction', 'dictation',
    'error_correction', 'reading_comprehension', 'guided_writing'
  ));

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- ─── Alter daily_stats: add reading & writing tracking ────────────

ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS reading_minutes REAL NOT NULL DEFAULT 0;
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS writing_minutes REAL NOT NULL DEFAULT 0;
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS words_written INT NOT NULL DEFAULT 0;
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS passages_read INT NOT NULL DEFAULT 0;

-- ─── Scalability Indexes ──────────────────────────────────────────

CREATE INDEX idx_reading_passages_course_level ON public.reading_passages(course_id, cefr_level);
CREATE INDEX idx_reading_passages_unit ON public.reading_passages(unit_id);
CREATE INDEX idx_reading_annotations_passage ON public.reading_annotations(passage_id);
CREATE INDEX idx_reading_questions_passage ON public.reading_questions(passage_id, order_index);
CREATE INDEX idx_writing_prompts_course_level ON public.writing_prompts(course_id, cefr_level);
CREATE INDEX idx_writing_prompts_unit ON public.writing_prompts(unit_id);
CREATE INDEX idx_user_writing_user_submitted ON public.user_writing_submissions(user_id, submitted_at DESC);
CREATE INDEX idx_user_reading_progress_user ON public.user_reading_progress(user_id, passage_id);

-- ─── Atomic daily stats increment function (scalability) ──────────

CREATE OR REPLACE FUNCTION public.increment_daily_stats(
  p_user_id UUID,
  p_date DATE,
  p_lessons_completed INT DEFAULT 0,
  p_cards_reviewed INT DEFAULT 0,
  p_cards_learned INT DEFAULT 0,
  p_minutes_practiced REAL DEFAULT 0,
  p_speaking_minutes REAL DEFAULT 0,
  p_listening_minutes REAL DEFAULT 0,
  p_reading_minutes REAL DEFAULT 0,
  p_writing_minutes REAL DEFAULT 0,
  p_words_written INT DEFAULT 0,
  p_passages_read INT DEFAULT 0,
  p_xp_earned INT DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_stats (
    user_id, date,
    lessons_completed, cards_reviewed, cards_learned,
    minutes_practiced, speaking_minutes, listening_minutes,
    reading_minutes, writing_minutes, words_written, passages_read,
    xp_earned
  ) VALUES (
    p_user_id, p_date,
    p_lessons_completed, p_cards_reviewed, p_cards_learned,
    p_minutes_practiced, p_speaking_minutes, p_listening_minutes,
    p_reading_minutes, p_writing_minutes, p_words_written, p_passages_read,
    p_xp_earned
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    lessons_completed = daily_stats.lessons_completed + EXCLUDED.lessons_completed,
    cards_reviewed = daily_stats.cards_reviewed + EXCLUDED.cards_reviewed,
    cards_learned = daily_stats.cards_learned + EXCLUDED.cards_learned,
    minutes_practiced = daily_stats.minutes_practiced + EXCLUDED.minutes_practiced,
    speaking_minutes = daily_stats.speaking_minutes + EXCLUDED.speaking_minutes,
    listening_minutes = daily_stats.listening_minutes + EXCLUDED.listening_minutes,
    reading_minutes = daily_stats.reading_minutes + EXCLUDED.reading_minutes,
    writing_minutes = daily_stats.writing_minutes + EXCLUDED.writing_minutes,
    words_written = daily_stats.words_written + EXCLUDED.words_written,
    passages_read = daily_stats.passages_read + EXCLUDED.passages_read,
    xp_earned = daily_stats.xp_earned + EXCLUDED.xp_earned;
END;
$$ LANGUAGE plpgsql;
