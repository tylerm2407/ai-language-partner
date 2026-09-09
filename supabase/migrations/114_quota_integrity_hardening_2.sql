-- 114 — Quota integrity hardening, part 2 (2026-09-08 audit, follow-up).
--
-- 1. The quota day cannot be moved forward by editing your own timezone.
--    `fluenci_user_today` used to trust `user_profiles.timezone` outright,
--    and that column is client-writable (the app syncs it from the device).
--    Flipping from UTC-12 to UTC+14 produced a fresh daily_usage row — a
--    one-off borrow of up to two days of every allowance. Now a timezone
--    change is recorded (previous_timezone, timezone_changed_at) and for 26
--    hours afterwards — the widest gap between any two zones — the day is
--    the EARLIER of the two zones' dates. A traveller's reset is delayed by
--    at most a day; a flip gains nothing.
--
-- 2. The free tier's new-card cap is enforced by the database, not by the
--    client choosing to ask. `review_items` is client-writable (SRS state
--    must be), so a patched client could insert new cards without ever
--    calling `try_consume_new_card_slot`. A BEFORE INSERT trigger now
--    consumes the slot for any genuinely new (user, card) pair. The RPC
--    stays, takes the card id, and records a RESERVATION the trigger
--    honours, so the honest online path (reserve, then insert — possibly
--    hours later from the offline queue) is charged exactly once.
--
-- 3. `upsert_daily_stats` no longer accepts `p_cards_learned`: the trigger
--    owns that column now. The parameter is kept so old clients still call
--    successfully; its value is ignored.
--
-- 4. `checkpoint_grades`: the placement checkpoint's writing grade is one
--    Haiku call per submit, free tier included, and had only a burst limit.
--    Now capped per day for every tier by the function (30), through the
--    same atomic RPC as everything else.
--
-- 5. Table privileges. Supabase grants anon and authenticated every
--    privilege on every table and relies on RLS to say no. RLS does say no
--    (no write policies exist on any of the tables below), but a privilege
--    that is never legitimately used is a privilege worth not having: it
--    is revoked here on every table with no client write policy, and
--    TRUNCATE — which RLS does not govern — is revoked from client roles on
--    every table in the schema.
--
-- Applied to production 2026-09-08 via the Supabase MCP; this file mirrors it.

-- ─── 1. Timezone changes cannot mint a day ───────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS previous_timezone text,
  ADD COLUMN IF NOT EXISTS timezone_changed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.previous_timezone IS
  'The timezone before the last change. For 26h after a change the quota day is the EARLIER of the two zones'' dates, so a change can never produce a fresh daily_usage row. Written by trigger only.';

CREATE OR REPLACE FUNCTION public.fluenci_track_timezone_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.timezone IS DISTINCT FROM OLD.timezone THEN
    NEW.previous_timezone := COALESCE(OLD.timezone, 'UTC');
    NEW.timezone_changed_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    -- These two are trigger-owned: a client cannot clear the window.
    NEW.previous_timezone := OLD.previous_timezone;
    NEW.timezone_changed_at := OLD.timezone_changed_at;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.previous_timezone := NULL;
    NEW.timezone_changed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_track_timezone_change_trigger ON public.user_profiles;
CREATE TRIGGER fluenci_track_timezone_change_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_track_timezone_change();

CREATE OR REPLACE FUNCTION public.fluenci_user_today(p_uid uuid)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tz text;
  v_prev_tz text;
  v_changed_at timestamptz;
  v_today date;
  v_prev_today date;
BEGIN
  SELECT p.timezone, p.previous_timezone, p.timezone_changed_at
    INTO v_tz, v_prev_tz, v_changed_at
    FROM public.user_profiles p
   WHERE p.user_id = p_uid;

  BEGIN
    v_today := (now() AT TIME ZONE COALESCE(v_tz, 'UTC'))::date;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid tz name stored on the profile — degrade to UTC rather than
    -- failing every streak/challenge/quota RPC for this user.
    v_today := (now() AT TIME ZONE 'UTC')::date;
  END;

  -- Within 26 hours of a timezone change the day cannot move forward past
  -- what the previous zone says (migration 114).
  IF v_changed_at IS NOT NULL AND v_changed_at > now() - interval '26 hours' THEN
    BEGIN
      v_prev_today := (now() AT TIME ZONE COALESCE(v_prev_tz, 'UTC'))::date;
    EXCEPTION WHEN OTHERS THEN
      v_prev_today := (now() AT TIME ZONE 'UTC')::date;
    END;
    RETURN LEAST(v_today, v_prev_today);
  END IF;

  RETURN v_today;
