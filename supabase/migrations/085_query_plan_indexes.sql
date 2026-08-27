-- 085 — Index the queries that actually run; drop the ones that only cost writes.
--
-- Every item below was checked against live `pg_indexes` first. Sizes are small
-- today (three users), which is exactly why this is cheap to do now: these are
-- the reads that grow per-learner-per-day.

-- ─── Missing indexes ─────────────────────────────────────────────────────

-- The per-card accuracy lookup inside a review session. `card_id` appears in
-- NONE of review_logs' three indexes and is also an unindexed foreign key, and
-- this runs once per card on the highest-growth table in the schema
-- (~18,000 rows/year for one daily learner).
CREATE INDEX IF NOT EXISTS idx_review_logs_user_card_time
  ON public.review_logs (user_id, card_id, reviewed_at DESC);

-- Home's "week in words" panel. Both existing correction_log indexes put a
-- discriminating column (short_label / error_type) between `user_id` and
-- `created_at`, so `created_at` cannot serve as a range qual for a query that
-- does not also filter on that middle column.
CREATE INDEX IF NOT EXISTS idx_correction_log_user_time
  ON public.correction_log (user_id, created_at DESC);

-- Opening one writing prompt read every submission the learner had ever made:
-- `prompt_id` is in no index at all. Also covers the flagged FK.
CREATE INDEX IF NOT EXISTS idx_user_writing_user_prompt_attempt
  ON public.user_writing_submissions (user_id, prompt_id, attempt_number DESC);

-- Course-scoped skill filtering. `idx_cards_language_level_skill` leads with
-- `language`, so it does not apply to a query that filters on course.
CREATE INDEX IF NOT EXISTS idx_cards_course_skill
  ON public.cards (course_id, skill_type);

-- ─── Redundant indexes: pure write amplification ─────────────────────────
-- Each of these duplicates a UNIQUE constraint index on exactly the same
-- columns, or is a strict prefix of a wider index. The planner can use the
-- UNIQUE/wider one for every query the dropped index served, so the only thing
-- they were contributing was work on every INSERT and UPDATE.
--
-- `daily_stats` and `daily_usage` are written on essentially every session.
-- The `_key` indexes are NEVER dropped — they enforce the constraints.

DROP INDEX IF EXISTS public.idx_daily_stats_user_date;        -- = daily_stats_user_id_date_key
DROP INDEX IF EXISTS public.idx_daily_usage_user_date;        -- = daily_usage_user_id_date_key
DROP INDEX IF EXISTS public.idx_user_daily_news_user_date;    -- = user_daily_news_user_id_date_key
DROP INDEX IF EXISTS public.idx_user_reading_progress_user;   -- = user_reading_progress_user_id_passage_id_key
DROP INDEX IF EXISTS public.idx_daily_news_date_lang_tier;    -- = daily_news_date_language_tier_key
DROP INDEX IF EXISTS public.idx_cards_language_level;         -- prefix of idx_cards_language_level_skill
DROP INDEX IF EXISTS public.idx_cards_course;                 -- prefix of the new idx_cards_course_skill

-- ─── client_events retention ─────────────────────────────────────────────
--
-- `client_events` is the XP idempotency ledger and grows one row per award
-- forever, and `increment_xp_idempotent` probes its primary key on every award.
--
-- It CANNOT simply be swept on age. Since migrations 083/084 several keys are a
-- PERMANENT ledger rather than a short-lived dedupe window:
--
--   xp:lesson:v1:<lessonId>      one payout per lesson, ever
--   xp:book:v1:<bookId>          one payout per book, ever
--   xp:writing:v1:<submissionId> one payout per submission
--   onboarding-checklist:v1      one payout, ever
--
-- Deleting any of those re-opens the exact XP-minting bug they were introduced
-- to close: the learner replays the lesson and is paid a second time.
--
-- Only the RANDOM per-call keys (`xp:earn:<random>`, from `makeXpKey`) are
-- genuinely ephemeral — they exist to make a lost-response retry safe, a window
-- measured in seconds. 90 days is far beyond that and comfortably beyond the
-- offline queue's 7-day replay TTL.
CREATE INDEX IF NOT EXISTS idx_client_events_created
  ON public.client_events (created_at);

CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  api_deleted INTEGER;
  translation_deleted INTEGER;
  events_deleted INTEGER;
BEGIN
  DELETE FROM public.api_cache WHERE expires_at < now();
  GET DIAGNOSTICS api_deleted = ROW_COUNT;

  DELETE FROM public.translation_cache WHERE expires_at < now();
  GET DIAGNOSTICS translation_deleted = ROW_COUNT;

  -- Ephemeral idempotency keys only. The `v1` ledger keys and the onboarding
  -- key are deliberately excluded — see the note above.
  DELETE FROM public.client_events
   WHERE created_at < now() - interval '90 days'
     AND event_key NOT LIKE 'xp:lesson:v1:%'
     AND event_key NOT LIKE 'xp:book:v1:%'
     AND event_key NOT LIKE 'xp:writing:v1:%'
     AND event_key NOT LIKE 'onboarding-checklist:%';
  GET DIAGNOSTICS events_deleted = ROW_COUNT;

  RETURN api_deleted + translation_deleted + events_deleted;
END;
$function$;
