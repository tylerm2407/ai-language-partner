-- 060_content_audit_wrong_meanings.sql
-- Content audit 2026-08-08, part 1 of 5: factually wrong content.
-- Scope: BOTH `cards` and `exercises`.
--
-- WHY THIS TOUCHES `cards` AND 049 DID NOT
-- Migration 049 declared "Scope: exercises table only". It fixed several defects
-- in `exercises` and left the matching `cards` rows carrying the old, wrong text.
-- That is the direct cause of most of the card/exercise contradictions found in
-- this audit: the deck now teaches one thing on the card and grades another in
-- the exercise. Every fix below is applied to both tables or to whichever one is
-- actually stale. New content fixes MUST update both.
--
-- Sections:
--   1. es/pt "Good evening" greeting cluster (includes reverting a 049 mistake)
--   2. Corrupted characters that 049 missed entirely
--   3. Cards left stale by 049 (exercises are already correct)

-- ============================================================================
-- SECTION 1 — es/pt greeting cluster
-- ============================================================================
-- "Buenas tardes" / "Boa tarde" mean GOOD AFTERNOON, not good evening.
-- The evening/night greeting in both languages is "Buenas noches" / "Boa noite".
--
-- 049 got Portuguese half-right (it set the t2n row to "Good afternoon" and the
-- t2t row to "Boa noite") but never touched the pt card, so the card still said
-- Good evening = Boa tarde while the exercise said Boa tarde = Good afternoon.
--
-- 049 got Spanish BACKWARDS. Line 153-154 treated "Buenas tardes" as the correct
-- answer for "Good evening" and stripped "Buenas noches" out of accepted_answers
-- as if it were the error. A learner typing the correct Spanish has been marked
-- wrong ever since. That is reverted here.
--
-- Approach: regloss the CARD to "Good afternoon" (which is what the phrase means)
-- rather than repointing it at "Buenas noches". This keeps each card's target
-- distinct, leaves the card-linked listening/speaking rows correct and untouched,
-- and avoids creating a second card with the same target as "Good night".

-- 1a. Cards: correct the English side.
UPDATE cards SET native_text = 'Good afternoon' WHERE id = 'aabbccdd-1111-1001-c004-000000000000'; -- es Buenas tardes
UPDATE cards SET native_text = 'Good afternoon' WHERE id = 'aabbccdd-5555-1001-c004-000000000000'; -- pt Boa tarde

-- 1b. Spanish exercises: regloss "Buenas tardes" to Good afternoon.
UPDATE exercises SET prompt = 'Buenas_____ (Good afternoon)'
  WHERE id = 'aabbccdd-1111-1001-0001-e00000000004'; -- fill_blank, answer stays 'tardes'
UPDATE exercises SET correct_answer = 'Good afternoon'
  WHERE id = 'aabbccdd-1111-1001-0002-e00000000003'; -- translate_to_native
UPDATE exercises SET correct_answer = 'Good afternoon', options = ARRAY['Good night','Good afternoon','Please','No']
  WHERE id = 'aabbccdd-1111-1001-0004-e00000000001'; -- multiple_choice
UPDATE exercises SET correct_answer = 'Good afternoon', options = ARRAY['Good afternoon','Yes','No','Please']
  WHERE id = '7de4b2c9-a3d1-4b2e-8e31-660bc22a43ee'; -- listening_choice

-- 1c. Spanish "Good evening" now resolves to Buenas noches. Reverts 049 line 154,
--     which deleted the correct answer from accepted_answers.
UPDATE exercises SET correct_answer = 'Buenas noches', accepted_answers = ARRAY['Buenas noches']
  WHERE id = 'aabbccdd-1111-1001-0003-e00000000002'; -- translate_to_target

