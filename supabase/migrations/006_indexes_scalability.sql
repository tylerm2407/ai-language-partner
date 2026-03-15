-- 006: Indexes and scalability improvements
-- ============================================================================

-- Leaderboard performance
CREATE INDEX IF NOT EXISTS idx_profiles_total_xp ON public.profiles (total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_streak_days ON public.profiles (streak_days DESC);

-- Conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON public.conversations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user ON public.conversation_sessions (user_id, started_at DESC);

-- SRS card review scheduling
CREATE INDEX IF NOT EXISTS idx_srs_cards_due ON public.srs_cards (user_id, language_slug, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- News articles by language
CREATE INDEX IF NOT EXISTS idx_news_articles_language ON public.news_articles (language_id, published_at DESC);

-- Subscription caching columns on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Materialized view for leaderboard rankings (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_xp AS
  SELECT id, username, full_name, avatar_url, total_xp, streak_days, subscription_tier,
         ROW_NUMBER() OVER (ORDER BY total_xp DESC) AS rank_xp,
         ROW_NUMBER() OVER (ORDER BY streak_days DESC) AS rank_streak
  FROM public.profiles
  WHERE total_xp > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_xp_id ON public.leaderboard_xp (id);

-- Function to refresh leaderboard (call from pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_xp;
END;
$$;