END;
$function$;

-- ─── 2. New-card cap enforced on insert ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.new_card_reservations (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id     uuid NOT NULL,
  reserved_on date NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
ALTER TABLE public.new_card_reservations ENABLE ROW LEVEL SECURITY;
-- No policies: written and read by SECURITY DEFINER functions only.
REVOKE ALL ON TABLE public.new_card_reservations FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.new_card_reservations IS
  'A slot of the daily new-card cap reserved for one card by try_consume_new_card_slot(card). The review_items insert trigger charges nothing for a reserved card and consumes a slot for an unreserved one. Deny-all to clients.';

-- The RPC: with a card id, reserve; without one, the old advisory behaviour
-- (consume a slot, no reservation) is kept so an older client still works
-- — its subsequent insert is then charged by the trigger, which costs that
-- client one extra slot per card until it updates. Fail-closed by nature.
DROP FUNCTION IF EXISTS public.try_consume_new_card_slot();
CREATE OR REPLACE FUNCTION public.try_consume_new_card_slot(p_card_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_cap int;
  v_consumed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(v_uid);

  IF p_card_id IS NOT NULL THEN
    -- Already reserved (a retry, or the card was introduced before): free.
    IF EXISTS (SELECT 1 FROM public.new_card_reservations r WHERE r.user_id = v_uid AND r.card_id = p_card_id) THEN
      RETURN true;
    END IF;
    -- Already in SRS: not a new card, nothing to reserve.
    IF EXISTS (SELECT 1 FROM public.review_items ri WHERE ri.user_id = v_uid AND ri.card_id = p_card_id) THEN
      RETURN true;
    END IF;
  END IF;

  v_cap := COALESCE((public.get_effective_limits(v_uid) ->> 'dailyNewCards')::int, 5);

  INSERT INTO public.daily_stats (user_id, date)
  VALUES (v_uid, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_stats d
     SET cards_learned = COALESCE(d.cards_learned, 0) + 1
   WHERE d.user_id = v_uid AND d.date = v_today
     AND COALESCE(d.cards_learned, 0) < v_cap
  RETURNING true INTO v_consumed;

  IF COALESCE(v_consumed, false) AND p_card_id IS NOT NULL THEN
    INSERT INTO public.new_card_reservations (user_id, card_id, reserved_on)
    VALUES (v_uid, p_card_id, v_today)
    ON CONFLICT (user_id, card_id) DO NOTHING;
  END IF;

  RETURN COALESCE(v_consumed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.try_consume_new_card_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_consume_new_card_slot(uuid) TO authenticated, service_role;

-- The trigger. Service-role writes (auth.uid() IS NULL) pass untouched:
-- seeding and back-office repairs are not learner activity.
CREATE OR REPLACE FUNCTION public.fluenci_guard_new_cards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_cap int;
  v_consumed boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot write another user''s review items' USING ERRCODE = '42501';
  END IF;

  -- An upsert of a card already in SRS fires this trigger too (BEFORE INSERT
  -- runs before the conflict resolves to UPDATE). Not a new card: free.
  IF EXISTS (SELECT 1 FROM public.review_items ri WHERE ri.user_id = NEW.user_id AND ri.card_id = NEW.card_id) THEN
    RETURN NEW;
  END IF;

  -- Reserved through the RPC: the slot was charged then. Consume the
  -- reservation so it cannot be reused for a different day.
  DELETE FROM public.new_card_reservations r
   WHERE r.user_id = NEW.user_id AND r.card_id = NEW.card_id;
  IF FOUND THEN RETURN NEW; END IF;

  -- Unreserved: this insert IS the introduction. Charge it, or refuse.
  v_today := public.fluenci_user_today(NEW.user_id);
  v_cap := COALESCE((public.get_effective_limits(NEW.user_id) ->> 'dailyNewCards')::int, 5);

  INSERT INTO public.daily_stats (user_id, date)
  VALUES (NEW.user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_stats d
     SET cards_learned = COALESCE(d.cards_learned, 0) + 1
   WHERE d.user_id = NEW.user_id AND d.date = v_today
     AND COALESCE(d.cards_learned, 0) < v_cap
  RETURNING true INTO v_consumed;

  IF NOT COALESCE(v_consumed, false) THEN
    RAISE EXCEPTION 'DAILY_NEW_CARD_LIMIT_REACHED' USING ERRCODE = 'P0001',
      HINT = 'The daily new-card allowance for this plan is used up.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS fluenci_guard_new_cards_trigger ON public.review_items;
CREATE TRIGGER fluenci_guard_new_cards_trigger
  BEFORE INSERT ON public.review_items
  FOR EACH ROW EXECUTE FUNCTION public.fluenci_guard_new_cards();

-- ─── 3. upsert_daily_stats: cards_learned is server-owned ────────────────

CREATE OR REPLACE FUNCTION public.upsert_daily_stats(
  p_user_id uuid, p_lessons_completed integer DEFAULT 0, p_cards_reviewed integer DEFAULT 0,
  p_cards_learned integer DEFAULT 0, p_minutes_practiced real DEFAULT 0,
  p_speaking_minutes real DEFAULT 0, p_listening_minutes real DEFAULT 0,
  p_reading_minutes real DEFAULT 0, p_writing_minutes real DEFAULT 0,
  p_xp_earned integer DEFAULT 0, p_accuracy real DEFAULT NULL::real
) RETURNS SETOF daily_stats LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s stats'
      USING ERRCODE = '42501';
  END IF;

  p_lessons_completed := GREATEST(0, LEAST(COALESCE(p_lessons_completed, 0), 100));
  p_cards_reviewed    := GREATEST(0, LEAST(COALESCE(p_cards_reviewed, 0), 2000));
  -- Migration 114: cards_learned is moved only by the new-card slot RPC and
  -- the review_items insert trigger. The parameter is accepted and ignored.
  p_cards_learned     := 0;
  p_minutes_practiced := GREATEST(0, LEAST(COALESCE(p_minutes_practiced, 0), 1440));
  p_speaking_minutes  := GREATEST(0, LEAST(COALESCE(p_speaking_minutes, 0), 1440));
  p_listening_minutes := GREATEST(0, LEAST(COALESCE(p_listening_minutes, 0), 1440));
  p_reading_minutes   := GREATEST(0, LEAST(COALESCE(p_reading_minutes, 0), 1440));
  p_writing_minutes   := GREATEST(0, LEAST(COALESCE(p_writing_minutes, 0), 1440));
  p_xp_earned         := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), 10000));

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
$function$;

-- ─── 4. checkpoint_grades counter ────────────────────────────────────────

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS checkpoint_grades integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.daily_usage.checkpoint_grades IS
  'Checkpoint writing submissions graded today (one Haiku call each). Capped by the checkpoint function for every tier.';

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid, p_counter text, p_limit integer, p_amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
BEGIN
  IF p_counter NOT IN ('text_messages','writing_grades','pronunciation_scores','stories_generated','avatars_generated','lesson_tts_plays','hints_generated','translations','word_lookups','chat_cards','goal_tracks','audiobook_chapters','tutor_seconds','checkpoint_grades') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

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

-- ─── 5. Privileges a client never legitimately holds ─────────────────────

DO $$
DECLARE
  t text;
BEGIN
  -- Tables with no client write policy at all (verified 2026-09-08).
  FOREACH t IN ARRAY ARRAY[
    'api_cache','audit_log','avatar_accessories','avatar_jobs','avatar_presets',
    'book_annotations','book_audio','book_vocab','checkpoint_items','checkpoints',
    'client_events','cohort_members','cohorts','content_sources',
    'conversation_evidence','corpus_terms','courses','daily_news','daily_stats',
    'daily_usage','exercises','explanation_cache','grammar_rules','hint_cache',
    'lessons','monthly_usage','organization_members','organizations',
    'pronunciation_scores','reading_books','reading_passages','reading_questions',
    'subscriptions','translation_cache','tutor_safety_events','tutor_sessions',
    'units','user_goal_tracks','user_roles','writing_prompts','new_card_reservations'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;

  -- TRUNCATE is not governed by RLS. No client role needs it anywhere.
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
