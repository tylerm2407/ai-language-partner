-- Per-user on-demand daily news articles
CREATE TABLE public.user_daily_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  UNIQUE(user_id, date)
);

CREATE INDEX idx_user_daily_news_user_date ON public.user_daily_news(user_id, date);

-- RLS: users can only access their own rows
ALTER TABLE public.user_daily_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own daily news"
  ON public.user_daily_news FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily news"
  ON public.user_daily_news FOR INSERT
  WITH CHECK (auth.uid() = user_id);
