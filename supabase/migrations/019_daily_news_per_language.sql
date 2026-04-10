-- ═══════════════════════════════════════════════════════════════
-- 019: Allow one daily news article per user per day PER LANGUAGE
-- Changes UNIQUE(user_id, date) → UNIQUE(user_id, date, language)
-- ═══════════════════════════════════════════════════════════════

-- Drop old constraint that only allows one article per day total
ALTER TABLE public.user_daily_news
  DROP CONSTRAINT IF EXISTS user_daily_news_user_id_date_key;

-- Add new constraint: one article per day per language
ALTER TABLE public.user_daily_news
  ADD CONSTRAINT user_daily_news_user_id_date_language_key UNIQUE(user_id, date, language);

-- Update index to include language for the new query pattern
DROP INDEX IF EXISTS idx_user_daily_news_user_date;
CREATE INDEX idx_user_daily_news_user_date_lang ON public.user_daily_news(user_id, date, language);
