-- 062_content_audit_polysemy.sql
-- Content audit 2026-08-08, part 3 of 5: words the deck teaches with two valid
-- meanings, and then marks one of them wrong.
--
-- THE DEFECT
-- 予約 is taught as both "Appointment" and "Reservation". Рука as both "Arm" and
-- "Hand". すみません as both "Excuse me" and "Sorry". These are correct — the
-- words really are ambiguous. The bug is that the exercises do not know it:
--
--   * 1,978 of 1,999 translate_to_native rows have an EMPTY accepted_answers,
--     so only one of the two correct answers is graded correct.
--   * 13 multiple-choice / listening_choice rows put BOTH valid meanings in the
--     options. Those are unanswerable: whichever the learner picks, the other
--     was equally right, and one of the two is scored wrong.
--
-- Being marked wrong for a right answer is worse than a mistranslation. The
-- learner knows they were right, and the app looks broken rather than merely
-- imperfect.
--
-- Sections:
--   1. Unanswerable multiple choice — remove the co-correct distractor
--   2. Free-text translate_to_native — accept every meaning the deck teaches
--   3. Free-text translate_to_target — accept every synonym the deck teaches

-- ============================================================================
-- SECTION 1 — unanswerable multiple choice
-- ============================================================================
-- One distractor in each row is also a correct answer. It is replaced with a
-- word from the same course that is unambiguously wrong. The correct answer and
-- the option count (4) are unchanged in every row.
--
-- NOTE: the "Bonjour" row below became ambiguous as a *result* of migration 061,
-- which repointed fr "Good morning" from the Québécois "Bon matin" to "Bonjour".
-- Bonjour genuinely means both; the fix is the same as for the pre-existing rows.

-- de "Dann" = Next / Then
UPDATE exercises SET options = ARRAY['Next','Once upon a time','Finally','Plot']
  WHERE id = '1328c452-228b-4ece-be50-284618d96253';           -- was 'Then'
UPDATE exercises SET options = ARRAY['Character','Finally','While','Next']
  WHERE id = 'aabbccdd-3333-3006-0006-e00000000001';           -- was 'Then'

-- de "Kleiner" = Smaller / Shorter  (two rows, one testing each sense)
UPDATE exercises SET options = ARRAY['Faster','Slower','Better','Smaller']
  WHERE id = 'aabbccdd-3333-2007-0002-e00000000001';           -- was 'Shorter'
UPDATE exercises SET options = ARRAY['Taller','More expensive','Faster','Shorter']
  WHERE id = 'aabbccdd-3333-2007-0002-e00000000007';           -- was 'Smaller'

-- fr "Plus petit" = Smaller / Shorter
UPDATE exercises SET options = ARRAY['Better','Smaller','Faster','Slower']
  WHERE id = '4343989a-6fe9-4d7d-967f-1ae0d1bc6cd9';           -- was 'Shorter'

-- fr "Bonjour" = Hello / Good morning
UPDATE exercises SET options = ARRAY['Hello','Goodbye','Good night','Excuse me']
  WHERE id = '46c7c0b3-1367-4b5b-8f68-458902a48905';           -- was 'Good morning'

-- ru "Рука" = Arm / Hand  (two rows, one testing each sense)
UPDATE exercises SET options = ARRAY['Leg','Arm','Head','Medicine']
  WHERE id = '2b83fd39-04d5-4aca-9bcd-b315a4cbd432';           -- was 'Hand'
UPDATE exercises SET options = ARRAY['Eye','Hand','Sick','Head']
  WHERE id = 'f96830f5-f4ac-4ec1-942e-6a81e11ac3ba';           -- was 'Arm'

-- ja "すみません" = Excuse me / Sorry
UPDATE exercises SET options = ARRAY['Thank you','Please','Sorry','Good evening']
  WHERE id = '78dfb4a4-7a08-4060-9544-309f8ddab966';           -- was 'Excuse me'

-- zh "反驳" = Counterargument / To refute
UPDATE exercises SET options = ARRAY['Counterargument','Argument','Rhetoric','Evidence']
  WHERE id = 'a2dc5e5c-19db-44e2-9072-1e911bac0263';           -- was 'To refute'

