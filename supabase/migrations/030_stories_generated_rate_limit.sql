-- ═══════════════════════════════════════════════════════════════
-- 030: Add stories_generated counter to daily_usage
-- Hard cap on generate-story calls to prevent runaway AI costs.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add column
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS stories_generated INTEGER NOT NULL DEFAULT 0;

-- 2. Recreate increment function with new column
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0,
  p_writing_grades INT DEFAULT 0,
  p_pronunciation_scores INT DEFAULT 0,
  p_stories_generated INT DEFAULT 0
) RETURNS TABLE(
  text_messages INT,
  voice_minutes REAL,
  ai_chat_minutes REAL,
  writing_grades INT,
  pronunciation_scores INT,
  stories_generated INT
) AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes, ai_chat_minutes, writing_grades, pronunciation_scores, stories_generated)
  VALUES (p_user_id, p_date, p_text_messages, p_voice_minutes, p_ai_chat_minutes, p_writing_grades, p_pronunciation_scores, p_stories_generated)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    ai_chat_minutes = daily_usage.ai_chat_minutes + EXCLUDED.ai_chat_minutes,
    writing_grades = daily_usage.writing_grades + EXCLUDED.writing_grades,
    pronunciation_scores = daily_usage.pronunciation_scores + EXCLUDED.pronunciation_scores,
    stories_generated = daily_usage.stories_generated + EXCLUDED.stories_generated;

  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes::REAL, du.ai_chat_minutes::REAL, du.writing_grades, du.pronunciation_scores, du.stories_generated
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