-- 1d. Portuguese exercises: regloss "Boa tarde" to Good afternoon.
--     (the t2n row was already fixed by 049; the MC and listening rows were not)
UPDATE exercises SET correct_answer = 'Good afternoon', options = ARRAY['Thank you','Good night','Good afternoon','Yes']
  WHERE id = 'aabbccdd-5555-1001-0004-e00000000001'; -- multiple_choice
UPDATE exercises SET correct_answer = 'Good afternoon', options = ARRAY['No','Hello','Good afternoon','Good morning']
  WHERE id = '6c3be900-2ac7-4211-9c9a-1f5291102c3e'; -- listening_choice

-- Speaking / listening_type rows for both languages carry no English gloss
-- (prompt = correct_answer = the target phrase), so they are correct as-is and
-- are deliberately left untouched.

-- ============================================================================
-- SECTION 2 — Corrupted characters 049 did not catch
-- ============================================================================

-- 2a. ko "식은 죄 먹기" -> "식은 죽 먹기" ("eating cold porridge" = a piece of cake).
--     죄 means "sin"; the deck currently reads "eating cold sin".
UPDATE cards SET target_text = '식은 죽 먹기' WHERE id = 'aabbccdd-7777-4005-c003-b20000000000';
UPDATE exercises SET prompt = 'Translate to English: 식은 죽 먹기' WHERE id = 'aabbccdd-7777-4005-0001-e00000000003';
UPDATE exercises SET correct_answer = '식은 죽 먹기' WHERE id = 'aabbccdd-7777-4005-0002-e00000000002';
UPDATE exercises SET prompt = 'What does "식은 죽 먹기" mean in English?' WHERE id = 'aabbccdd-7777-4005-0003-e00000000001';
UPDATE exercises SET prompt = 'What does "식은 죽 먹기" mean in English?' WHERE id = 'aabbccdd-7777-4005-0006-e00000000010';
UPDATE exercises SET prompt = '식은 죽 먹기', correct_answer = '식은 죽 먹기', accepted_answers = ARRAY['식은 죽 먹기']
  WHERE id = '97d63316-f0ee-4843-a743-245f2f784550'; -- speaking
UPDATE exercises SET prompt = '식은 죽 먹기' WHERE id = 'b276ac37-8344-4475-a473-d192532d0d5a'; -- listening_choice
UPDATE exercises SET prompt = '식은 죽 먹기', correct_answer = '식은 죽 먹기'
  WHERE id = 'f907cf6d-2094-4063-819c-fcd878604e9a'; -- listening_type

-- 2b. ko "정곱을 찌르다" -> "정곡을 찌르다" (to hit the bullseye). 정곱 is not a word.
UPDATE cards SET target_text = '정곡을 찌르다' WHERE id = 'aabbccdd-7777-4005-c002-b20000000000';
UPDATE exercises SET correct_answer = '정곡을 찌르다' WHERE id = 'aabbccdd-7777-4005-0001-e00000000002';
UPDATE exercises SET prompt = 'What does "정곡을 찌르다" mean in English?' WHERE id = 'aabbccdd-7777-4005-0002-e00000000001';
UPDATE exercises SET prompt = 'What does "정곡을 찌르다" mean in English?' WHERE id = 'aabbccdd-7777-4005-0005-e00000000010';
UPDATE exercises SET correct_answer = '정곡을 찌르다' WHERE id = 'aabbccdd-7777-4005-0006-e00000000009';
UPDATE exercises SET prompt = '정곡을 찌르다', correct_answer = '정곡을 찌르다', accepted_answers = ARRAY['정곡을 찌르다']
  WHERE id = 'ac62f090-8c14-4e9a-ba8c-8c19c07e94c0'; -- speaking
UPDATE exercises SET prompt = '정곡을 찌르다' WHERE id = '5e2835ce-da0c-4e49-863d-933fea81bf42'; -- listening_choice
UPDATE exercises SET prompt = '정곡을 찌르다', correct_answer = '정곡을 찌르다'
  WHERE id = '5ab0b408-dce2-49f9-9c57-ffc6e0bd7034'; -- listening_type

