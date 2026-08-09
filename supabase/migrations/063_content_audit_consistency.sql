-- 063_content_audit_consistency.sql
-- Content audit 2026-08-08, part 4 of 5: register, part-of-speech and source-text
-- consistency. Nothing here is a flat mistranslation; every item is something a
-- native speaker would mark as "not how we'd say it" or "not the same form as
-- the rest of the deck".
--
-- Sections:
--   1. Korean adjective register — one form, not three
--   2. Korean kinship terms that are speaker-restricted
--   3. ru "Gerund" — wrong grammatical category
--   4. pt Bedroom/Room — collision, both wrong
--   5. English source-text typo
--   6. Cleanup of a redundancy introduced by migration 060
--
-- DELIBERATELY NOT CHANGED: the English concept "Resume". It was flagged during
-- the audit for missing accents ("Résumé"), but "resume" is standard American
-- English for a CV and is not an error. Renaming it would rewrite prompts in all
-- nine languages for no learner benefit.

-- ============================================================================
-- SECTION 1 — Korean adjective register
-- ============================================================================
-- The ko deck gives adjectives in three different forms:
--   attributive (-ㄴ/은/는): 화난, 용감한, 행복한, 슬픈, 피곤한, 게으른 ... (14 cards)
--   polite-final (-요):      싸요, 추워요, 더워요, 맛있어요, 비싸요, 멋져요  (6 cards)
--   dictionary (-다):        아프다, 더 싸다, 더 비싸다, 더 키가 작다/크다   (5 cards)
-- A learner meeting 화난 and 추워요 in the same unit has no way to tell that they
-- are the same part of speech. Normalised to the attributive majority.
--
-- ORDERING IS LOAD-BEARING: '싸요' is a substring of '비싸요', and '더 싸다' of
-- nothing but '싸다'. Longest/most-specific patterns run first so the shorter
-- ones cannot corrupt an already-rewritten value.

-- 1a. dictionary-form comparatives (longest first)
UPDATE cards     SET target_text    = '더 비싼' WHERE id = 'aabbccdd-7777-2007-c006-a20000000000';
UPDATE exercises SET prompt = replace(prompt,'더 비싸다','더 비싼'), correct_answer = replace(correct_answer,'더 비싸다','더 비싼')
  WHERE prompt LIKE '%더 비싸다%' OR correct_answer LIKE '%더 비싸다%';

UPDATE cards     SET target_text    = '더 싼' WHERE id = 'aabbccdd-7777-2007-c005-a20000000000';
UPDATE exercises SET prompt = replace(prompt,'더 싸다','더 싼'), correct_answer = replace(correct_answer,'더 싸다','더 싼')
  WHERE prompt LIKE '%더 싸다%' OR correct_answer LIKE '%더 싸다%';

UPDATE cards     SET target_text    = '더 키가 작은' WHERE id = 'aabbccdd-7777-2007-c008-a20000000000';
UPDATE exercises SET prompt = replace(prompt,'더 키가 작다','더 키가 작은'), correct_answer = replace(correct_answer,'더 키가 작다','더 키가 작은')
  WHERE prompt LIKE '%더 키가 작다%' OR correct_answer LIKE '%더 키가 작다%';

UPDATE cards     SET target_text    = '더 키가 큰' WHERE id = 'aabbccdd-7777-2007-c007-a20000000000';
UPDATE exercises SET prompt = replace(prompt,'더 키가 크다','더 키가 큰'), correct_answer = replace(correct_answer,'더 키가 크다','더 키가 큰')
  WHERE prompt LIKE '%더 키가 크다%' OR correct_answer LIKE '%더 키가 크다%';

-- 1b. polite-final adjectives — 비싸요 BEFORE 싸요
UPDATE cards     SET target_text    = '비싼' WHERE id = 'aabbccdd-7777-1004-c002-000000000000';
UPDATE exercises SET prompt = replace(prompt,'비싸요','비싼'), correct_answer = replace(correct_answer,'비싸요','비싼')
  WHERE prompt LIKE '%비싸요%' OR correct_answer LIKE '%비싸요%';

