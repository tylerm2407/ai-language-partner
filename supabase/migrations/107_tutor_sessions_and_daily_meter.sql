-- 107 — The live voice tutor, part 1: the daily meter and the session ledger.
--
-- The tutor is a speech-to-speech WebRTC session between the learner's device
-- and OpenAI. Once the SDP exchange completes WE ARE NOT IN THE MEDIA PATH, so
-- there is no request to meter and no connection we can close. A client can
-- mint a token, stop calling home, and keep spending our money for twenty
-- minutes. That single fact is why this table exists and why the metering is
-- reserve-and-refund rather than settle-as-you-go: settle-as-you-go bills only
-- the honest.
--
-- Applied to production 2026-09-06.

-- ─── 1. The daily counter ────────────────────────────────────────────────

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS tutor_seconds integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.tutor_seconds IS
  'Seconds of live Realtime tutor session RESERVED today. Deliberately NOT '
  'daily_usage.voice_minutes: that column is NUMERIC (so it cannot join '
  'consume_daily_quota, whose p_amount is integer) and is metered by a racy '
  'read-then-write split across the transcribe and tts functions. It also '
  'prices a ~$0.02/min product; the Realtime tutor is roughly 5x that, and one '
  'wallet meaning two prices mis-prices both. Integer seconds so the existing '
  'atomic check-and-increment can meter it unchanged.';

-- ─── 2. consume_daily_quota — restated with tutor_seconds ────────────────
--
-- Body copied verbatim from the LIVE definition (pg_get_functiondef on
-- 2026-09-06), not from migration 095. 103 added 'goal_tracks' and
-- 'audiobook_chapters' to the whitelist, making it twelve counters; replaying
-- 095's ten-counter list would silently break generate-goal-track and
-- audiobook. CREATE OR REPLACE cannot patch one line, so the whole body has to
-- be restated, which is exactly how that list drifts. Verify against prod
-- before editing this again.

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
BEGIN
  IF p_counter NOT IN ('text_messages','writing_grades','pronunciation_scores','stories_generated','avatars_generated','lesson_tts_plays','hints_generated','translations','word_lookups','chat_cards','goal_tracks','audiobook_chapters','tutor_seconds') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  v_today := public.fluenci_user_today(p_user_id);

  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format('UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = $3', p_counter)
      USING p_user_id, p_amount, v_today;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true', p_counter)
  USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

-- ─── 3. refund_daily_quota — tutor_seconds, and a live bug ───────────────
--
-- Two changes, and the second one is a fix, not a feature.
--
-- The refund whitelist in production was TEN counters and did not include
-- 'chat_cards' — but ai-chat/index.ts:959 and :984 have been calling
-- refund_daily_quota with exactly that counter since migration 095. Every one
-- of those calls raised 'invalid quota counter: chat_cards', and because the
-- result of supabase.rpc() is not checked on that path, the exception was
-- swallowed and the refund silently never happened. A learner lost a chat_cards
-- slot every time a card insert or a review_items upsert failed. Adding it here
-- is what makes the documented behaviour actually true.
--
-- 'avatars_generated' stays OFF this list on purpose: it moved to the monthly
-- allowance in migration 105, and refunding it here would credit a counter
-- nothing debits any more.

CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid, p_counter text, p_amount integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages','writing_grades','pronunciation_scores','stories_generated','hints_generated','translations','word_lookups','goal_tracks','audiobook_chapters','lesson_tts_plays','chat_cards','tutor_seconds') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND date = $3', p_counter)
  USING p_user_id, p_amount, v_today;
END;
$function$;

-- ─── 4. The session ledger ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tutor_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language   text NOT NULL,
  native_language   text NOT NULL DEFAULT 'en',
  level             text NOT NULL,
  cefr_level        text NOT NULL,
  scenario_key      text,
  correction_mode   text NOT NULL CHECK (correction_mode IN ('as_you_go','let_me_talk')),
  voice             text NOT NULL,
  model             text NOT NULL,

  -- Reserved and charged IN FULL at start. The client is told this number and
  -- is expected to hang up at it. It is not what we ultimately bill.
  granted_seconds   integer NOT NULL CHECK (granted_seconds > 0),
  granted_cents     integer NOT NULL CHECK (granted_cents >= 0),

  -- What settlement decided we actually used. NULL until settled, which is
  -- also how a double-settle is detected.
  observed_seconds  integer CHECK (observed_seconds >= 0),

  started_at        timestamptz NOT NULL DEFAULT now(),

  -- The only thing that decides how much of an ABANDONED session is refunded.
  -- If the app is killed mid-call this is the last moment we can prove the
  -- learner was still there, so the reaper settles to it. That makes a hard
  -- kill cost at most one heartbeat interval of budget.
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),

  ended_at          timestamptz,
  end_reason        text CHECK (end_reason IN
                      ('learner','budget','safety','timeout','abandoned','error')),
  safety_cuts       integer NOT NULL DEFAULT 0,
  debrief           jsonb,
  analyzed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_started
  ON public.tutor_sessions (user_id, started_at DESC);

-- The reaper's only query. PARTIAL, because open sessions are a vanishing
-- fraction of this table and a full index would be almost entirely dead rows.
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_open_heartbeat
  ON public.tutor_sessions (last_heartbeat_at)
  WHERE ended_at IS NULL;

ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

-- Read-only to the learner. There is deliberately no INSERT, UPDATE or DELETE
-- policy: granted_cents and observed_seconds ARE the spend ceiling's
-- accounting, and debrief is model output. Same posture as
-- conversation_evidence and pronunciation_scores.
CREATE POLICY "Users read own tutor sessions" ON public.tutor_sessions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMENT ON TABLE public.tutor_sessions IS
  'One live speech-to-speech tutor session, and the ledger for reserve-and-'
  'refund metering. Minutes are charged in full at start and refunded down to '
  'what the SERVER observed, because the WebRTC media path is direct client-to-'
  'OpenAI: a client that stops calling home can still be spending money, so '
  'abandonment has to be the expensive choice rather than the free one.';
