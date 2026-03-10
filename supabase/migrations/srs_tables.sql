-- ============================================================
-- SRS (Spaced Repetition System) Tables
-- Run AFTER schema.sql and schema_v2.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.srs_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language_id UUID REFERENCES public.languages(id) ON DELETE CASCADE,
  language_slug TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'vocab'
    CHECK (card_type IN ('vocab','grammar','phrase','sentence','cultural')),
  front JSONB NOT NULL DEFAULT '{}',
  back JSONB NOT NULL DEFAULT '{}',
  -- SM-2 fields
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  -- Metadata
  source TEXT, -- 'lesson', 'conversation', 'manual'
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srs_due
  ON public.srs_cards(user_id, language_slug, next_review_at);
CREATE INDEX IF NOT EXISTS idx_srs_user_lang
  ON public.srs_cards(user_id, language_slug);

ALTER TABLE public.srs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "srs_own" ON public.srs_cards
  FOR ALL USING (auth.uid() = user_id);

-- Review sessions log
CREATE TABLE IF NOT EXISTS public.srs_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.srs_cards(id) ON DELETE CASCADE,
  quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5),
  response_ms INTEGER, -- how long user took to answer
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "srs_reviews_own" ON public.srs_reviews
  FOR ALL USING (auth.uid() = user_id);

-- RPC: SM-2 algorithm — update card after review
-- quality: 0=blackout, 1=wrong, 2=wrong+familiar, 3=correct+hard, 4=correct, 5=perfect
CREATE OR REPLACE FUNCTION public.srs_review_card(
  p_card_id UUID,
  p_quality INTEGER,
  p_response_ms INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  card public.srs_cards%ROWTYPE;
  new_ef FLOAT;
  new_interval INTEGER;
  new_reps INTEGER;
  next_review TIMESTAMPTZ;
BEGIN
  SELECT * INTO card FROM public.srs_cards
  WHERE id = p_card_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found or not owned by user';
  END IF;

  -- SM-2 Algorithm
  IF p_quality >= 3 THEN
    -- Correct response
    IF card.repetitions = 0 THEN
      new_interval := 1;
    ELSIF card.repetitions = 1 THEN
      new_interval := 6;
    ELSE
      new_interval := ROUND(card.interval_days * card.ease_factor);
    END IF;
    new_reps := card.repetitions + 1;
  ELSE
    -- Incorrect — reset
    new_interval := 0;
    new_reps := 0;
  END IF;

  -- Update ease factor (EF stays >= 1.3)
  new_ef := card.ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
  IF new_ef < 1.3 THEN new_ef := 1.3; END IF;

  -- Set next review time
  IF new_interval = 0 THEN
    next_review := now() + INTERVAL '10 minutes';
  ELSIF new_interval = 1 THEN
    next_review := now() + INTERVAL '1 day';
  ELSE
    next_review := now() + (new_interval || ' days')::INTERVAL;
  END IF;

  UPDATE public.srs_cards SET
    ease_factor = new_ef,
    interval_days = new_interval,
    repetitions = new_reps,
    next_review_at = next_review,
    last_reviewed_at = now()
  WHERE id = p_card_id;

  -- Log review
  INSERT INTO public.srs_reviews (user_id, card_id, quality, response_ms)
  VALUES (auth.uid(), p_card_id, p_quality, p_response_ms);

  -- Award XP
  PERFORM public.add_xp(auth.uid(), CASE WHEN p_quality >= 3 THEN 5 ELSE 2 END);

  RETURN jsonb_build_object(
    'new_interval', new_interval,
    'new_ef', new_ef,
    'next_review_at', next_review,
    'xp_awarded', CASE WHEN p_quality >= 3 THEN 5 ELSE 2 END
  );
END;
$$;

-- RPC: Get due cards for a user + language
CREATE OR REPLACE FUNCTION public.get_due_srs_cards(
  p_language_slug TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF public.srs_cards LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.srs_cards
  WHERE user_id = auth.uid()
    AND language_slug = p_language_slug
    AND next_review_at <= now()
  ORDER BY next_review_at ASC
  LIMIT p_limit;
$$;

-- RPC: Get SRS stats for dashboard
CREATE OR REPLACE FUNCTION public.get_srs_stats(p_language_slug TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_cards', COUNT(*),
    'due_now', COUNT(*) FILTER (WHERE next_review_at <= now()),
    'due_today', COUNT(*) FILTER (WHERE next_review_at <= now() + INTERVAL '24 hours'),
    'new_cards', COUNT(*) FILTER (WHERE repetitions = 0),
    'mastered', COUNT(*) FILTER (WHERE interval_days >= 21)
  )
  FROM public.srs_cards
  WHERE user_id = auth.uid()
    AND language_slug = p_language_slug;
$$;

-- RPC: Bulk add SRS cards from a lesson
CREATE OR REPLACE FUNCTION public.add_srs_cards_from_lesson(
  p_language_slug TEXT,
  p_language_id UUID,
  p_cards JSONB,
  p_source_id UUID DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  card JSONB;
  inserted INTEGER := 0;
BEGIN
  FOR card IN SELECT * FROM jsonb_array_elements(p_cards)
  LOOP
    INSERT INTO public.srs_cards (
      user_id, language_slug, language_id, card_type, front, back, source, source_id
    )
    VALUES (
      auth.uid(),
      p_language_slug,
      p_language_id,
      COALESCE(card->>'card_type', 'vocab'),
      card->'front',
      card->'back',
      'lesson',
      p_source_id
    )
    ON CONFLICT DO NOTHING;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$$;
