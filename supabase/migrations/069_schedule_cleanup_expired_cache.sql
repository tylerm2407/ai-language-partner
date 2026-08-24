-- 069_schedule_cleanup_expired_cache.sql
--
-- cleanup_expired_cache() has existed since the cache tables were created but
-- was never scheduled, so no expired row had ever been swept — api_cache rows
-- only ever got overwritten by a later request under the same key. Its first
-- run removed 5 stale burst:* rate-limit counters left behind by the move to
-- Redis-backed rate limiting.
--
-- 04:17 UTC: off-peak for a US/EU learner base, and deliberately not on the
-- hour so it does not contend with daily-news-cron at 09:00/10:00.
-- unschedule-then-schedule keeps this re-runnable.

SELECT cron.unschedule('cleanup-expired-cache')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-cache');

SELECT cron.schedule(
  'cleanup-expired-cache',
  '17 4 * * *',
  $$SELECT public.cleanup_expired_cache();$$
);
