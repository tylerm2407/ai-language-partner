-- ═══════════════════════════════════════════════════════════════
-- 079: News podcast — audio narration for daily_news
--
-- Adds a rendered MP3 narration to each shared daily article, so the
-- daily news becomes listenable. Six columns on `daily_news` rather than
-- a side table: the relationship is strictly 1:1 and `fetchDailyNews`
-- already does `select('*')`, so a join would buy nothing and cost a
-- round trip on the app's most-hit read.
--
-- 1) The audio columns + their CHECK constraints.
-- 2) A partial render-queue index.
-- 3) A private `news-audio` storage bucket.
-- 4) A pg_cron job firing `daily-news-audio-cron` 20 minutes behind the
--    text cron.
--
-- Cost note: every learner of a (language, tier) shares one article and
-- one audio object, so synthesis cost is fixed at generation time and
-- does not scale with listeners. That is why playback is free and
-- unmetered — see supabase/functions/news-audio/index.ts.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Audio columns on daily_news ───────────────────────────────
--
-- `audio_path`, NOT `audio_url`, deliberately diverging from the
-- `reading_passages.audio_url` precedent: this holds a PRIVATE storage
-- object path, not something playable. Naming it `*_url` invites the
-- next caller to hand it straight to Audio.Sound and collect a 400. The
-- playable URL is minted per request, signed, and short-lived.
ALTER TABLE public.daily_news
  ADD COLUMN IF NOT EXISTS audio_path         TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS audio_voice_id     TEXT,
  ADD COLUMN IF NOT EXISTS audio_provider     TEXT,
  ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ,
  -- NO DEFAULT, and this is load-bearing rather than an oversight. A
  -- DEFAULT 'pending' would enlist all 2,262 pre-existing rows into the
  -- render queue on the next cron fire — 126 days of back-catalogue
  -- nobody asked for, at real per-character cost. NULL means "predates
  -- the feature, never rendered, never will be".
  ADD COLUMN IF NOT EXISTS audio_status       TEXT;

COMMENT ON COLUMN public.daily_news.audio_path IS
  'Object path inside the private `news-audio` bucket. NOT a URL — callers '
  'must mint a short-lived signed URL (see the news-audio edge function). '
  'NULL until a render succeeds.';

COMMENT ON COLUMN public.daily_news.audio_status IS
  'pending | generating | ready | failed. NULL = predates the podcast '
  'feature and is deliberately excluded from the render queue. Written '
  'only by service-role edge functions, never by a client.';