-- 2c. ja "訤弁" -> "詭弁" (sophistry / fallacy). 訤 is a rare variant, not the word.
UPDATE cards SET target_text = '詭弁' WHERE id = 'aabbccdd-6666-4002-c010-b20000000000';
UPDATE exercises SET prompt = 'What does "詭弁" mean in English?' WHERE id = 'aabbccdd-6666-4002-0001-e00000000010';
UPDATE exercises SET correct_answer = '詭弁' WHERE id = 'aabbccdd-6666-4002-0002-e00000000009';
UPDATE exercises SET correct_answer = '詭弁' WHERE id = 'aabbccdd-6666-4002-0003-e00000000008';
UPDATE exercises SET prompt = 'Write a sentence using the word: 詭弁 (Fallacy)', correct_answer = '詭弁'
  WHERE id = 'aabbccdd-6666-4002-0004-e00000000007';
UPDATE exercises SET correct_answer = '詭弁' WHERE id = 'aabbccdd-6666-4002-0005-e00000000006';
UPDATE exercises SET prompt = 'Find and correct the error: 詭弁x', correct_answer = '詭弁'
  WHERE id = 'aabbccdd-6666-4002-0006-e00000000005';
UPDATE exercises SET prompt = '詭弁', correct_answer = '詭弁', accepted_answers = ARRAY['詭弁']
  WHERE id = '000d0dd9-79b9-4ad5-8bf6-ac2f1bd5fba2'; -- speaking
UPDATE exercises SET prompt = '詭弁' WHERE id = '38909fe5-d829-4a1f-ba2f-c9418d461b08'; -- listening_choice
UPDATE exercises SET prompt = '詭弁', correct_answer = '詭弁' WHERE id = '6d0975ee-fc9c-4824-8126-9ef2e674eec1'; -- listening_type

-- 2d. Cards still carrying corruption that 049 already fixed in `exercises`.
--     Values chosen to match what the exercises now teach, not to re-litigate them.
UPDATE cards SET target_text = '씻다' WHERE id = 'aabbccdd-7777-2003-c006-a20000000000'; -- ko, was 씨다
UPDATE cards SET target_text = '大方' WHERE id = 'aabbccdd-8888-2004-c009-a20000000000'; -- zh, was 慰概

-- ============================================================================
-- SECTION 3 — Cards left stale by 049 (exercises already correct)
-- ============================================================================
UPDATE cards SET native_text = 'Bath'        WHERE id = 'aabbccdd-6666-1007-c004-000000000000'; -- ja お風呂, was 'Bathroom'
UPDATE cards SET native_text = 'Embarrassed' WHERE id = 'aabbccdd-6666-2004-c006-a20000000000'; -- ja 恥ずかしい, was 'Shy'

-- ============================================================================
-- VERIFICATION — every one of these must return zero rows
-- ============================================================================
-- No corrupted strings anywhere:
--   SELECT count(*) FROM cards     WHERE target_text   LIKE ANY (ARRAY['%식은 죄%','%정곱%','%訤弁%','씨다','慰概']);
--   SELECT count(*) FROM exercises WHERE prompt        LIKE ANY (ARRAY['%식은 죄%','%정곱%','%訤弁%']);
--   SELECT count(*) FROM exercises WHERE correct_answer LIKE ANY (ARRAY['%식은 죄%','%정곱%','%訤弁%']);
-- No exercise still glosses the afternoon greetings as evening:
--   SELECT count(*) FROM exercises
--    WHERE (prompt ILIKE '%buenas tardes%' OR prompt ILIKE '%boa tarde%')
--      AND (correct_answer = 'Good evening' OR 'Good evening' = ANY (options));
-- Every MC/listening_choice still has its correct answer among its options:
--   SELECT count(*) FROM exercises WHERE options IS NOT NULL AND NOT (correct_answer = ANY (options));