-- it "Festa" = Party / Holiday
UPDATE exercises SET options = ARRAY['Birthday','Music','Dance','Party']
  WHERE id = 'aabbccdd-4444-2008-0001-e00000000007';           -- was 'Holiday'

-- zh "节日" = Festival / Holiday  (two rows, one testing each sense)
UPDATE exercises SET options = ARRAY['Holiday','Birthday','Wedding','New Year']
  WHERE id = 'aabbccdd-8888-2008-0001-e00000000001';           -- was 'Festival'
UPDATE exercises SET options = ARRAY['Music','Festival','Christmas','Dance']
  WHERE id = 'c405e36a-6e01-4a00-91dc-06dd02b37314';           -- was 'Holiday'

-- ============================================================================
-- SECTION 2 — translate_to_native: accept every meaning the deck teaches
-- ============================================================================
-- Data-driven rather than enumerated, so it stays correct if the deck grows a
-- new ambiguous pair. `correct_answer` is excluded from accepted_answers to
-- match the existing convention (accepted_answers holds ALTERNATIVES only).
WITH meanings AS (
  SELECT language, target_text, array_agg(DISTINCT native_text) AS ms
  FROM cards
  GROUP BY language, target_text
  HAVING count(DISTINCT native_text) > 1
)
UPDATE exercises e
SET accepted_answers = (
  SELECT coalesce(array_agg(DISTINCT x), '{}')
  FROM unnest(e.accepted_answers || m.ms) x
  WHERE x <> e.correct_answer
)
FROM meanings m
WHERE e.type = 'translate_to_native'
  AND e.prompt = 'Translate to English: ' || m.target_text;

-- ============================================================================
-- SECTION 3 — translate_to_target: accept every synonym the deck teaches
-- ============================================================================
-- Only "Deadline" qualifies today (es Fecha límite / Plazo, fr Date limite /
-- Échéance) but the same shape applies to any future synonym pair.
WITH synonyms AS (
  SELECT native_text, language, array_agg(DISTINCT target_text) AS ts
  FROM cards
  GROUP BY native_text, language
  HAVING count(DISTINCT target_text) > 1
),
langname AS (
  SELECT * FROM (VALUES
    ('es','Spanish'),('pt','Portuguese'),('fr','French'),('it','Italian'),
    ('de','German'),('ja','Japanese'),('ko','Korean'),('zh','Chinese'),('ru','Russian')
  ) AS t(code, label)
)
UPDATE exercises e
SET accepted_answers = (
  SELECT coalesce(array_agg(DISTINCT x), '{}')
  FROM unnest(e.accepted_answers || s.ts) x
  WHERE x <> e.correct_answer
)
FROM synonyms s
JOIN langname l ON l.code = s.language
WHERE e.type = 'translate_to_target'
  AND e.prompt = 'Translate to ' || l.label || ': ' || s.native_text;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- No multiple-choice row may contain two correct answers:
--   WITH meanings AS (
--     SELECT language, target_text, array_agg(DISTINCT native_text) ms FROM cards
--     GROUP BY language, target_text HAVING count(DISTINCT native_text) > 1)
--   SELECT count(*) FROM exercises e JOIN meanings m
--     ON e.prompt = 'What does "' || m.target_text || '" mean in English?' OR e.prompt = m.target_text
--   WHERE e.options IS NOT NULL
--     AND (SELECT count(*) FROM unnest(e.options) o WHERE o = ANY (m.ms)) > 1;   -- expect 0
--
-- Options still well-formed (4 distinct, correct answer present):
--   SELECT count(*) FROM exercises WHERE options IS NOT NULL
--     AND (NOT (correct_answer = ANY (options))
--          OR cardinality(options) <> cardinality(ARRAY(SELECT DISTINCT unnest(options))));  -- expect 0
--
-- accepted_answers must never contain the correct answer:
--   SELECT count(*) FROM exercises WHERE correct_answer = ANY (accepted_answers);
