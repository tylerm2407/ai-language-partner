-- ═══════════════════════════════════════════════════════════════
-- 080: give the news-audio cron a timeout it can actually finish in
--
-- `net.http_post` defaults to a FIVE SECOND timeout. Rendering two Spanish
-- articles takes ~20s, and a single hard-tier article is ~100 seconds of
-- speech, so the scheduled job at 09:20/10:20 UTC would time out on every
-- single run.
--
-- The work itself still completed — pg_net abandoning the request does not
-- stop the edge function, and migration 079's rows did render. What was lost
-- was the ANSWER: `net._http_response` recorded
--   "Timeout of 5000 ms reached"
-- instead of the run summary, every night, forever. So a genuine failure —
-- no fish voice for a language, a provider outage, an unbalanced queue — would
-- have looked exactly like the normal case, and the `unaccounted`/`balanced`
-- counters that exist to make silent drops visible would never have been read
-- by anything.
--
-- 120s is chosen to clear the observed worst case (~20s for two articles, with
-- concurrency 3 across at most a handful of active languages) with room to
-- spare, while still bounding a genuinely hung request.
--
-- NOTE: `daily-news-cron` (migration 020b) has the same missing timeout and the
-- same silent-result problem. It is long-standing and out of scope here, but it
-- is the same one-line fix if someone wants the article generation observable
-- too.
-- ═══════════════════════════════════════════════════════════════

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
    timeout_milliseconds := 120000
  );
  $cron$
);
