-- 094 — Reading in-text help: make every word tappable, and explain a paragraph.
--
-- Today a learner who opens any imported classic gets a wall of untappable
-- text. The book reader only attaches an onPress to a word that appears in a
-- pre-authored annotation row, and the annotation tables are empty:
-- `reading_annotations` has 0 rows and no INSERT anywhere in the repo, and
-- `book_annotations` covers 28 of 10,375 books (the AI-generated stories that
-- `generate-story` writes). The other 10,231 are imported Gutenberg texts with
-- nothing pre-authored at all.
--
-- So help becomes on-demand and cached instead of pre-authored. This migration
-- carries the server half of that.
--
-- 1. WORD LOOKUPS GET THEIR OWN COUNTER.
--
-- Migration 093 metered `translate` at 10/30/60/90 a day, charged on cache
-- miss. That cap is sized for the chat Translate button, where one call
-- translates up to 1500 characters. A reading lookup is one word — roughly a
-- fiftieth of the tokens — and a learner meeting a new page taps far more than
-- ten times. Reusing `translations` would mean the free tier could not read the
-- corpus at all.
--
-- `word_lookups` is therefore separate and generous. The edge function will
-- only charge it for input that is a single token, so the cheaper counter
-- cannot be used as a general translation endpoint. Both paths share one
-- `translation_cache`, so chat translations and reading lookups warm each
-- other and a hit stays free on either.
--
-- 2. THE REFUND WHITELIST WAS BEHIND THE CONSUME WHITELIST.
--
-- Production's `refund_daily_quota` accepts 'translations' — but no migration
-- file in this repo ever added it, so the committed history does not describe
-- the live function. It is restated in full below so the record is accurate
-- again, and widened to the two counters still missing: 'lesson_tts_plays' and
-- 'avatars_generated'. A consumed unit that cannot be given back is a unit a
-- learner loses to our outage, which is the exact thing migration 090 fixed
-- for hints.
--
-- 3. PARAGRAPH EXPLANATIONS ARE CACHED ACROSS EVERY LEARNER.
--
-- Gutenberg text is identical for everyone, so an explanation of a paragraph is
-- worth generating once. `explanation_cache` is keyed on a hash of
-- (language, native language, CEFR level, span) — deliberately NOT on book id.
-- A book id in the key would stop the 126 `reading_passages` sharing the cache
-- and would split identical spans across editions; the level genuinely belongs
-- in the key, because the same paragraph needs a different explanation at A2
-- and at C1. `book_id` is kept as nullable metadata so a delisted book takes
-- its rows with it.
--
-- 4. `reading_annotations` GOES.
--
-- 0 rows, no writer, and the only reader is one query in supabase-queries.ts
-- that this change deletes.

-- ─── Word-lookup counter ─────────────────────────────────────────────────
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS word_lookups integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_usage.word_lookups IS
  'Single-word translations GENERATED today for the reader. Charged on cache '
  'miss only, and only for input the edge function accepted as one token — a '
  'phrase or a paste is charged against `translations` instead, at the much '
  'lower cap that pays for its size.';

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
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated', 'lesson_tts_plays', 'hints_generated', 'translations', 'word_lookups') THEN
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
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'hints_generated', 'translations', 'word_lookups', 'lesson_tts_plays', 'avatars_generated') THEN
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

