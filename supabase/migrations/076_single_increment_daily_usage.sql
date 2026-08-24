-- ═══════════════════════════════════════════════════════════════
-- 076: Collapse increment_daily_usage to ONE function
--
-- Prod carried four overloads. Three of them take p_date:
--
--   (uuid, date, int, real)
--   (uuid, date, int, real, real)
--   (uuid, date, int, real, real, int, int, int)
--
-- and every parameter after p_date carries DEFAULT 0. That makes all
-- three candidates for any PostgREST call whose named-arg set is
-- {p_user_id, p_date, ...a subset...}, so PostgREST refuses to pick:
--
--   PGRST203 "Could not choose the best candidate function between:
--             public.increment_daily_usage(p_user_id => uuid,
--             p_date => date, p_text_messages => integer, ...)"
--
-- Every date-carrying overload has therefore been UNCALLABLE since the
-- 8-arg one was added. This was not theoretical: the `tts` function has
-- been logging "[tts] Failed to increment voice_minutes" on every single
-- synthesis, so voice minutes were never metered and the per-plan voice
-- quota (get_effective_limits / PLANS[].dailyVoiceMinutes) was not being
-- enforced at all. `generate-story` hit the same error and did not even
-- check it — that call site discarded the result entirely.
--
-- Migration 048's note reasoned that the date overloads "REQUIRE p_date
-- (no default)" and so a no-p_date call would resolve unambiguously to
-- the new overload. That much was right, and the client's no-p_date
-- call has always worked. What it missed is that the date overloads are
-- mutually ambiguous with EACH OTHER, which is what broke the two
-- service-role callers.
--
-- The fix is structural rather than another overload: leave exactly one
-- function in the schema, so there is nothing left to disambiguate. Any
-- subset of named arguments resolves to it, and no future caller can
-- reintroduce PGRST203 by choosing a different argument set.
--
-- p_date is dropped rather than kept-and-ignored. Since migration 044
-- the day has been resolved server-side from the user's stored timezone
-- (fluenci_user_today) and the passed p_date was already discarded — a
-- parameter that looks authoritative but is silently ignored is worse
-- than no parameter.
--
-- Carries forward from the versions being dropped:
--   • 050's non-negative clamp and non-finite REAL coercion (a negative
--     delta would otherwise reset a counter — quota integrity).
--   • 044's server-side day resolution.
--   • the 8-arg overload's ai_chat_minutes / stories_generated columns,
--     plus avatars_generated, so no counter loses its increment path.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Drop every existing signature ─────────────────────────────
-- Including the no-date one from 048/050: parameters cannot be added by
-- CREATE OR REPLACE, and keeping it alongside a wider function would
-- recreate the exact ambiguity this migration exists to remove.
DROP FUNCTION IF EXISTS public.increment_daily_usage(uuid, date, integer, real);
DROP FUNCTION IF EXISTS public.increment_daily_usage(uuid, date, integer, real, real);
DROP FUNCTION IF EXISTS public.increment_daily_usage(uuid, date, integer, real, real, integer, integer, integer);
DROP FUNCTION IF EXISTS public.increment_daily_usage(uuid, integer, real, integer, integer);

-- ── 2. The one canonical function ────────────────────────────────
CREATE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_writing_grades INT DEFAULT 0,
  p_pronunciation_scores INT DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0,
  p_stories_generated INT DEFAULT 0,
  p_avatars_generated INT DEFAULT 0
) RETURNS SETOF public.daily_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid  := auth.uid();
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  -- Two independent signals for "this is a trusted server caller", because
  -- neither is reliable alone on this project:
  --
  --   • the JWT `role` claim — absent when the caller authenticates with the
  --     new-format `sb_secret_…` API key rather than a legacy JWT, and this
  --     project is already on the new format for its publishable key;
  --   • the `role` GUC left by PostgREST's SET ROLE — which, verified against
  --     this database, survives into SECURITY DEFINER (unlike `current_user`,
  --     which becomes the function owner).
  --
  -- `authenticated` cannot forge either: it has no membership in service_role,
  -- so it cannot SET ROLE, and PostgREST writes the claims itself.
  v_is_service boolean :=
    coalesce(v_claims ->> 'role', '') = 'service_role'
    OR coalesce(current_setting('role', true), '') = 'service_role';
  v_today date;
