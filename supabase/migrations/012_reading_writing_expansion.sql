-- Migration 012: Reading & Writing Expansion
-- Adds reading_books, user_book_progress, book_annotations tables
-- and extends writing_prompts/user_writing_submissions for scaffolding + resubmission

-- ── New table: reading_books ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reading_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('gutenberg', 'wikisource', 'ai_generated')),
  source_id text,
  language text NOT NULL,
  cefr_level text NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  title text NOT NULL,
  author text,
  description text,
  content text NOT NULL,
  word_count integer NOT NULL,
  chapter_breaks integer[] DEFAULT '{}',
  image_url text,
  tags text[] DEFAULT '{}',
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_books_lang_level ON public.reading_books(language, cefr_level);
CREATE INDEX IF NOT EXISTS idx_reading_books_source ON public.reading_books(source);

-- ── New table: user_book_progress ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.reading_books(id) ON DELETE CASCADE,
  current_position integer DEFAULT 0,
  current_chapter integer DEFAULT 0,
  percent_complete numeric(5,2) DEFAULT 0,
  time_spent_ms bigint DEFAULT 0,
  words_looked_up integer DEFAULT 0,
  completed_at timestamptz,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_user_book_progress_user ON public.user_book_progress(user_id);

-- ── New table: book_annotations ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.book_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.reading_books(id) ON DELETE CASCADE,
  word_or_phrase text NOT NULL,
  translation text NOT NULL,
  part_of_speech text,
  audio_url text,
  UNIQUE (book_id, word_or_phrase)
);

CREATE INDEX IF NOT EXISTS idx_book_annotations_book ON public.book_annotations(book_id);

-- ── Alter writing_prompts: add scaffold columns ─────────────────
ALTER TABLE public.writing_prompts
  ADD COLUMN IF NOT EXISTS scaffold_type text DEFAULT 'free'
  CHECK (scaffold_type IN ('fill_blank', 'sentence_frame', 'guided_paragraph', 'essay', 'academic', 'free'));

ALTER TABLE public.writing_prompts
  ADD COLUMN IF NOT EXISTS scaffold_data jsonb DEFAULT '{}';

ALTER TABLE public.writing_prompts
  ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3;

-- ── Alter user_writing_submissions: add attempt tracking ────────
ALTER TABLE public.user_writing_submissions
  ADD COLUMN IF NOT EXISTS attempt_number integer DEFAULT 1;

-- ── RLS Policies ────────────────────────────────────────────────

-- reading_books: anyone authenticated can read published books
ALTER TABLE public.reading_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read published books"
  ON public.reading_books FOR SELECT
  TO authenticated
  USING (is_published = true);

-- user_book_progress: users read/write their own progress
ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own book progress"
  ON public.user_book_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own book progress"
  ON public.user_book_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own book progress"
  ON public.user_book_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- book_annotations: anyone authenticated can read
ALTER TABLE public.book_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read book annotations"
  ON public.book_annotations FOR SELECT
  TO authenticated
  USING (true);
