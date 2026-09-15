-- 113 — Quota integrity hardening, from the 2026-09-08 rate-limit audit.
--
-- Four changes, each closing a way a learner could receive more than their
-- plan pays for. Function bodies are restated in full from the live
-- definitions (pg_get_functiondef, 2026-09-08) because CREATE OR REPLACE
-- cannot patch one line.
--
-- 1. tutor_sessions.call_id / connected_at. The SDP exchange for the live
--    tutor now goes through `tutor-session` (action `connect`), so the OpenAI
--    call id is known server-side and the call can be hung up. Before this,
--    `end` refunded the unused reservation while the device could keep the
--    WebRTC call open for as long as OpenAI allowed — the refund was the
--    exploit. Settlement now refunds only after a confirmed hangup.
--
-- 2. consume_voice_seconds / adjust_voice_seconds. `tts` and `transcribe`
--    gated `daily_usage.voice_minutes` with a read-then-increment: thirty
--    concurrent requests all read the same total and all passed. Both now
--    RESERVE seconds atomically before the provider call and settle to the
--    measured duration after it, the same shape the tutor uses.
--
-- 3. consume_daily_quota / consume_monthly_quota fail CLOSED on a NULL or
--    negative limit. The old bodies treated both as "unlimited, but recorded".
--    No caller has ever passed one on purpose, and a limit that fails to
--    resolve must deny, not grant.
--
-- 4. release_free_avatar. generate-avatar now spends the lifetime free grant
--    BEFORE rendering (it used to spend it after, so a burst of requests got
--    three free images); a failed render gives it back through this.
--
-- Applied to production 2026-09-08 via the Supabase MCP; this file mirrors it.

-- ─── 1. Server-owned tutor calls ─────────────────────────────────────────

ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

COMMENT ON COLUMN public.tutor_sessions.call_id IS
  'OpenAI Realtime call id from the Location header of the SDP answer. The '
  'handle for POST /v1/realtime/calls/{id}/hangup. NULL until connect, and '
  'NULL after connect if OpenAI returned none — such a session is settled as '
  'spent in full because nothing can end it.';
COMMENT ON COLUMN public.tutor_sessions.connected_at IS
  'When the SDP exchange completed. NULL means no call was ever created, so '
  'the whole reservation is safe to refund.';

-- The overrun sweep: open sessions past their grant, regardless of heartbeat.
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_open_started
  ON public.tutor_sessions (started_at)
  WHERE ended_at IS NULL;

-- ─── 2. Atomic voice seconds ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_voice_seconds(
  p_user_id uuid, p_limit_minutes numeric, p_seconds numeric
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
  v_minutes numeric;
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds <> p_seconds THEN
    RAISE EXCEPTION 'invalid voice seconds' USING ERRCODE = '22023';
  END IF;
  -- Fail closed: an unresolved limit denies.
  IF p_limit_minutes IS NULL OR p_limit_minutes < 0 THEN
    RETURN false;
  END IF;

  v_minutes := p_seconds / 60.0;
  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_usage
     SET voice_minutes = COALESCE(voice_minutes, 0) + v_minutes
   WHERE user_id = p_user_id AND date = v_today
     AND COALESCE(voice_minutes, 0) + v_minutes <= p_limit_minutes
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

COMMENT ON FUNCTION public.consume_voice_seconds(uuid, numeric, numeric) IS
  'Atomically reserve seconds of voice against dailyVoiceMinutes. True if it '
  'fit. service_role only.';

-- Settlement: the signed difference between what was reserved and what the
-- provider actually billed. Floors at zero so a refund can never go negative.
CREATE OR REPLACE FUNCTION public.adjust_voice_seconds(
  p_user_id uuid, p_delta_seconds numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_delta_seconds IS NULL OR p_delta_seconds <> p_delta_seconds THEN
    RAISE EXCEPTION 'invalid voice seconds delta' USING ERRCODE = '22023';
  END IF;
  IF p_delta_seconds = 0 THEN RETURN; END IF;

  INSERT INTO public.daily_usage (user_id, date) VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_usage
     SET voice_minutes = GREATEST(0, COALESCE(voice_minutes, 0) + p_delta_seconds / 60.0)
   WHERE user_id = p_user_id AND date = v_today;
END;
$function$;

COMMENT ON FUNCTION public.adjust_voice_seconds(uuid, numeric) IS
  'Settle a voice reservation to the measured duration: positive adds, '
  'negative refunds, floored at zero. service_role only.';

REVOKE ALL ON FUNCTION public.consume_voice_seconds(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_voice_seconds(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voice_seconds(uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_voice_seconds(uuid, numeric) TO service_role;

-- ─── 3. Quota RPCs fail closed on an unresolved limit ────────────────────

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

  -- Fail CLOSED. Until migration 113 a NULL or negative limit meant
  -- "unlimited, but recorded". Nothing passes one on purpose; a limit that
  -- did not resolve is a reason to deny, never to grant.
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN false;
  END IF;

  v_today := public.fluenci_user_today(p_user_id);

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

CREATE OR REPLACE FUNCTION public.consume_monthly_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_month date;
BEGIN
  IF p_counter NOT IN ('avatars_generated','tutor_cents') THEN
    RAISE EXCEPTION 'invalid monthly quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;
  -- Fail CLOSED (migration 113): see consume_daily_quota.
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN false;
  END IF;

  v_month := public.fluenci_user_month(p_user_id);

  INSERT INTO public.monthly_usage (user_id, month) VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, month) DO NOTHING;

  EXECUTE format(
    'UPDATE public.monthly_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND month = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true', p_counter)
  USING p_user_id, p_limit, p_amount, v_month INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

-- Grants are unchanged by CREATE OR REPLACE, but restated so this file is
-- the whole truth: service_role only, never a client role.
REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_monthly_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_monthly_quota(uuid, text, integer, integer) TO service_role;

-- ─── 4. Give back an unspent free avatar ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_free_avatar(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('fluenci.gamification_write', '1', true);
  UPDATE public.user_profiles
     SET free_avatar_used_at = NULL
   WHERE user_id = p_user_id
     AND free_avatar_used_at IS NOT NULL;
END;
$function$;

COMMENT ON FUNCTION public.release_free_avatar(uuid) IS
  'Return the lifetime free avatar grant after a render that spent it failed. '
  'Pairs with consume_free_avatar, which generate-avatar now calls BEFORE '
  'rendering. service_role only.';

REVOKE ALL ON FUNCTION public.release_free_avatar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_free_avatar(uuid) TO service_role;
