-- 095 — Let a conversation leave something behind.
--
-- Chat is the most expensive thing this app runs and, until this migration,
-- the only one that produced no durable learning artifact. Two holes:
--
-- 1. WORDS THE TUTOR CHOOSES TO TEACH ARE THROWN AWAY.
--    `ai-chat` asks the model for a `vocabularyHighlights` array, parses it,
--    returns it, and the client renders it bold once. It is written to no
--    table and becomes no card. The learner sees a word introduced, the
--    bubble scrolls away, and the word is gone. Meanwhile
--    `_shared/learner-context.ts` already pulls struggling cards BACK into the
--    tutor's prompt every turn — so the return half of the loop has been built
--    and working for months against an input that never arrives.
--
-- 2. CONVERSATION CONTRIBUTES NOTHING TO MEASURED PROFICIENCY.
--    The whole product is expressed as CEFR level plus a can-do statement, and
--    `fetchProficiencyEvidence` reads review items, reading progress, writing
--    submissions, pronunciation scores and daily stats — no chat or voice
--    source at all. `assessSpeaking` takes a `minutes` argument sourced from
--    `daily_stats.speaking_minutes`, a column NOTHING in the app has ever
--    written, so its "N minutes logged" branch is unreachable code.
--
-- This migration adds the storage for both, plus the quota that keeps the
-- first one from flooding a free learner's review queue.
--
-- ─── Why chat cards get their own counter ────────────────────────────────
--
-- `dailyNewCards` (5 on free) is metered by `try_consume_new_card_slot`
-- against `daily_stats.cards_learned`, and it is the free tier's real
-- boundary (see CLAUDE.md §3). Chat vocabulary must not draw on it. A learner
-- who spends their five slots on words a conversation happened to surface has
-- no room left for the curriculum they opened the app for, and the two are
-- not interchangeable: a lesson card is chosen, a chat card is incidental.
--
-- So: a separate `chat_cards` counter on `daily_usage`, metered by
-- `consume_daily_quota` — which is already the atomic check-and-increment
-- primitive for integer counters, unlike the read-then-write the voice path
-- is stuck with.

-- ─── Chat-card counter ───────────────────────────────────────────────────
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS chat_cards integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.chat_cards IS
  'SRS cards created today from vocabulary a conversation introduced. '
  'Deliberately NOT drawn from daily_stats.cards_learned: that counter is the '
  'free tier''s curriculum boundary, and an incidental word surfaced by chat '
  'must not consume a slot the learner wanted for a lesson.';

-- ─── consume_daily_quota: whitelist the new counter ──────────────────────
-- Body is otherwise byte-identical to the live function; only the IN list
-- changes. Re-stated in full because CREATE OR REPLACE cannot patch one line,
-- and a drifted copy here would be worse than none.
CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_limit integer,
  p_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_today date;
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays', 'hints_generated', 'translations', 'word_lookups', 'chat_cards') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  v_today := public.fluenci_user_today(p_user_id);

  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format(
      'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = $3',
      p_counter
    ) USING p_user_id, p_amount, v_today;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = $4 AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount, v_today INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$function$;