COMMENT ON COLUMN public.daily_news.audio_generated_at IS
  'Doubles as the claim timestamp while audio_status = ''generating'', so a '
  'render that died mid-flight can be reclaimed after 5 minutes rather than '
  'wedging the row forever.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_news_audio_status_check'
  ) THEN
    ALTER TABLE public.daily_news
      ADD CONSTRAINT daily_news_audio_status_check
      CHECK (audio_status IS NULL
             OR audio_status IN ('pending', 'generating', 'ready', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_news_audio_provider_check'
  ) THEN
    ALTER TABLE public.daily_news
      ADD CONSTRAINT daily_news_audio_provider_check
      CHECK (audio_provider IS NULL
             OR audio_provider IN ('fish', 'elevenlabs'));
  END IF;
END $$;

-- ── 2. Render-queue index ────────────────────────────────────────
-- Partial on purpose. The queue is at most a few dozen rows on any given
-- day while the table grows by 18/day forever, so indexing only the
-- unfinished states keeps the index permanently tiny and means 'ready'
-- rows — the overwhelming majority — cost nothing to carry.
CREATE INDEX IF NOT EXISTS idx_daily_news_audio_queue
  ON public.daily_news (date, audio_status)
  WHERE audio_status IN ('pending', 'generating', 'failed');

-- ── 3. RLS: nothing new, and that is the point ───────────────────
-- Recorded explicitly so the next reader does not think it was
-- forgotten. `daily_news` already carries "authenticated read daily_news"
-- (FOR SELECT TO authenticated, migration 020b §3) and new columns
-- inherit it — no per-column RLS exists in Postgres. Writes remain
-- service-role only, because no INSERT/UPDATE policy has ever existed on
-- this table.
--
-- Reading `audio_path` grants nothing on its own: the bucket below is
-- private with no storage.objects policies, so the path is unusable
-- without a signed URL that only the service-role function can mint.

-- ── 4. Private news-audio bucket ─────────────────────────────────
-- Same posture as `tts-cache` (migration 038): private, and deliberately
-- WITHOUT any storage.objects policy, which is deny-all for clients
-- since service_role bypasses RLS. The advisor reports that as INFO
-- `rls_enabled_no_policy`; it is the intended state (CLAUDE.md §4).
--
-- Separate bucket from `tts-cache` rather than a prefix inside it,
-- because the two have opposite lifecycles: a cached TTS clip is
-- evergreen (the curriculum caps it and every hit is free money), while
-- news audio is worthless after ~30 days and is swept on that schedule.
-- Mixing them would mean a sweep that has to understand which is which.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('news-audio', 'news-audio', false, 20971520, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 5. Schedule the audio cron ───────────────────────────────────
-- 20 minutes behind daily-news-cron ('0 9,10 * * *') so today's article
-- rows exist before we go looking for text to narrate.
--
-- A SEPARATE job and a separate function, not an extra step inside
-- daily-news-cron: that job already runs 90–120s, and more importantly a
-- fish.audio outage must never be able to stop the articles themselves
-- from being written. Text is the product; audio is an enhancement.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-news-audio-cron') THEN
    PERFORM cron.unschedule('daily-news-audio-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-news-audio-cron',
  '20 9,10 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngqpsuixmumdnqbqxjxv.supabase.co/functions/v1/daily-news-audio-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
          FROM vault.decrypted_secrets
         WHERE name = 'cron_secret'
         LIMIT 1
      )
    ),
    body := jsonb_build_object('trigger', 'pg_cron'),
    timeout_milliseconds := 300000
  );
  $cron$
);

-- ── 6. The atomic render claim ───────────────────────────────────
--
-- Both entry points (news-audio's lazy fallback and daily-news-audio-cron)
-- must be able to say "I am rendering this one" without two of them ever
-- rendering the same article. A read-then-write from an edge function
-- cannot do that: N concurrent listeners all see "not generating" and all
-- pay for the same narration.
--
-- The atomicity IS this function. The predicate re-evaluates under the row
-- lock the winner holds, so the loser sees `generating` and gets false —
-- the same mechanism as consume_free_avatar (migration 077).
--
-- Why an RPC rather than the equivalent PostgREST call: PostgREST cannot
-- put a logical OR in the WHERE clause of a mutation at all. `PATCH
-- /daily_news?id=eq.X&or=(...)` emits a table-qualified reference the
-- UPDATE's aliased target does not expose, and Postgres answers 42703
-- "column daily_news.<anything> does not exist" — verified against this
-- project on any column, new or old. So the claim has to live in SQL.
--
-- The stale clause is what stops a render that died mid-flight from
-- wedging the row until the next cron fire. It reclaims rather than
-- resets, so the loser of a live race still backs off.
CREATE OR REPLACE FUNCTION public.claim_news_audio(
  p_article_id uuid,
  p_stale_minutes integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  UPDATE public.daily_news
     SET audio_status = 'generating',
         audio_generated_at = now()
   WHERE id = p_article_id
     AND (audio_status IS DISTINCT FROM 'generating'
          OR audio_generated_at IS NULL
          OR audio_generated_at < now() - make_interval(mins => p_stale_minutes))
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$$;

-- SECURITY INVOKER, deliberately diverging from consume_free_avatar's
-- DEFINER. That function needed DEFINER because `user_profiles` carries an
-- owner UPDATE policy, so an INVOKER version would have let a signed-in
-- user spend their own flag. `daily_news` has NO update policy at all, so
-- INVOKER is already deny-all for everyone but service_role — which means
-- a future mis-grant to `authenticated` fails on RLS instead of running
-- with the owner's rights.
--
-- Claiming a render commits us to a paid synthesis, so it is entitlement
-- in the sense of CLAUDE.md §1.2 and no client may hold EXECUTE.
REVOKE ALL ON FUNCTION public.claim_news_audio(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_news_audio(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_news_audio(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_news_audio(uuid, integer) TO service_role;
