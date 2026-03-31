-- Migration 006: Add CEFR level to courses
-- Supports multiple courses per language at different proficiency levels

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cefr_level TEXT DEFAULT 'A1'
  CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

UPDATE public.courses SET cefr_level = 'A1' WHERE cefr_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_courses_cefr_level ON public.courses(target_language, cefr_level);