UPDATE cards     SET target_text    = '싼' WHERE id = 'aabbccdd-7777-1004-c003-000000000000';
UPDATE exercises SET prompt = replace(prompt,'싸요','싼'), correct_answer = replace(correct_answer,'싸요','싼')
  WHERE prompt LIKE '%싸요%' OR correct_answer LIKE '%싸요%';

UPDATE cards     SET target_text    = '추운' WHERE id = 'aabbccdd-7777-1005-c008-000000000000';
UPDATE exercises SET prompt = replace(prompt,'추워요','추운'), correct_answer = replace(correct_answer,'추워요','추운')
  WHERE prompt LIKE '%추워요%' OR correct_answer LIKE '%추워요%';

UPDATE cards     SET target_text    = '더운' WHERE id = 'aabbccdd-7777-1005-c007-000000000000';
UPDATE exercises SET prompt = replace(prompt,'더워요','더운'), correct_answer = replace(correct_answer,'더워요','더운')
  WHERE prompt LIKE '%더워요%' OR correct_answer LIKE '%더워요%';

UPDATE cards     SET target_text    = '멋진' WHERE id = 'aabbccdd-7777-3008-c006-b10000000000';
UPDATE exercises SET prompt = replace(prompt,'멋져요','멋진'), correct_answer = replace(correct_answer,'멋져요','멋진')
  WHERE prompt LIKE '%멋져요%' OR correct_answer LIKE '%멋져요%';

UPDATE cards     SET target_text    = '맛있는' WHERE id = 'aabbccdd-7777-1002-c010-000000000000';
UPDATE exercises SET prompt = replace(prompt,'맛있어요','맛있는'), correct_answer = replace(correct_answer,'맛있어요','맛있는')
  WHERE prompt LIKE '%맛있어요%' OR correct_answer LIKE '%맛있어요%';

UPDATE cards     SET target_text    = '아픈' WHERE id = 'aabbccdd-7777-1008-c005-000000000000';
UPDATE exercises SET prompt = replace(prompt,'아프다','아픈'), correct_answer = replace(correct_answer,'아프다','아픈')
  WHERE prompt LIKE '%아프다%' OR correct_answer LIKE '%아프다%';

-- ============================================================================
-- SECTION 2 — Korean kinship terms
-- ============================================================================
-- 형 means "older brother, said by a male"; 언니 means "older sister, said by a
-- female". Both are wrong for roughly half of learners and neither is the
-- generic term. ja and zh already use the neutral sibling compounds (兄弟 / 姉妹),
-- so 형제 / 자매 restores parity.
--
-- These are updated BY ID, not by pattern: 형 is a single syllable that also
-- appears inside 조건형 ("Conditional"), which a blind replace would corrupt.
UPDATE cards SET target_text = '형제' WHERE id = 'aabbccdd-7777-1006-c004-000000000000';
UPDATE exercises SET prompt = '_____ (Brother)',              correct_answer = '형제' WHERE id = 'aabbccdd-7777-1006-0001-e00000000004';
UPDATE exercises SET prompt = 'Translate to English: 형제'                             WHERE id = 'aabbccdd-7777-1006-0002-e00000000003';
UPDATE exercises SET                                           correct_answer = '형제' WHERE id = 'aabbccdd-7777-1006-0003-e00000000002';
UPDATE exercises SET prompt = 'What does "형제" mean in English?'                       WHERE id = 'aabbccdd-7777-1006-0004-e00000000001';
UPDATE exercises SET prompt = '형제'                                                   WHERE id = '1a2716bd-7666-4e57-b02d-81d45c1a56d5';
UPDATE exercises SET prompt = '형제', correct_answer = '형제', accepted_answers = ARRAY['형제'] WHERE id = '26cee453-2558-4270-81c5-a7f84589e1f4';
UPDATE exercises SET prompt = '형제', correct_answer = '형제'                           WHERE id = '86fa2988-b212-4c22-be06-3be585380ef1';

