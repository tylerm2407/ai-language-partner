CREATE TABLE public.daily_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  language TEXT NOT NULL,
  cefr_level TEXT NOT NULL DEFAULT 'B1',
  title TEXT NOT NULL,
  title_translation TEXT,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  content_translation TEXT,
  vocabulary_highlights JSONB NOT NULL DEFAULT '[]',
  source_topic TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, language)
);
CREATE INDEX idx_daily_news_date_lang ON public.daily_news(date, language);
