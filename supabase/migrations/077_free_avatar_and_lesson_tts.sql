-- ═══════════════════════════════════════════════════════════════
-- 077: The free tier's two metered exceptions
--
-- A free tier exists again. Every AI quota on `starter` stays 0 —
-- that is the whole point of it — but two things had to be carved
-- out, and both are metered here rather than in the client.
--
-- 1) ONE free photo avatar per account, ever.
--
--    This is a LIFETIME grant, not a daily one, so it cannot ride
--    on daily_usage: `avatars_generated` resets every night, and a
--    starter limit of 1 there would be one free image-model call
--    per day forever. The flag lives on the profile and is spent
--    exactly once by consume_free_avatar().
--
--    Note what the grant is spent ON: a SUCCESSFUL generation.
--    generate-avatar calls this only after the image comes back,
--    so a provider failure or a rejected photo does not burn it.
--    The cost of that ordering is a narrow window where a caller
--    could pay for two images before the flag lands; the burst
--    limit (3 per 300s) bounds it, and the alternative — burning a
--    stranger's one free avatar on our own 502 — is worse.
--
-- 2) A small lesson-audio allowance.
--
--    Lesson listening exercises are voiced by the `tts` function.
--    With dailyVoiceMinutes at 0 for starter, every listening and
--    dictation exercise in the free curriculum would fail — the
--    free tier would ship visibly broken lessons rather than a
--    smaller product. `lesson_tts_plays` is a separate counter so
--    that allowance cannot leak into chat or voice practice, which
--    is where the real minutes go.
--
--    Cheap by construction: the tts function is content-addressed,
--    so the first learner to hear a sentence pays for it and every
--    later play, for them and for everyone, is a cache hit. A
--    fixed curriculum means the bill converges.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. The lifetime free-avatar grant ────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS free_avatar_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profiles.free_avatar_used_at IS
  'When this account spent its single lifetime free photo-avatar generation. '
  'NULL = unspent. Written only by consume_free_avatar(); never by a client.';

/*
 * Spend the free avatar, atomically. Returns true exactly once per account.
 *
 * The atomicity is the whole function: a read-then-write from the edge
 * function would let two concurrent requests both see NULL and both generate.
 * The `IS NULL` predicate in the UPDATE is what makes a second caller lose,
 * because it re-evaluates under the row lock the first caller is holding.
 *
 * service_role only. This is entitlement, and entitlement is never granted by
 * a client (CLAUDE.md §1.2) — `authenticated` holding EXECUTE here would let
 * any signed-in user burn or inspect the flag directly.
 */
CREATE OR REPLACE FUNCTION public.consume_free_avatar(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  UPDATE public.user_profiles
     SET free_avatar_used_at = now()
   WHERE user_id = p_user_id
     AND free_avatar_used_at IS NULL
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$$;

COMMENT ON FUNCTION public.consume_free_avatar(uuid) IS
  'Atomically spend an account''s one lifetime free avatar generation. '
  'True on the first call, false on every call after. service_role only.';

REVOKE ALL ON FUNCTION public.consume_free_avatar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_avatar(uuid) TO service_role;

-- ── 2. Lesson-audio counter ──────────────────────────────────────
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS lesson_tts_plays INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.lesson_tts_plays IS
  'Lesson-exercise TTS syntheses today. Deliberately separate from '
  'voice_minutes so a free tier can hear its lessons without being handed '
  'chat or voice-practice minutes.';

-- Re-create consume_daily_quota (037, last touched by 067) with the new
-- counter added to the allow-list. The body is otherwise byte-identical to
-- what is live: the counter name is interpolated into dynamic SQL, so that IN
-- check is the only thing keeping this injection-safe — never widen it to a
-- pattern match.
--
-- CURRENT_DATE is carried forward unchanged rather than switched to
-- fluenci_user_today (migration 044). It is inconsistent with
-- increment_daily_usage, which does resolve the user's own day — but changing
-- it here would silently move the reset boundary for text_messages,
-- writing_grades, pronunciation_scores, stories_generated and
-- avatars_generated at the same time, which is a separate change that
-- deserves its own migration and its own testing.
CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_limit integer,
  p_amount integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;
  -- Negative limit means unlimited (still record usage for analytics).
  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format(
      'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = CURRENT_DATE',
      p_counter
    ) USING p_user_id, p_amount;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Atomic check-and-increment: the row lock serializes concurrent calls,
  -- and the WHERE clause refuses the increment once the limit is reached.
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = CURRENT_DATE AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) TO service_role;
