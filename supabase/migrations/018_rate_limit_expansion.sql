-- ═══════════════════════════════════════════════════════════════
-- 018: Rate Limit Expansion — Writing Grades & Pronunciation Scores
-- Adds per-feature daily counters for 50% profit margin enforcement.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add new columns to daily_usage
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS writing_grades INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pronunciation_scores INTEGER NOT NULL DEFAULT 0;

-- 2. Recreate increment function with new columns
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0,
  p_writing_grades INT DEFAULT 0,
  p_pronunciation_scores INT DEFAULT 0
) RETURNS TABLE(
  text_messages INT,
  voice_minutes REAL,
  ai_chat_minutes REAL,
  writing_grades INT,
  pronunciation_scores INT
) AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes, ai_chat_minutes, writing_grades, pronunciation_scores)
  VALUES (p_user_id, p_date, p_text_messages, p_voice_minutes, p_ai_chat_minutes, p_writing_grades, p_pronunciation_scores)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    ai_chat_minutes = daily_usage.ai_chat_minutes + EXCLUDED.ai_chat_minutes,
    writing_grades = daily_usage.writing_grades + EXCLUDED.writing_grades,
    pronunciation_scores = daily_usage.pronunciation_scores + EXCLUDED.pronunciation_scores;

  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes::REAL, du.ai_chat_minutes::REAL, du.writing_grades, du.pronunciation_scores
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