-- ─── refund_daily_quota: bring the whitelist level with consume ──────────
-- Needed here specifically: a chat card is charged before the insert, and the
-- insert can still fail or be skipped as a duplicate. Without a refund path
-- a deduplicated word would silently cost the learner a slot.
CREATE OR REPLACE FUNCTION public.refund_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.fluenci_user_today(p_user_id);
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'hints_generated', 'translations', 'word_lookups', 'lesson_tts_plays', 'avatars_generated', 'chat_cards') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;

  -- No row for that user+day → 0 rows updated → no-op (nothing to refund).
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = GREATEST(0, COALESCE(%1$I, 0) - $2)
      WHERE user_id = $1 AND date = $3',
    p_counter
  ) USING p_user_id, p_amount, v_today;
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_daily_quota(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_daily_quota(uuid, text, integer) TO service_role;

-- ─── get_effective_limits: publish dailyChatCards ────────────────────────
-- Re-stated in full for the same reason as the two functions above. The only
-- changes are the four `dailyChatCards` values in the tier literals and the
-- one merge entry, which uses COALESCE because no existing contract_config
-- carries the key — a bare cast would make every school student's chat-card
-- limit NULL.
CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  personal_tier TEXT;
  personal_limits JSONB;
  school_config JSONB;
  result JSONB;
BEGIN
  SELECT COALESCE(s.tier, 'free') INTO personal_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.is_active = TRUE
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":9999,"dailyTranslations":90,"dailyWordLookups":9999,"dailyChatCards":50,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"dailyWordLookups":600,"dailyChatCards":30,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"dailyWordLookups":300,"dailyChatCards":15,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"dailyWordLookups":60,"dailyChatCards":3,"audiobookNarration":false,"offlineMode":false}'::jsonb
  END;

  SELECT o.contract_config INTO school_config
  FROM public.classroom_enrollments ce
  JOIN public.classrooms c ON c.id = ce.classroom_id
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE ce.student_id = p_user_id
    AND ce.dropped_at IS NULL
    AND o.is_active = TRUE
    AND (o.contract_end IS NULL OR o.contract_end >= CURRENT_DATE)
  ORDER BY (o.contract_config->>'dailyVoiceMinutes')::int DESC
  LIMIT 1;

  IF school_config IS NULL THEN
    RETURN personal_limits;
  END IF;

  result := jsonb_build_object(
    'dailyVoiceMinutes', GREATEST((personal_limits->>'dailyVoiceMinutes')::int, (school_config->>'dailyVoiceMinutes')::int),
    'dailyTextMessages', GREATEST((personal_limits->>'dailyTextMessages')::int, (school_config->>'dailyTextMessages')::int),
    'dailyWritingGrades', GREATEST((personal_limits->>'dailyWritingGrades')::int, (school_config->>'dailyWritingGrades')::int),
    'dailyPronunciationScores', GREATEST((personal_limits->>'dailyPronunciationScores')::int, (school_config->>'dailyPronunciationScores')::int),
    'dailyNewCards', GREATEST(
      (personal_limits->>'dailyNewCards')::int,
      COALESCE((school_config->>'dailyNewCards')::int, 0)
    ),
    'dailyHints', GREATEST(
      (personal_limits->>'dailyHints')::int,
      COALESCE((school_config->>'dailyHints')::int, 0)
    ),
    -- COALESCE, not a bare cast: no existing contract_config carries this key,
    -- so a bare cast would make every school student's translation limit NULL.
    'dailyTranslations', GREATEST(
      (personal_limits->>'dailyTranslations')::int,
      COALESCE((school_config->>'dailyTranslations')::int, 0)
    ),
    -- Same reason as dailyTranslations above.
    'dailyWordLookups', GREATEST(
      (personal_limits->>'dailyWordLookups')::int,
      COALESCE((school_config->>'dailyWordLookups')::int, 0)
    ),
    -- Same reason again — added by this migration, so no contract has it yet.
    'dailyChatCards', GREATEST(
      (personal_limits->>'dailyChatCards')::int,
      COALESCE((school_config->>'dailyChatCards')::int, 0)
    ),
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;

-- ─── Learner-card dedupe support ─────────────────────────────────────────
--
-- There is no content dedupe anywhere in this schema today. Saving the same
-- word twice inserts two `cards` rows, and the UNIQUE(user_id, card_id) on
-- `review_items` never fires because the card is new each time — so the
-- learner ends up reviewing one word from two independent SM-2 schedules.
-- That was survivable while every card came from a deliberate tap. It is not
-- survivable once a conversation adds them automatically: a tutor that says
-- "la cuenta" in ten sessions would create ten cards.
--
-- An index, deliberately NOT a unique constraint. Duplicate rows already
-- exist in production from the tap-driven paths, so a unique constraint would
-- fail to build; and de-duplicating live review schedules is a data-loss
-- decision that does not belong hidden inside a feature migration. The
-- callers check before inserting, and this index is what makes that check
-- cheap.
CREATE INDEX IF NOT EXISTS idx_cards_user_language_text
  ON public.cards (user_id, language, lower(target_text))
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX public.idx_cards_user_language_text IS
  'Supports the "has this learner already saved this word?" lookup that every '
  'learner-authored card path runs before inserting. Not unique: duplicates '
  'predate it, and collapsing them is a separate, deliberate decision.';

-- ─── Conversation evidence ───────────────────────────────────────────────
--
-- One row per scored conversation turn. This is what finally lets speaking
-- and writing be *measured* rather than merely practised.
--
-- Two modalities, kept apart on purpose. A spoken turn is evidence about
-- speaking; a typed turn is evidence about written production and joins the
-- writing assessment instead. Composing a sentence with a keyboard and time
-- to think is a materially easier task than saying it out loud, and pooling
-- them would let a learner type their way to a speaking level.
--
-- `intelligibility` is null for text and MAY be null for voice: it is derived
-- from Whisper's avg_logprob, which some payloads do not report. It is named
-- intelligibility rather than pronunciation because that is what it measures —
-- the metric conflates accent, audio quality and word rarity, and calling it
-- a pronunciation score would overclaim.
CREATE TABLE IF NOT EXISTS public.conversation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  cefr_level text,
  modality text NOT NULL CHECK (modality IN ('speaking', 'writing')),
  -- 0-1. Null when the provider reported no confidence, or for typed turns.
  intelligibility numeric,
  -- 0-1. Severity-weighted correction density over words produced.
  accuracy numeric NOT NULL,
  word_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The assessment reads a learner's rows for one language, newest first, and
-- buckets them by band. This index serves exactly that query.
CREATE INDEX IF NOT EXISTS idx_conversation_evidence_user_modality_time
  ON public.conversation_evidence (user_id, modality, created_at DESC);

ALTER TABLE public.conversation_evidence ENABLE ROW LEVEL SECURITY;

-- Read your own, and only your own. No INSERT/UPDATE/DELETE policy: rows are
-- written by the service role in supabase/functions/ai-chat. Same shape as
-- pronunciation_scores (migration 089) and for the same reason — this is
-- proficiency evidence, so a client that could write it could grant itself a
-- CEFR level.
CREATE POLICY "Users can read own conversation evidence" ON public.conversation_evidence
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMENT ON TABLE public.conversation_evidence IS
  'Scored conversation turns, the source that lets chat and voice contribute '
  'to measured CEFR. Voice turns carry modality=speaking and score on '
  'intelligibility plus accuracy; typed turns carry modality=writing and '
  'score on accuracy alone.';