UPDATE cards SET target_text = '자매' WHERE id = 'aabbccdd-7777-1006-c003-000000000000';
UPDATE exercises SET prompt = 'Translate to English: 자매'                             WHERE id = 'aabbccdd-7777-1006-0001-e00000000003';
UPDATE exercises SET                                           correct_answer = '자매' WHERE id = 'aabbccdd-7777-1006-0002-e00000000002';
UPDATE exercises SET prompt = 'What does "자매" mean in English?'                       WHERE id = 'aabbccdd-7777-1006-0003-e00000000001';
UPDATE exercises SET prompt = '자매'                                                   WHERE id = '294572df-16ae-4c52-a88b-d0b11cffa550';
UPDATE exercises SET prompt = '자매', correct_answer = '자매', accepted_answers = ARRAY['자매'] WHERE id = '96ba1cee-4c5a-4b6d-b625-50be156e3709';
UPDATE exercises SET prompt = '자매', correct_answer = '자매'                           WHERE id = 'f14c7b81-245b-4d87-b1af-f6c307546dea';

-- ============================================================================
-- SECTION 3 — ru "Gerund"
-- ============================================================================
-- Деепричастие is the Russian adverbial participle — a different category from
-- the English gerund. The term for the English gerund is Герундий, which is what
-- every other language in this slot gives (動名詞 / 동명사 / 动名词 / Gerundio).
UPDATE cards SET target_text = 'Герундий' WHERE id = 'aabbccdd-9999-4006-c005-b20000000000';
UPDATE exercises SET prompt = replace(prompt,'Деепричастие','Герундий'), correct_answer = replace(correct_answer,'Деепричастие','Герундий')
  WHERE prompt LIKE '%Деепричастие%' OR correct_answer LIKE '%Деепричастие%';

-- ============================================================================
-- SECTION 4 — pt Bedroom / Room collision
-- ============================================================================
-- The deck had Room = "Quarto" and Bedroom = "Quarto de dormir". Both are off:
-- "quarto" IS the bedroom, and "quarto de dormir" is a redundant construction no
-- one uses. Fixing only Bedroom would collide with Room, so both move:
--   Bedroom -> Quarto   (the actual word)
--   Room    -> Sala     (the companion word in a house unit; "cômodo" is the
--                        literal generic but is too formal for A1 material)
--
-- Updated BY ID rather than by pattern: 'Quarto' is a substring of 'Quarto de
-- dormir', so a pattern-scoped pass would rewrite the Bedroom rows twice.

-- 4a. Bedroom: "Quarto de dormir" -> "Quarto"
UPDATE cards SET target_text = 'Quarto' WHERE id = 'aabbccdd-5555-1007-c005-000000000000';
UPDATE exercises SET prompt = 'Quarto'                                  WHERE id = '2dfe9a1a-643d-4378-8db4-0472c9fc7e36'; -- listening_choice
UPDATE exercises SET prompt = 'What does "Quarto" mean in English?'     WHERE id = 'aabbccdd-5555-1007-0001-e00000000005'; -- multiple_choice
UPDATE exercises SET prompt = 'Qua_____ (Bedroom)', correct_answer = 'rto'
                                                                        WHERE id = 'aabbccdd-5555-1007-0002-e00000000004'; -- fill_blank, re-split
UPDATE exercises SET prompt = 'Translate to English: Quarto'            WHERE id = 'aabbccdd-5555-1007-0003-e00000000003'; -- translate_to_native
UPDATE exercises SET correct_answer = 'Quarto'                          WHERE id = 'aabbccdd-5555-1007-0004-e00000000002'; -- translate_to_target
UPDATE exercises SET prompt = 'What does "Quarto" mean in English?'     WHERE id = 'aabbccdd-5555-1007-0005-e00000000001'; -- multiple_choice
UPDATE exercises SET prompt = 'Quarto', correct_answer = 'Quarto', accepted_answers = ARRAY['Quarto']
                                                                        WHERE id = 'bab52419-3d42-46cd-9c5f-6806c1868a89'; -- speaking
