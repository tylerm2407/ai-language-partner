-- 066_ko_register_and_stale_metadata.sql
-- Content audit 2026-08-08, follow-up 2.
--
-- Two things, one of them a regression introduced by this audit's own migrations.
--
--   1. ko "The ball is in your court" used 당신 for "you". 당신 is not neutral
--      conversational Korean — it belongs to writing, song lyrics, speech between
--      spouses, or an argument. Replaced with natural casual phrasing, with the
--      formal form accepted where a free-text answer is graded.
--
--   2. REGRESSION: migrations 060/061/063 updated `prompt` and `correct_answer`
--      but never touched `metadata`. Two exercise types keep a copy of the answer
--      in their metadata JSON, so those copies still hold the OLD text:
--        * sentence_construction  -> metadata.tiles (the draggable word tiles)
--        * error_correction       -> metadata.error_sentence
--      11 sentence_construction rows were left unsolvable: the tiles spell the
--      previous phrase while correct_answer expects the new one. A string
--      replacement across text columns is not sufficient on this table.

-- ============================================================================
-- SECTION 1 — ko register: 당신 -> 네
-- ============================================================================
-- Primary form is 이제 네 차례다: casual 네 rather than 당신, in the plain
-- (dictionary) form used by every other idiom in this unit — 정곡을 찌르다,
-- 하늘을 날 것 같다, 어색한 분위기를 깨다.
UPDATE cards SET target_text = '이제 네 차례다' WHERE id = 'aabbccdd-7777-4005-c011-b20000000000';

UPDATE exercises SET correct_answer = '이제 네 차례다'
  WHERE id = 'aabbccdd-7777-4005-0003-e00000000009';                      -- sentence_construction
UPDATE exercises SET prompt = 'What does "이제 네 차례다" mean in English?'
  WHERE id = 'aabbccdd-7777-4005-0002-e00000000010';                      -- multiple_choice
UPDATE exercises SET prompt = 'Write a sentence using the word: 이제 네 차례다 (The ball is in your court)',
                     correct_answer = '이제 네 차례다'
  WHERE id = 'aabbccdd-7777-4005-0005-e00000000007';                      -- free_production
UPDATE exercises SET prompt = '이제 네 차례다' WHERE id = 'f0b732cc-a9d6-4fcf-b8fd-a6e320bebef5'; -- listening_choice
UPDATE exercises SET prompt = '이제 네 차례다', correct_answer = '이제 네 차례다'
  WHERE id = 'c8cd4bd6-ac66-4ec1-9e50-8c36fc723555';                      -- listening_type
UPDATE exercises SET prompt = '이제 네 차례다', correct_answer = '이제 네 차례다',
                     accepted_answers = ARRAY['이제 네 차례다']
  WHERE id = '9633fa6e-0f7e-4551-bb75-54c9a77424c2';                      -- speaking

-- The formal variant is accepted only where the learner is producing meaning
-- from scratch. It is deliberately NOT accepted on dictation, listening_type or
-- speaking: those grade what was actually heard or said, so a different register
-- is a wrong answer there, not an alternative one.
UPDATE exercises SET correct_answer = '이제 네 차례다',
                     accepted_answers = ARRAY['이제 결정하실 차례입니다']
  WHERE id = 'aabbccdd-7777-4005-0004-e00000000008';                      -- cloze_deletion
UPDATE exercises SET correct_answer = '이제 네 차례다'
  WHERE id = 'aabbccdd-7777-4005-0006-e00000000006';                      -- dictation, exact only

-- ============================================================================
-- SECTION 2 — rebuild stale metadata
-- ============================================================================
-- 2a. sentence_construction tiles. Rebuilt from correct_answer by splitting on
--     whitespace, which is what generate_seed.py does. Distractors are left
--     alone — they are other vocabulary from the unit and stay valid.
--     Written as a general repair rather than 11 hand-written updates so it
--     also catches anything a future content edit leaves behind.
UPDATE exercises
SET metadata = jsonb_set(metadata, '{tiles}', to_jsonb(string_to_array(correct_answer, ' ')))
WHERE type = 'sentence_construction'
  AND metadata ? 'tiles'
  AND replace(array_to_string(ARRAY(SELECT jsonb_array_elements_text(metadata->'tiles')), ''), ' ', '')
      <> replace(correct_answer, ' ', '');

-- 2b. error_correction error_sentence, for the six rows re-mangled by 061.
--     Scoped by id: a separate grammar-exercise content set (uuid ids) uses a
--     different prompt format and must not be touched.
UPDATE exercises
SET metadata = jsonb_set(metadata, '{error_sentence}',
                         to_jsonb(replace(prompt, 'Find and correct the error: ', '')))
WHERE id IN (
  'aabbccdd-1111-4005-0002-e00000000005',
  'aabbccdd-5555-4005-0002-e00000000005',
  'aabbccdd-5555-4005-0003-e00000000005',
  'aabbccdd-5555-4005-0004-e00000000005',
  'aabbccdd-7777-4005-0002-e00000000005',
  'aabbccdd-7777-4005-0004-e00000000005'
);

-- ============================================================================
-- VERIFICATION — all must return zero
-- ============================================================================
--   -- tiles must reconstruct the answer:
--   SELECT count(*) FROM exercises WHERE type = 'sentence_construction' AND metadata ? 'tiles'
--     AND replace(array_to_string(ARRAY(SELECT jsonb_array_elements_text(metadata->'tiles')), ''), ' ', '')
--         <> replace(correct_answer, ' ', '');
--   -- the six re-mangled rows must agree with their prompt:
--   SELECT count(*) FROM exercises WHERE type = 'error_correction'
--     AND id::text LIKE 'aabbccdd-%4005-%'
--     AND prompt <> 'Find and correct the error: ' || (metadata->>'error_sentence');
--   -- and the error sentence must still actually differ from the answer:
--   SELECT count(*) FROM exercises WHERE type = 'error_correction'
--     AND metadata->>'error_sentence' = correct_answer;
--   -- no 당신 left in the ko deck:
--   SELECT count(*) FROM cards WHERE target_text LIKE '%당신%';
--   SELECT count(*) FROM exercises WHERE prompt LIKE '%당신%' OR correct_answer LIKE '%당신%';
