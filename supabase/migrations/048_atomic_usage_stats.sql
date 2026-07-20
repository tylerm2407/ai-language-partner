-- ═══════════════════════════════════════════════════════════════
-- 048: Atomic daily_usage / daily_stats counters for the client
--
-- The client's incrementDailyUsage() and upsertDailyStats() did
-- SELECT-then-UPDATE with a client-computed sum — two concurrent
-- sessions could both read the same base value and one increment
-- was lost. Replace both with single-statement
-- INSERT ... ON CONFLICT ... DO UPDATE SET col = col + EXCLUDED.col
-- RPCs so the row lock serializes concurrent writers.
--
-- SECURITY DEFINER + SET search_path = public + auth.uid() caller
-- guard follows the pattern from migrations 024/025/031.
--
-- Note on increment_daily_usage: prod already has three deployed
-- overloads (see migration 044), all of which REQUIRE p_date (no
-- default). This new overload takes no p_date, so a PostgREST call
-- whose named-arg set omits p_date resolves unambiguously to this
-- function. The day is resolved server-side from the user's stored
-- timezone (fluenci_user_today, migration 044) — authoritative
-- day-keying, same as the 044 overloads.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. increment_daily_usage — atomic quota-counter deltas ──
-- Columns per 002 (text_messages, voice_minutes) + 018
-- (writing_grades, pronunciation_scores). Returns the full updated
-- daily_usage row so the client can map it unchanged.
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

REVOKE ALL ON FUNCTION public.increment_daily_usage(UUID, INT, REAL, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(UUID, INT, REAL, INT, INT) TO authenticated;

-- ── 2. upsert_daily_stats — atomic daily_stats deltas ──
-- Additive columns mirror the client's upsertDailyStats() merge
-- (001 base columns + 003 reading/writing minutes). `accuracy` is
-- NOT additive: it keeps the old client semantics — set when a new
-- value is supplied, otherwise keep the existing row's value
-- (0 on first insert). Returns the full row for mapDailyStats.
CREATE OR REPLACE FUNCTION public.upsert_daily_stats(
  p_user_id UUID,
  p_lessons_completed INT DEFAULT 0,
  p_cards_reviewed INT DEFAULT 0,
  p_cards_learned INT DEFAULT 0,
  p_minutes_practiced REAL DEFAULT 0,
  p_speaking_minutes REAL DEFAULT 0,
  p_listening_minutes REAL DEFAULT 0,
  p_reading_minutes REAL DEFAULT 0,
  p_writing_minutes REAL DEFAULT 0,
  p_xp_earned INT DEFAULT 0,
  p_accuracy REAL DEFAULT NULL
) RETURNS SETOF public.daily_stats
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s stats'
      USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(p_user_id);

  INSERT INTO public.daily_stats
    (user_id, date, lessons_completed, cards_reviewed, cards_learned,
     minutes_practiced, speaking_minutes, listening_minutes,
     reading_minutes, writing_minutes, xp_earned, accuracy)
  VALUES
    (p_user_id, v_today, p_lessons_completed, p_cards_reviewed, p_cards_learned,
     p_minutes_practiced, p_speaking_minutes, p_listening_minutes,
     p_reading_minutes, p_writing_minutes, p_xp_earned, COALESCE(p_accuracy, 0))
  ON CONFLICT (user_id, date) DO UPDATE SET
    lessons_completed = daily_stats.lessons_completed + EXCLUDED.lessons_completed,
    cards_reviewed    = daily_stats.cards_reviewed + EXCLUDED.cards_reviewed,
    cards_learned     = daily_stats.cards_learned + EXCLUDED.cards_learned,
    minutes_practiced = daily_stats.minutes_practiced + EXCLUDED.minutes_practiced,
    speaking_minutes  = daily_stats.speaking_minutes + EXCLUDED.speaking_minutes,
    listening_minutes = daily_stats.listening_minutes + EXCLUDED.listening_minutes,
    reading_minutes   = daily_stats.reading_minutes + EXCLUDED.reading_minutes,
    writing_minutes   = daily_stats.writing_minutes + EXCLUDED.writing_minutes,
    xp_earned         = daily_stats.xp_earned + EXCLUDED.xp_earned,
    accuracy          = COALESCE(p_accuracy, daily_stats.accuracy);

  RETURN QUERY
    SELECT * FROM public.daily_stats d
     WHERE d.user_id = p_user_id AND d.date = v_today;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_daily_stats(UUID, INT, INT, INT, REAL, REAL, REAL, REAL, REAL, INT, REAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_daily_stats(UUID, INT, INT, INT, REAL, REAL, REAL, REAL, REAL, INT, REAL) TO authenticated;