UPDATE exercises SET prompt = 'Quarto', correct_answer = 'Quarto'       WHERE id = 'f109c67d-5439-4418-8fbd-3ff1ff8251a2'; -- listening_type

-- 4b. Room: "Quarto" -> "Sala"
UPDATE cards SET target_text = 'Sala' WHERE id = 'aabbccdd-5555-1007-c002-000000000000';
UPDATE exercises SET prompt = 'Sala'                                    WHERE id = '3a321b78-f8a7-46c4-bf74-b418a62e45f3'; -- listening_choice
UPDATE exercises SET prompt = 'Sala', correct_answer = 'Sala'           WHERE id = '59d6e738-a9aa-4a10-b193-7d7e20ac4616'; -- listening_type
UPDATE exercises SET correct_answer = 'Sala'                            WHERE id = 'aabbccdd-5555-1007-0001-e00000000002'; -- translate_to_target
UPDATE exercises SET prompt = 'What does "Sala" mean in English?'       WHERE id = 'aabbccdd-5555-1007-0002-e00000000001'; -- multiple_choice
UPDATE exercises SET prompt = 'Sa_____ (Room)', correct_answer = 'la'   WHERE id = 'aabbccdd-5555-1007-0006-e00000000008'; -- fill_blank, re-split
UPDATE exercises SET prompt = 'Sala', correct_answer = 'Sala', accepted_answers = ARRAY['Sala']
                                                                        WHERE id = 'bc858e94-48aa-4d93-8cd8-62ae6d83bf2e'; -- speaking

-- ============================================================================
-- SECTION 5 — English source-text typo
-- ============================================================================
-- The idiom is "to pull someone's leg". The possessive apostrophe is missing
-- everywhere it appears, including inside 65 multiple-choice option arrays.
UPDATE cards SET native_text = replace(native_text,'someones','someone''s') WHERE native_text LIKE '%someones%';
UPDATE exercises SET
  prompt           = replace(prompt,'someones','someone''s'),
  correct_answer   = replace(correct_answer,'someones','someone''s'),
  accepted_answers = (SELECT coalesce(array_agg(replace(a,'someones','someone''s')), '{}') FROM unnest(accepted_answers) a),
  options          = (SELECT array_agg(replace(o,'someones','someone''s')) FROM unnest(options) o)
WHERE prompt LIKE '%someones%' OR correct_answer LIKE '%someones%'
   OR array_to_string(accepted_answers,'|') LIKE '%someones%'
   OR array_to_string(options,'|') LIKE '%someones%';

-- ============================================================================
-- SECTION 6 — cleanup from migration 060
-- ============================================================================
-- 060 set both correct_answer and accepted_answers to 'Buenas noches' on this
-- row. Harmless but inconsistent: accepted_answers holds ALTERNATIVES only.
UPDATE exercises SET accepted_answers = '{}' WHERE id = 'aabbccdd-1111-1001-0003-e00000000002';

-- ============================================================================
-- VERIFICATION — all must return zero
-- ============================================================================
--   SELECT count(*) FROM cards WHERE target_text IN
--     ('싸요','비싸요','추워요','더워요','멋져요','맛있어요','아프다','더 싸다','더 비싸다',
--      '더 키가 작다','더 키가 크다','형','언니','Деепричастие','Quarto de dormir');
--   SELECT count(*) FROM exercises WHERE prompt LIKE '%someones%' OR correct_answer LIKE '%someones%'
--     OR array_to_string(options,'|') LIKE '%someones%';
--   -- 조건형 must be intact (guards the 형 -> 형제 scoping):
--   SELECT count(*) FROM cards WHERE target_text = '조건형';   -- expect 1
--   -- options still well-formed:
--   SELECT count(*) FROM exercises WHERE options IS NOT NULL
--     AND (NOT (correct_answer = ANY (options))
--          OR cardinality(options) <> cardinality(ARRAY(SELECT DISTINCT unnest(options))));
