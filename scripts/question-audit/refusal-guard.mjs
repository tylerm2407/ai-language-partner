/**
 * Adding a right answer must never make a wrong answer right.
 *
 * Every batch test in this audit asserts the same two things about each authored
 * alternative: that the grader rejected it before the patch and accepts it after.
 * None of them asserts the converse — that everything which should stay wrong is
 * still wrong afterwards. That gap is not theoretical. A sweep across the whole
 * remediation on 2026-09-14 found 88 rows in seven languages where adding a
 * correct alternative silently readmitted a string that should have stayed
 * refused, the worst recurring in all seven: the key "Cheap" gains "Inexpensive",
 * and "Expensive" lands two edits from it, so the row marks the antonym correct.
 *
 * `lib/grading.ts` has since clamped the tolerance basis to the shorter of the
 * matched alternative and the key, which closed every case where a LONG addition
 * inflated the budget. It cannot close the rest, and 70 survive. Tolerance is
 * measured against whichever accepted answer is nearest, so each addition carries
 * its own ball of radius `min(2, floor(min(len(addition), len(key)) * 0.3))`, and
 * anything already inside that ball is admitted. No constant makes that radius
 * zero without disabling typo tolerance outright, and the additions are correct
 * answers, so there is nothing to withdraw. The remedy is this assertion.
 *
 * What counts as "should stay wrong" is deliberately conservative, because a
 * false alarm here costs an author more than it saves:
 *
 *   1. The row's own authored options, excluding the key. An option that is not
 *      the key is a distractor by construction.
 *   2. The stored key of every other exercise in the same UNIT. Unit, not lesson:
 *      within a unit the lessons are exercise-format groupings over one shared
 *      vocabulary set, so a contrast between two taught items is only visible at
 *      unit scope.
 *   3. Anything the caller names explicitly via `extraRefusals`, which is how a
 *      batch declares the alternatives it considered and deliberately refused.
 *      Those are exactly the strings most at risk, since a refusal recorded in
 *      `accepted_answers` cannot be enforced by `accepted_answers`.
 *
 * Rule 2 has a known and accepted false-positive: where a batch deliberately
 * accepts a sibling's key, for instance 站 for 车站 on a translate row, that is a
 * judgement the batch made and the guard will flag it. Pass it in `allow` to
 * record the judgement rather than suppressing the check wholesale.
 *
 * Read-only. Grades with the real `gradeAnswer` and the runtime `exerciseHints`
 * from `lib/exercise-restore.ts`; without those hints the strict gate does not
 * fire for choice and grammar types and the result is not what a learner meets.
 */
import { gradeAnswer } from '../../lib/grading.ts';

/** The exact hint shape `lib/exercise-restore.ts` builds at runtime. */
function runtimeHints(exercise, language) {
  return {
    exerciseHints: {
      exerciseType: exercise.type,
      skillType: exercise.skill_type,
      targetGrammar: exercise.target_grammar,
      targetWord: exercise.target_word,
      language,
    },
  };
}

function indexSnapshot(snapshot) {
  const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  const courses = new Map(snapshot.courses.map(c => [c.id, c]));
  const unitOf = exercise => lessons.get(exercise.lesson_id)?.unit_id;
  const languageOf = exercise => {
    const unit = units.get(unitOf(exercise));
    return courses.get(unit?.course_id)?.target_language;
  };
  const siblingKeys = new Map();
  for (const exercise of snapshot.exercises) {
    const unitId = unitOf(exercise);
    if (!unitId) continue;
    if (!siblingKeys.has(unitId)) siblingKeys.set(unitId, []);
    siblingKeys.get(unitId).push(exercise);
  }
  return { unitOf, languageOf, siblingKeys };
}

/**
 * Every string that a patch made acceptable and that should have stayed refused.
 *
 * @param set        a patch set from `createPatchSet()`, after producers have run
 * @param extraRefusals  Map<exerciseId, string[]> — alternatives the batch
 *                   considered and deliberately refused on that row
 * @param allow      Map<exerciseId, string[]> — flagged strings the batch has
 *                   examined and accepts as correct on that row anyway
 * @returns          array of violations, empty when the batch is clean
 */
export function refusalRegressions(set, { extraRefusals = new Map(), allow = new Map() } = {}) {
  const { snapshot } = set;
  const { unitOf, languageOf, siblingKeys } = indexSnapshot(snapshot);
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  const violations = [];

  for (const patch of set.patches()) {
    if (patch.table !== 'exercises') continue;
    if (!Object.hasOwn(patch.after, 'accepted_answers')) continue;
    const exercise = byId.get(patch.id);
    if (!exercise) continue;

    const key = patch.after.correct_answer ?? exercise.correct_answer;
    const before = exercise.accepted_answers ?? [];
    const after = patch.after.accepted_answers;
    const added = new Set(after.filter(value => !before.includes(value)));
    const permitted = new Set(allow.get(patch.id) ?? []);
    const hints = runtimeHints(
      { ...exercise, ...patch.after },
      languageOf(exercise),
    );

    const candidates = new Set();
    for (const option of patch.after.options ?? exercise.options ?? []) {
      if (option !== key) candidates.add(option);
    }
    for (const sibling of siblingKeys.get(unitOf(exercise)) ?? []) {
      if (sibling.id === exercise.id) continue;
      if (sibling.correct_answer && sibling.correct_answer !== key) candidates.add(sibling.correct_answer);
    }
    for (const refused of extraRefusals.get(patch.id) ?? []) candidates.add(refused);

    for (const candidate of candidates) {
      // An authored addition is the batch's own decision, not a regression.
      if (added.has(candidate) || permitted.has(candidate)) continue;
      if (gradeAnswer(candidate, key, before, hints).isCorrect) continue;
      const after_ = gradeAnswer(candidate, key, after, hints);
      if (!after_.isCorrect) continue;
      violations.push({
        table: patch.table,
        id: patch.id,
        type: exercise.type,
        language: languageOf(exercise),
        key,
        readmitted: candidate,
        additions: [...added],
        feedback: after_.feedback,
      });
    }
  }
  return violations;
}

/** Throws with every violation named, or returns silently. */
export function assertNoRefusalRegressions(set, options = {}) {
  const violations = refusalRegressions(set, options);
  if (!violations.length) return;
  const lines = violations.map(v =>
    `  [${v.language}] ${v.table}/${v.id} ${v.type}: key ${JSON.stringify(v.key)} now accepts ` +
    `${JSON.stringify(v.readmitted)} (${v.feedback}) after adding ${JSON.stringify(v.additions)}`);
  throw new Error(
    `Adding an accepted answer readmitted ${violations.length} string(s) that should stay refused:\n${lines.join('\n')}\n` +
    `Fix the row, or pass the string in \`allow\` with a recorded reason if it is genuinely correct.`);
}
