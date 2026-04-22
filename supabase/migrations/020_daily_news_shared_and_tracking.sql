-- Migration 020 — Shared Daily News + per-user read tracking.
--
-- Creates (or reuses) a shared `daily_news` table keyed by
-- (date, language, tier). `tier` is one of 'easy' (A1-B1) or 'hard' (B2-C1)
-- so each supported language gets two articles per day. All users of a
-- language + tier share the same article.
--
-- Also creates `user_news_reads` so we can show "read" state per user and
-- unlock future streak / daily-challenge integration.
--
-- Schedules a pg_cron job at 09:00 + 10:00 UTC daily to generate the 18
-- articles (9 languages × 2 tiers). The edge function is idempotent via
-- ON CONFLICT (date, language, tier) DO NOTHING, so the second fire no-ops.
--
-- One-time MANUAL steps required after this migration applies:
--
--   1. Generate a strong random secret, e.g.:
--        openssl rand -hex 32
--
--   2. Make that value available to the edge function runtime
--      (Supabase dashboard → Edge Functions → Secrets, or CLI):
--        supabase secrets set CRON_SECRET=<secret>
--
--   3. Store the SAME value in Vault so pg_cron can read it at
--      schedule time (run in the SQL editor):
--        SELECT vault.create_secret('<secret>', 'cron_secret');

-- ── 1. Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 2. Create the shared daily_news table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  language TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'easy' CHECK (tier IN ('easy', 'hard')),
  cefr_level TEXT NOT NULL DEFAULT 'B1',
  title TEXT NOT NULL,
  title_translation TEXT,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  content_translation TEXT,
  vocabulary_highlights JSONB NOT NULL DEFAULT '[]',
  source_topic TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- In case a partial earlier migration created the table without the tier
-- column, backfill it here defensively.
ALTER TABLE public.daily_news
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'easy'
    CHECK (tier IN ('easy', 'hard'));

-- Swap any legacy (date, language) unique for the new (date, language, tier)
ALTER TABLE public.daily_news
  DROP CONSTRAINT IF EXISTS daily_news_date_language_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_news_date_language_tier_key'
  ) THEN
    ALTER TABLE public.daily_news
      ADD CONSTRAINT daily_news_date_language_tier_key
        UNIQUE (date, language, tier);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_news_date_lang_tier
  ON public.daily_news (date, language, tier);

-- ── 3. Enable RLS on daily_news ──────────────────────────────────────────
-- Public read for any authenticated user (articles are shared content).
-- Writes only via service-role inside the cron function; RLS blocks regular
-- users from inserting fabricated articles.
ALTER TABLE public.daily_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read daily_news" ON public.daily_news;
CREATE POLICY "authenticated read daily_news"
  ON public.daily_news FOR SELECT
  TO authenticated
  USING (true);

-- ── 4. user_news_reads table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_news_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.daily_news(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_news_reads_user_read
  ON public.user_news_reads (user_id, read_at DESC);

ALTER TABLE public.user_news_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own reads select" ON public.user_news_reads;
CREATE POLICY "own reads select"
  ON public.user_news_reads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own reads insert" ON public.user_news_reads;
CREATE POLICY "own reads insert"
  ON public.user_news_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Schedule the cron ─────────────────────────────────────────────────
-- Unschedule any prior version first so the migration is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-news-cron') THEN
    PERFORM cron.unschedule('daily-news-cron');
  END IF;
END $$;

-- Dual-fire at 09:00 and 10:00 UTC covers both DST mappings to ≈5 AM Eastern.
SELECT cron.schedule(
  'daily-news-cron',
  '0 9,10 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngqpsuixmumdnqbqxjxv.supabase.co/functions/v1/daily-news-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
          FROM vault.decrypted_secrets
         WHERE name = 'cron_secret'
         LIMIT 1
      )
    ),
    body := jsonb_build_object('trigger', 'pg_cron')
  );
  $cron$
);