BEGIN
  -- Caller guard. service_role is the edge functions (tts, generate-story),
  -- which meter usage on behalf of a user and legitimately have no
  -- auth.uid(). Everyone else must be the owner of the row.
  --
  -- The role is checked explicitly rather than inferred from a NULL
  -- auth.uid(): `anon` also has a NULL uid, and while it holds no EXECUTE
  -- grant today, a guard that depends on the absence of a grant is one
  -- careless GRANT away from being no guard at all.
  IF NOT v_is_service THEN
    IF v_uid IS NULL OR v_uid <> p_user_id THEN
      RAISE EXCEPTION 'Forbidden: cannot modify another user''s usage'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Only ever increase counters (migration 050). p_voice_minutes and
  -- p_ai_chat_minutes are REAL, which also accepts NaN/±Infinity;
  -- GREATEST(0, 'NaN') stays NaN and would poison the counter (a stored
  -- NaN reads back as 0 in the app and disables the voice-minute gate),
  -- so coerce any non-finite value to 0 before clamping. Legitimate
  -- decrements go through refund_daily_quota (migration 045).
  IF p_voice_minutes = 'NaN'::real
     OR p_voice_minutes = 'Infinity'::real
     OR p_voice_minutes = '-Infinity'::real THEN
    p_voice_minutes := 0;
  END IF;
  IF p_ai_chat_minutes = 'NaN'::real
     OR p_ai_chat_minutes = 'Infinity'::real
     OR p_ai_chat_minutes = '-Infinity'::real THEN
    p_ai_chat_minutes := 0;
  END IF;
  p_text_messages        := GREATEST(0, p_text_messages);
  p_voice_minutes        := GREATEST(0, p_voice_minutes);
  p_writing_grades       := GREATEST(0, p_writing_grades);
  p_pronunciation_scores := GREATEST(0, p_pronunciation_scores);
  p_ai_chat_minutes      := GREATEST(0, p_ai_chat_minutes);
  p_stories_generated    := GREATEST(0, p_stories_generated);
  p_avatars_generated    := GREATEST(0, p_avatars_generated);

  -- Authoritative day key: the user's own timezone, not the caller's
  -- (migration 044). Callers must NOT pass a date.
  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_usage
    (user_id, date, text_messages, voice_minutes, writing_grades,
     pronunciation_scores, ai_chat_minutes, stories_generated, avatars_generated)
  VALUES
    (p_user_id, v_today, p_text_messages, p_voice_minutes, p_writing_grades,
     p_pronunciation_scores, p_ai_chat_minutes, p_stories_generated, p_avatars_generated)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages        = daily_usage.text_messages        + EXCLUDED.text_messages,
    voice_minutes        = daily_usage.voice_minutes        + EXCLUDED.voice_minutes,
    writing_grades       = daily_usage.writing_grades       + EXCLUDED.writing_grades,
    pronunciation_scores = daily_usage.pronunciation_scores + EXCLUDED.pronunciation_scores,
    ai_chat_minutes      = daily_usage.ai_chat_minutes      + EXCLUDED.ai_chat_minutes,
    stories_generated    = daily_usage.stories_generated    + EXCLUDED.stories_generated,
    avatars_generated    = daily_usage.avatars_generated    + EXCLUDED.avatars_generated;

  RETURN QUERY
    SELECT * FROM public.daily_usage du
     WHERE du.user_id = p_user_id AND du.date = v_today;
END;
$$;

COMMENT ON FUNCTION public.increment_daily_usage(uuid, integer, real, integer, integer, real, integer, integer)
  IS 'Atomic non-negative deltas on daily_usage. THE only signature — do not '
     'add an overload, PostgREST cannot disambiguate them (see migration 076). '
     'The day is resolved server-side from the user timezone; never pass a date.';

-- ── 3. Grants ────────────────────────────────────────────────────
-- authenticated: the client's incrementDailyUsage(), constrained to its
-- own row by the guard above and to increases by the clamp.
-- service_role: the edge functions.
REVOKE ALL ON FUNCTION public.increment_daily_usage(uuid, integer, real, integer, integer, real, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, integer, real, integer, integer, real, integer, integer)
  TO authenticated, service_role;
