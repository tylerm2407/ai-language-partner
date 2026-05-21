-- ═══════════════════════════════════════════════════════════════
-- 031: Add auth.uid() caller checks to SECURITY DEFINER functions
-- Prevents any authenticated user from modifying another user's data.
-- ═══════════════════════════════════════════════════════════════

-- 1. Fix increment_xp — add caller guard
CREATE OR REPLACE FUNCTION public.increment_xp(
  p_user_id UUID,
  p_amount INT
) RETURNS INT AS $$
DECLARE
  v_new_xp INT;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s XP';
  END IF;

  UPDATE public.user_profiles
  SET total_xp = total_xp + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING total_xp INTO v_new_xp;

  RETURN COALESCE(v_new_xp, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix increment_daily_usage — add caller guard
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
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage';
  END IF;

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
