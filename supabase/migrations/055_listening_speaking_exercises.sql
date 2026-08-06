-- Migration 055: Generate listening and speaking exercises from existing cards
--
-- (Authored as 053 and renumbered to 055 when 053/054 were claimed by parallel
-- work. Already applied to production under the name
-- `listening_speaking_exercises` — prod history is timestamp-based, so this
-- file is the record of intent, not the applied ordering.)
--
-- WHY THIS EXISTS
-- Production had 14,472 exercises across 11 types, and not one of them was
-- `listening_choice`, `listening_type` or `speaking`. The components for all
-- three are built and wired into LessonRunner, but no lesson could ever reach
-- them — so the pronunciation-scoring path never ran, and the CEFR proficiency
-- report could not assess listening or speaking for want of content rather
-- than for want of a model.
--
-- Every one of the 3,168 cards carries native_text, target_text, cefr_level and
-- a unit_id, which is everything these three exercise types need. Deriving them
-- mechanically is deterministic, reviewable, and gives each new row a card_id —
-- which the existing 14,472 exercises all lack (card_id is NULL on every one of
-- them), so these are the first exercises that can be CEFR-banded through the
-- cards join and tied back to the learner's SRS queue.
--
-- SHAPE OF EACH TYPE
--   speaking         prompt = target_text (read aloud), hint = native_text.
--                    Read-aloud is what score-pronunciation actually measures —
--                    it compares a transcript to a known expected string — so
--                    the exercise is framed as what it is, not as free production.
--   listening_type   prompt = target_text (the text to be SPOKEN, never shown:
--                    ListeningExercise renders a fixed "Listen and answer"
--                    header), learner transcribes it.
--   listening_choice prompt = target_text (spoken), options = the correct
--                    native translation plus 3 distractors drawn from the same
--                    unit, so distractors are thematically plausible.
--
-- AUDIO: no card has an audio_url and the tts-cache bucket is private, so
-- prompt_audio_url is deliberately left NULL. ListeningExercise synthesises the
-- prompt on demand via the tts function, which is content-addressed server-side:
-- the first learner to hear a sentence pays a voice-minute, everyone after that
-- is a cache hit.
--
-- Assignment: cards are dealt round-robin across their unit's 6 lessons, so the
-- ~12 cards per unit spread evenly rather than piling onto lesson 1.
--
-- Idempotent: each INSERT skips cards that already have that exercise type, so
-- re-running adds nothing.

-- ─── Shared source: cards dealt to lessons within their unit ──────────────
CREATE OR REPLACE VIEW public.fluenci_card_lesson_assignment AS
WITH ranked_cards AS (
  SELECT c.id AS card_id, c.unit_id, c.native_text, c.target_text,
         c.cefr_level, c.skill_type,
         ROW_NUMBER() OVER (PARTITION BY c.unit_id ORDER BY c.id) - 1 AS card_ord
  FROM public.cards c
  WHERE c.unit_id IS NOT NULL
    AND COALESCE(c.target_text, '') <> ''
    AND COALESCE(c.native_text, '') <> ''
),
unit_lessons AS (
  SELECT l.id AS lesson_id, l.unit_id,
         ROW_NUMBER() OVER (PARTITION BY l.unit_id ORDER BY l.order_index, l.id) - 1 AS lesson_ord,
         COUNT(*) OVER (PARTITION BY l.unit_id) AS lesson_count
  FROM public.lessons l
)
SELECT rc.card_id, rc.unit_id, rc.native_text, rc.target_text,
       rc.cefr_level, rc.skill_type, rc.card_ord, ul.lesson_id
FROM ranked_cards rc
JOIN unit_lessons ul
  ON ul.unit_id = rc.unit_id
 AND ul.lesson_ord = (rc.card_ord % ul.lesson_count);

-- ─── 1. Speaking (read-aloud) ─────────────────────────────────────────────
INSERT INTO public.exercises (
  lesson_id, type, order_index, prompt, correct_answer, accepted_answers,
  hint_text, card_id, skill_type, response_mode, target_word,
  accepted_speech_variants, source_type
)
SELECT a.lesson_id, 'speaking', 100 + a.card_ord * 3,
       a.target_text, a.target_text, ARRAY[a.target_text],
       a.native_text, a.card_id, COALESCE(a.skill_type, 'vocabulary'), 'speak',
       a.target_text, ARRAY[a.target_text], 'seed'
FROM public.fluenci_card_lesson_assignment a
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.card_id = a.card_id AND e.type = 'speaking'
);

-- ─── 2. Listening — transcribe what you heard ─────────────────────────────
INSERT INTO public.exercises (
  lesson_id, type, order_index, prompt, correct_answer, accepted_answers,
  hint_text, card_id, skill_type, response_mode, source_type
)
SELECT a.lesson_id, 'listening_type', 101 + a.card_ord * 3,
       a.target_text, a.target_text, ARRAY[]::text[],
       a.native_text, a.card_id, COALESCE(a.skill_type, 'vocabulary'), 'type', 'seed'
FROM public.fluenci_card_lesson_assignment a
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.card_id = a.card_id AND e.type = 'listening_type'
);

-- ─── 3. Listening — pick the meaning ──────────────────────────────────────
-- Distractors come from other cards in the same unit and exclude any whose
-- native_text equals the answer, so an option list can never contain the
-- correct answer twice. Units with fewer than 4 usable cards are skipped
-- rather than shipped with a 2-option "choice".
INSERT INTO public.exercises (
  lesson_id, type, order_index, prompt, correct_answer, accepted_answers,
  options, hint_text, card_id, skill_type, response_mode, distractors, source_type
)
SELECT a.lesson_id, 'listening_choice', 102 + a.card_ord * 3,
       a.target_text, a.native_text, ARRAY[]::text[],
       -- Deterministic shuffle: ordering by a hash of the option text seeded
       -- with the card id keeps the correct answer off a fixed position
       -- without needing random(), which would make this non-reproducible.
       (SELECT ARRAY_AGG(opt ORDER BY md5(opt || a.card_id::text))
          FROM (
            SELECT a.native_text AS opt
            UNION
            -- Parenthesised deliberately: without it the ORDER BY/LIMIT would
            -- bind to the whole UNION rather than to the distractor branch,
            -- truncating the option list to three and dropping the answer.
            (SELECT d.native_text FROM public.fluenci_card_lesson_assignment d
              WHERE d.unit_id = a.unit_id
                AND d.card_id <> a.card_id
                AND d.native_text <> a.native_text
              ORDER BY md5(d.card_id::text || a.card_id::text)
              LIMIT 3)
          ) opts),
       NULL, a.card_id, COALESCE(a.skill_type, 'vocabulary'), 'tap',
       (SELECT ARRAY_AGG(d.native_text)
          FROM (
            SELECT d2.native_text FROM public.fluenci_card_lesson_assignment d2
             WHERE d2.unit_id = a.unit_id
               AND d2.card_id <> a.card_id
               AND d2.native_text <> a.native_text
             ORDER BY md5(d2.card_id::text || a.card_id::text)
             LIMIT 3
          ) d)::text[],
       'seed'
FROM public.fluenci_card_lesson_assignment a
WHERE (
  SELECT COUNT(*) FROM public.fluenci_card_lesson_assignment d
   WHERE d.unit_id = a.unit_id AND d.card_id <> a.card_id AND d.native_text <> a.native_text
) >= 3
AND NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.card_id = a.card_id AND e.type = 'listening_choice'
);

-- The view was scaffolding for the three INSERTs above; it is not part of the
-- runtime schema and must not become an unversioned dependency.
DROP VIEW public.fluenci_card_lesson_assignment;
