/**
 * Adding a right answer must not make a wrong one right — the measurement.
 *
 * Shared by `readmission.test.mjs`, which enforces it against a declared
 * allowlist, and by the generator that writes that allowlist, so the two can
 * never disagree about what a readmission is.
 *
 * Every batch test in this audit asserts that each added alternative is refused
 * before the patch and accepted after. None asserted the other half: that
 * everything which should stay wrong is still wrong afterwards. Two independent
 * sweeps found the gap on 2026-09-14 and it was real — the remediation had
 * introduced 88 rows across seven languages where a correct addition readmitted
 * a string the curriculum treats as wrong.
 *
 * The mechanism, stated so the next reader does not have to rediscover it:
 * `gradeAnswer` measures typo distance against whichever accepted answer is
 * NEAREST the learner's input, so every entry in `accepted_answers` carries its
 * own ball of radius `min(2, floor(min(len(entry), len(key)) * 0.3))` around
 * itself, and anything inside that ball is forgiven as a typo of it. Adding an
 * entry adds a ball. That is inherent to fuzzy matching over a multi-entry list,
 * not a mis-set constant: no value of `TYPO_TOLERANCE_RATIO` makes the radius
 * zero without disabling typo tolerance outright, and the additions are correct
 * answers, so there is nothing to withdraw. A guard is the remedy, not a tune.
 *
 * Clamping the basis to the shorter of the entry and the key (same day) removed
 * the worst class — a long addition inflating the budget, which had the key
 * "Cheap" plus "Inexpensive" marking the antonym "Expensive" correct in all
 * seven languages — and took the count from 88 to 70. The remaining 70 are
 * carried as a declared allowlist rather than silently tolerated.
 *
 * This is an ALLOWLIST, not a ratchet to zero. A new readmission fails
 * immediately; a fixed one also fails, so the list cannot rot. Shrinking it is
 * the good direction and requires deleting the entry.
 *
 * Scope, deliberately bounded so the test runs in seconds rather than hours:
 * for each patched row, the strings that should stay wrong are its own
 * distractors and the stored keys of its siblings in the same unit. A string
 * taught only in another unit is out of scope here and is the confusable-pair
 * list's business.
 */
import { readFile } from 'node:fs/promises';
import { gradeAnswer } from '../../lib/grading.ts';
import { blankContext, taughtKeys } from '../../lib/exercise-restore.ts';

const base = 'docs/audits/question-verification/remediation';
const snapshot = JSON.parse(await readFile('.question-audit/snapshot-8c7f381c78d8.json', 'utf8'));
const { patches } = JSON.parse(await readFile(`${base}/draft-patches.json`, 'utf8'));

const exercises = new Map(snapshot.exercises.map((e) => [e.id, e]));
const lessons = new Map(snapshot.lessons.map((l) => [l.id, l]));
const units = new Map(snapshot.units.map((u) => [u.id, u]));
const courses = new Map(snapshot.courses.map((c) => [c.id, c]));

const unitOf = (exercise) => units.get(lessons.get(exercise.lesson_id)?.unit_id);
const courseOf = (exercise) => courses.get(unitOf(exercise)?.course_id);

/**
 * The keys taught by the other non-speaking rows of the same unit, in the form
 * a learner could actually type them.
 *
 * Scoped to the LANGUAGE, because that is what the runtime does since
 * `useTaughtKeys` landed. A course here is one language at one CEFR band, so a
 * narrower scope misses the cross-band collisions entirely — which is how
 * Spanish "Hablé" came to accept "Table".
 *
 * `taughtKeys` is the app's own function, reused rather than reimplemented, so
 * this measurement cannot drift from what the runtime does. It welds a
 * fill-blank key into the word its prompt completes, which is the scoping fix
 * the audit asked for: `rino` is nobody's answer to another question, while
 * `Sobrino` is what the lesson teaches. Counting the fragment produced 17
 * phantom Japanese readmissions and would produce more with every new
 * fill-blank row.
 */
const rowsByLanguage = new Map();
for (const exercise of snapshot.exercises) {
  if (exercise.type === 'speaking' || exercise.response_mode === 'speak') continue;
  const language = courseOf(exercise)?.target_language;
  if (!language) continue;
  if (!rowsByLanguage.has(language)) rowsByLanguage.set(language, []);
  rowsByLanguage.get(language).push({
    type: exercise.type,
    prompt: exercise.prompt ?? '',
    correctAnswer: exercise.correct_answer,
  });
}
const siblingKeys = new Map(
  [...rowsByLanguage].map(([language, rows]) => [language, taughtKeys(rows)]),
);

/**
 * Memoised per (language, key).
 *
 * `gradeAnswer` caches its normalised sibling list on the ARRAY IDENTITY, so
 * building a fresh filtered array on every call defeats the cache and pays the
 * full normalisation of ~2,000 strings per grade. That is the same 250x trap the
 * grader hit when it widened the scope, and it turns this measurement from
 * minutes into hours.
 */
const siblingCache = new Map();
function siblingsExcluding(language, key) {
  if (!language) return [];
  const id = `${language}\u0000${key}`;
  let list = siblingCache.get(id);
  if (!list) {
    list = (siblingKeys.get(language) ?? []).filter((k) => k !== key);
    siblingCache.set(id, list);
  }
  return list;
}

/**
 * The hints the shipped app passes, not a subset of them.
 *
 * Measuring without `siblingKeys` and `blankContext` measures a grader nobody
 * runs: the sibling-key rule and the welded fill-blank comparison both fire
 * only when the caller supplies them, and the lesson runner does. Leaving them
 * out overstated the readmission count by attributing to the content a
 * collision the grader already refuses.
 */
const hintsFor = (exercise, language) => ({
  exerciseHints: {
    exerciseType: exercise.type,
    skillType: exercise.skill_type,
    targetGrammar: exercise.target_grammar,
    targetWord: exercise.target_word,
    language,
    blankContext: exercise.type === 'fill_blank' ? blankContext(exercise.prompt ?? '') : undefined,
    siblingKeys: siblingsExcluding(courseOf(exercise)?.target_language, exercise.correct_answer),
  },
});

export function findReadmissions() {
  const found = [];
  for (const patch of patches) {
    if (patch.table !== 'exercises' || patch.op === 'insert') continue;
    if (!Array.isArray(patch.after.accepted_answers)) continue;
    const before = exercises.get(patch.id);
    if (!before) continue;
    const course = courseOf(before);
    if (!course) continue;
    const language = course.target_language;
    const after = { ...before, ...patch.after };
    const frozen = before.accepted_answers ?? [];
    if (!patch.after.accepted_answers.some((a) => !frozen.includes(a))) continue;

    const shouldStayWrong = new Set([
      ...(before.distractors ?? []),
      ...(siblingKeys.get(course.target_language) ?? []),
    ]);
    for (const candidate of shouldStayWrong) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      if (candidate === after.correct_answer) continue;
      // A string the row itself authors as correct is not a readmission.
      if (after.accepted_answers.includes(candidate)) continue;
      const wasAccepted = gradeAnswer(candidate, before.correct_answer, frozen, hintsFor(before, language)).isCorrect;
      if (wasAccepted) continue;
      const nowAccepted = gradeAnswer(candidate, after.correct_answer, after.accepted_answers, hintsFor(after, language)).isCorrect;
      if (nowAccepted) found.push(`${language}|${patch.id}|${candidate}`);
    }
  }
  return found.sort();
}