-- ─── get_effective_limits: publish dailyWordLookups ──────────────────────
-- 60 / 300 / 600 / 9999. The free tier is deliberately the generous end of
-- this app's free numbers: reading is the one thing a free account can do at
-- length, and a cache hit — which most lookups become once a book has been
-- read by anyone — costs nothing to serve. 9999 is the same unlimited sentinel
-- `dailyNewCards` and `dailyHints` use, chosen over NULL or -1 because the
-- GREATEST() merge below would lose either one and silently downgrade an
-- unlimited learner to their school's cap.
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
    WHEN 'vip' THEN '{"dailyVoiceMinutes":18,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"dailyNewCards":9999,"dailyHints":9999,"dailyTranslations":90,"dailyWordLookups":9999,"audiobookNarration":true,"offlineMode":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":12,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"dailyNewCards":9999,"dailyHints":75,"dailyTranslations":60,"dailyWordLookups":600,"audiobookNarration":false,"offlineMode":true}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":6,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"dailyNewCards":20,"dailyHints":30,"dailyTranslations":30,"dailyWordLookups":300,"audiobookNarration":false,"offlineMode":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":0,"dailyTextMessages":0,"dailyWritingGrades":0,"dailyPronunciationScores":0,"dailyNewCards":5,"dailyHints":5,"dailyTranslations":10,"dailyWordLookups":60,"audiobookNarration":false,"offlineMode":false}'::jsonb
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
    'audiobookNarration', COALESCE((personal_limits->>'audiobookNarration')::boolean, false) OR COALESCE((school_config->>'audiobookNarration')::boolean, false),
    'offlineMode', COALESCE((personal_limits->>'offlineMode')::boolean, false) OR COALESCE((school_config->>'offlineMode')::boolean, false)
  );

  RETURN result;
END;
$function$;

-- ─── Explanation cache ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.explanation_cache (
  hash        text PRIMARY KEY,
  explanation text NOT NULL,
  book_id     uuid REFERENCES public.reading_books(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

COMMENT ON TABLE public.explanation_cache IS
  'Shared paragraph explanations for the reader. `hash` is the SHA-256 hex of '
  'JSON [language, nativeLanguage, cefrLevel, span]; `book_id` is metadata for '
  'cascade cleanup, deliberately not part of the key, so the same span shared '
  'by two editions or by a passage resolves to one row. 90-day window '
  'refreshed on use, swept by cleanup_expired_cache().';

-- RLS on with NO policies, deliberately. Clients never read this table — they
-- go through the `explain-passage` edge function, which uses the service role
-- and so bypasses RLS. Zero policies is therefore deny-all to every client
-- role, matching api_cache / hint_cache / translation_cache. The advisor
-- reports this as INFO rls_enabled_no_policy; that is the intended state, not
-- a finding to close with a permissive policy.
ALTER TABLE public.explanation_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_explanation_cache_expires
  ON public.explanation_cache (expires_at);

-- ─── Sweep it nightly ────────────────────────────────────────────────────
-- Migration 069 schedules cleanup_expired_cache() at 04:17 UTC and 085 widened
-- it to client_events. Both are carried forward here verbatim — a replace that
-- only knew about api_cache and translation_cache would silently drop the
-- client_events sweep and let that table grow forever.
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  api_deleted INTEGER;
  translation_deleted INTEGER;
  explanation_deleted INTEGER;
  events_deleted INTEGER;
BEGIN
  DELETE FROM public.api_cache WHERE expires_at < now();
  GET DIAGNOSTICS api_deleted = ROW_COUNT;

  DELETE FROM public.translation_cache WHERE expires_at < now();
  GET DIAGNOSTICS translation_deleted = ROW_COUNT;

  DELETE FROM public.explanation_cache WHERE expires_at < now();
  GET DIAGNOSTICS explanation_deleted = ROW_COUNT;

  -- Ephemeral idempotency keys only. The `v1` ledger keys and the onboarding
  -- key are permanent: deleting them would let a learner replay a lesson, book
  -- or writing submission and be paid a second time.
  DELETE FROM public.client_events
   WHERE created_at < now() - interval '90 days'
     AND event_key NOT LIKE 'xp:lesson:v1:%'
     AND event_key NOT LIKE 'xp:book:v1:%'
     AND event_key NOT LIKE 'xp:writing:v1:%'
     AND event_key NOT LIKE 'onboarding-checklist:%';
  GET DIAGNOSTICS events_deleted = ROW_COUNT;

  RETURN api_deleted + translation_deleted + explanation_deleted + events_deleted;
END;
$function$;

-- ─── Drop the dead annotation table ──────────────────────────────────────
-- 0 rows in production, no writer in this repo or in any edge function, and
-- its single reader (fetchPassageWithAnnotations in lib/supabase-queries.ts)
-- is deleted in the same change. Its policies from migration 004 go with it.
DROP TABLE IF EXISTS public.reading_annotations;
