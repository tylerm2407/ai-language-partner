-- ═══════════════════════════════════════════════════════════════
-- 050: Lock down daily_usage quota counters (quota integrity)
--
-- Two paths let an authenticated client reset its own AI-quota counters
-- and defeat server-side quota enforcement. This migration closes both.
--
-- HOLE 1 — RLS: migration 004 created an owner "FOR ALL" policy on
-- daily_usage that was never dropped, letting a client UPDATE/DELETE its
-- own counter row directly via PostgREST (e.g. `UPDATE daily_usage SET
-- text_messages = 0`). The client only ever needs to READ this table
-- (getOrCreateDailyUsage no longer writes it as of the paired app
-- change), so we replace it with a SELECT-only owner policy.
--
-- HOLE 2 — RPC: the authenticated increment_daily_usage overload from
-- migration 048 does `col = col + EXCLUDED.col` with no bound on the
-- delta. Being SECURITY DEFINER it bypasses RLS, so a negative delta
-- (p_text_messages => -1000000) resets the counter even after HOLE 1 is
-- closed. We clamp every delta to non-negative so this RPC can only ever
-- increase usage; legitimate decrements (refunds) go through the
-- service-role refund_daily_quota (migration 045).
--
-- auth.uid() is wrapped in a scalar subselect so it is evaluated once
-- per query instead of once per row (Supabase auth_rls_initplan lint).
-- ═══════════════════════════════════════════════════════════════

-- ── HOLE 1: SELECT-only RLS ──────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own daily usage" ON public.daily_usage;

DROP POLICY IF EXISTS "Users can read own daily usage" ON public.daily_usage;
CREATE POLICY "Users can read own daily usage"
  ON public.daily_usage FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── HOLE 2: clamp the authenticated increment RPC to non-negative ──
-- CREATE OR REPLACE preserves the existing 048 grants (authenticated).
-- Signature is unchanged so the no-p_date overload still resolves for
-- the client's incrementDailyUsage() call.
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_writing_grades INT DEFAULT 0,
  p_pronunciation_scores INT DEFAULT 0
) RETURNS SETOF public.daily_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage'
      USING ERRCODE = '42501';
  END IF;

  -- Only ever increase counters — see HOLE 2 above. p_voice_minutes is REAL,
  -- which also accepts NaN/±Infinity; GREATEST(0, 'NaN') stays NaN and would
  -- poison the counter (a stored NaN reads back as 0 in the app and disables
  -- the voice-minute gate), so coerce any non-finite value to 0 first.
  IF p_voice_minutes = 'NaN'::real
     OR p_voice_minutes = 'Infinity'::real
     OR p_voice_minutes = '-Infinity'::real THEN
    p_voice_minutes := 0;
  END IF;
  p_text_messages        := GREATEST(0, p_text_messages);
  p_voice_minutes        := GREATEST(0, p_voice_minutes);
  p_writing_grades       := GREATEST(0, p_writing_grades);
  p_pronunciation_scores := GREATEST(0, p_pronunciation_scores);

  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_usage
    (user_id, date, text_messages, voice_minutes, writing_grades, pronunciation_scores)
  VALUES
    (p_user_id, v_today, p_text_messages, p_voice_minutes, p_writing_grades, p_pronunciation_scores)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages        = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes        = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    writing_grades       = daily_usage.writing_grades + EXCLUDED.writing_grades,
    pronunciation_scores = daily_usage.pronunciation_scores + EXCLUDED.pronunciation_scores;

  RETURN QUERY
    SELECT * FROM public.daily_usage du
     WHERE du.user_id = p_user_id AND du.date = v_today;
END;
$$;

-- ── HOLE 2b: revoke authenticated from the date-carrying overloads ──
-- Migration 036 intended these three to be service_role-only, but prod
-- drifted and still grants EXECUTE to authenticated — the same negative/
-- non-finite delta reset vector as the no-date overload above. Only edge
-- functions (service_role) call the date-carrying overloads; the client's
-- incrementDailyUsage() uses the no-date overload (clamped above), so this
-- revoke is safe. service_role keeps its explicit grant.
REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
