-- 064_content_audit_fill_blanks.sql
-- Content audit 2026-08-08, part 5 of 5: 549 malformed fill-in-the-blank rows.
--
-- THE DEFECT
--   prompt: "_____ (Reservation)"      correct_answer: 预约
-- The blank IS the entire answer. There is no stem to reason from, so this is a
-- translate-to-target exercise wearing a fill-blank costume — except the learner
-- is shown a row of underscores and expected to infer what shape of answer fits.
--
-- The generator split each target on whitespace to choose the blank. CJK has no
-- inter-word spaces, so the split found nothing and blanked the whole string.
-- That is why the damage is concentrated in three courses:
--   zh 203, ko 154, ja 143   (500 of 549)
--   pt 13, ru 12, fr 10, de 6, it 5, es 3
--
-- TWO FIXES, chosen by whether a stem is even possible:
--
--   A. answer is 2+ characters (472 rows) — reveal the first half, blank the
--      rest. This is exactly the shape the deck already uses where the
--      generator worked: "Buenas_____ (Good afternoon)", "Entschu_____
--      (Excuse me)", "こん_____ (Good evening)".
--
--   B. answer is a single character (77 rows) — 水, 犬, 母, 是. No stem exists,
--      so no amount of rewriting makes these a fill-blank. They are retyped as
--      `cloze_deletion`, whose prompt format ("Fill in the missing word: _____
--      means X") is honest about the blank being the whole answer. That type is
--      already in use with exactly this wording.
--
-- WHY NOT DELETE GROUP B
-- Deleting the 77 would drop 11 lessons from 11 exercises to 9 or 10, below the
-- 10-15 range in .claude/rules/learning.md. Retyping preserves lesson length.
-- Verified beforehand: the conversion collides with zero existing cloze rows in
-- the same lesson.

-- ============================================================================
-- GROUP A — 2+ character answers: give the blank a real stem
-- ============================================================================
-- Reveal floor(len/2) characters, minimum 1, and blank the remainder. A 2-char
-- answer reveals 1; a 5-char answer reveals 2, matching the existing こん_____
-- ratio. char_length / substr are codepoint-based in Postgres, so this is
-- correct for CJK and for accented Latin ("Mãe" -> "M_____" + "ãe").
UPDATE exercises
SET prompt = substr(correct_answer, 1, greatest(1, char_length(correct_answer) / 2))
             || '_____ ('
             || substring(prompt from '\((.*)\)$')
             || ')',
    correct_answer = substr(correct_answer, greatest(1, char_length(correct_answer) / 2) + 1)
WHERE type = 'fill_blank'
  AND prompt ~ '^_+\s*\('
  AND char_length(correct_answer) > 1;

-- ============================================================================
-- GROUP B — single-character answers: retype as cloze_deletion
-- ============================================================================
UPDATE exercises
SET type   = 'cloze_deletion',
    prompt = 'Fill in the missing word: _____ means ' || substring(prompt from '\((.*)\)$')
WHERE type = 'fill_blank'
  AND prompt ~ '^_+\s*\('
  AND char_length(correct_answer) = 1;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- No fill_blank may have the blank as its entire prompt:
--   SELECT count(*) FROM exercises WHERE type = 'fill_blank' AND prompt ~ '^_+\s*\(';   -- expect 0
--
-- Every fill_blank still has a non-empty answer and a visible stem:
--   SELECT count(*) FROM exercises WHERE type = 'fill_blank'
--     AND (correct_answer = '' OR correct_answer IS NULL);                              -- expect 0
--
-- Lesson lengths stay inside the 10-15 rule (max 16 pre-existing, see §8 of
-- docs/NEXT-SESSION.md — this migration changes no lesson's size):
--   SELECT min(n), max(n) FROM (SELECT lesson_id, count(*) n FROM exercises GROUP BY lesson_id) t;
