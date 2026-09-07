-- 110 — The live voice tutor, part 4: automated safety flags, and the reaper.
--
-- DEPLOY NOTE: the table half was applied 2026-09-06; the cron.schedule at the
-- bottom was applied 2026-09-07, AFTER tutor-session-reaper was deployed.
-- Order matters: scheduling first means every tick 404s until the function
-- exists. Replaying this file into a fresh database applies both at once,
-- which is correct there.
--
-- Applied to production 2026-09-06 (table + policies).

-- ─── Automated safety flags ──────────────────────────────────────────────
--
-- Deliberately NOT ai_content_reports. That table (migration 053) is a
-- USER-FILED queue: its `reason` CHECK is the six things a person picks from,
-- its INSERT policy is owner-scoped, and a human triages it for Google Play
-- compliance. Machine flags would drown the signal it exists to carry — and a
-- live tutor generates them at conversation rate, not at complaint rate.
--
-- A learner's own "report this" button about the tutor still files into
-- ai_content_reports with surface = 'voice', which is already in its CHECK
-- constraint. The two paths stay separate on purpose.

CREATE TABLE IF NOT EXISTS public.tutor_safety_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  speaker         text NOT NULL CHECK (speaker IN ('tutor','learner')),
  flags           text[] NOT NULL,
  excerpt         text NOT NULL CHECK (char_length(excerpt) <= 500),
  -- False for learner rows: we log what the learner said for pattern analysis
  -- but never cut them off. Cutting a learner off for swearing in the language
  -- they are learning is not a safety feature.
  cut_audio       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_safety_events_created
  ON public.tutor_safety_events (created_at DESC);

ALTER TABLE public.tutor_safety_events ENABLE ROW LEVEL SECURITY;

-- NO POLICIES AT ALL, and that is the intended final state. service_role
-- bypasses RLS, so this is deny-all to every client — the same posture as
-- api_cache, hint_cache, translation_cache and checkpoint_items. The Supabase
-- advisor reports it as INFO rls_enabled_no_policy; accept it, do not "fix" it
-- by adding a permissive policy (CLAUDE.md section 4).
--
-- The reason is specific here rather than merely conventional: letting a
-- learner read back the exact text the filter just cut is precisely the
-- outcome the cut existed to prevent.

COMMENT ON TABLE public.tutor_safety_events IS
  'Automated post-hoc safety flags on live tutor transcripts. Deny-all to '
  'clients by design. Learner-filed reports about the tutor go to '
  'ai_content_reports with surface = ''voice'' instead. Swept at 90 days by '
  'tutor-session-reaper.';

-- ─── The reaper schedule (apply AFTER the function is deployed) ──────────
--
-- Every 3 minutes. A session whose last_heartbeat_at is older than 90 seconds
-- is settled down to that timestamp: the learner is gone, and everything after
-- the last moment we could prove they were there is refunded. That is what
-- bounds the cost of an app being force-killed mid-call to one heartbeat.
--
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fluenci-tutor-reaper') THEN
    PERFORM cron.unschedule('fluenci-tutor-reaper');
  END IF;
END $$;

SELECT cron.schedule(
  'fluenci-tutor-reaper',
  '*/3 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngqpsuixmumdnqbqxjxv.supabase.co/functions/v1/tutor-session-reaper',
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
    timeout_milliseconds := 60000
  );
  $cron$
);
