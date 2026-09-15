/**
 * Does copying the prompt back score correct on a translate row?
 *
 * "Translate to English: Delicioso", key `Delicious`, learner types
 * `Delicioso` — a cognate pair sits inside the typo budget of its own
 * translation, so the source word grades as a misspelling of the target word.
 * The question this answers is whether the grader needs a rule of its own for
 * that, or whether the rules it already has cover it.
 *
 * ANSWER, MEASURED: the sibling-key rule covers it. 256 rows accept their own
 * prompt with no sibling keys supplied; 15 still do once they are, at unit
 * scope or at language scope alike. The other 241 close because the source
 * word is itself a taught key in that language — `Delicioso` is the answer to
 * the mirror row, "Translate to Spanish: Delicious" — and a candidate that is
 * another taught key is never a typo.
 *
 * Both directions are counted here. A report of ~115 is the
 * `translate_to_native` half alone.
 *
 * WHAT THE 15 SURVIVORS ARE, and why no rule was written for them:
 *   - 14 are accent cognates, where the source folds onto the key: Menú/Menu,
 *     Hôtel/Hotel, Nièce/Niece, Océan/Ocean, Sofá/Sofa, Présentation/
 *     Presentation, Réservation/Reservation. The grader excludes those from the
 *     sibling rule on purpose — a sibling that folds onto the row's own key is
 *     an accent question, not a lexical one — and refusing them re-opens the
 *     cognate-friction class that was measured at 29 rows and deliberately
 *     kept.
 *   - 1 is `Plate` on the Spanish row keyed `Plato`: `Plate` is a taught key in
 *     French and Portuguese but never in Spanish, and the sibling set is the
 *     learner's own language.
 *
 * AND WHY A SOURCE-ECHO RULE IS THE WRONG SHAPE ANYWAY. There is no structured
 * source string to compare against: 0 of 4,479 translate rows carry a card or a
 * `target_word`, so the source exists only inside the prompt. Prompt shapes
 * vary — "Translate to Spanish:", "Translate:", "Translate using « on »:",
 * "Translate to Chinese WITHOUT 被:", and instructions with no colon at all —
 * and `TranslationExercise` renders the prompt whole, so the display layer has
 * no separately-computed source to hand over either. A rule for these 15 rows
 * would have to parse free text in the grader, and would misfire on the shapes
 * it was not tuned for. The heuristic below is good enough to MEASURE the class
 * and not good enough to GRADE with, which is the whole finding.
 *
 *   deno run -A --no-check --sloppy-imports scripts/grading/prompt-echo-check.mjs \
 *     --snapshot .question-audit/snapshot-9a20145dc6b5.json [--json out.json]
 *
 * Read-only. No database, no provider.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gradeAnswer, normalize, stripDiacritics } from '../../lib/grading.ts';
import { taughtKeys } from '../../lib/exercise-restore.ts';

const args = new Map();
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) args.set(arg.slice(2), process.argv[i + 1]);
}
const snapshotPath = args.get('snapshot');
if (!snapshotPath) throw Error('--snapshot <frozen snapshot json> is required');

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
const units = new Map(snapshot.units.map(u => [u.id, u]));
const courses = new Map(snapshot.courses.map(c => [c.id, c]));
const unitOf = e => lessons.get(e.lesson_id)?.unit_id;
const languageOf = e => courses.get(units.get(unitOf(e))?.course_id)?.target_language;

const rowsByUnit = new Map();
const rowsByLanguage = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!language) continue;
  (rowsByLanguage.get(language) ?? rowsByLanguage.set(language, []).get(language)).push(exercise);
  const unit = unitOf(exercise);
  (rowsByUnit.get(unit) ?? rowsByUnit.set(unit, []).get(unit)).push(exercise);
}
const asRow = e => ({ type: e.type, prompt: e.prompt ?? '', correctAnswer: e.correct_answer ?? '' });
const keyCache = new Map();
const keysOf = (map, id) => {
  const cached = keyCache.get(id);
  if (cached) return cached;
  const built = taughtKeys((map.get(id) ?? []).map(asRow));
  keyCache.set(id, built);
  return built;
};

/** Everything after the last colon. Enough to measure, not to grade — see above. */
const sourceOf = prompt => {
  const at = prompt.lastIndexOf(':');
  return at === -1 ? '' : prompt.slice(at + 1).trim();
};

const rows = [];
let acceptedWithoutSiblings = 0;
let stillAcceptedAtUnit = 0;
for (const exercise of snapshot.exercises) {
  if (exercise.type !== 'translate_to_native' && exercise.type !== 'translate_to_target') continue;
  const language = languageOf(exercise);
  const key = exercise.correct_answer;
  if (!language || !key) continue;
  const source = sourceOf(exercise.prompt ?? '');
  if (!source || normalize(source) === normalize(key)) continue;  // loanword rows: nothing to refuse
  const accepted = exercise.accepted_answers ?? [];
  if (accepted.some(a => normalize(a) === normalize(source))) continue;  // accepted here on purpose

  const hints = siblingKeys => ({
    exerciseHints: {
      exerciseType: exercise.type, skillType: exercise.skill_type,
      targetGrammar: exercise.target_grammar, targetWord: exercise.target_word,
      language, siblingKeys,
    },
  });
  if (!gradeAnswer(source, key, accepted, hints([])).isCorrect) continue;
  acceptedWithoutSiblings++;
  if (gradeAnswer(source, key, accepted, hints(keysOf(rowsByUnit, unitOf(exercise)))).isCorrect) {
    stillAcceptedAtUnit++;
  }
  const atLanguage = gradeAnswer(source, key, accepted, hints(keysOf(rowsByLanguage, language)));
  if (!atLanguage.isCorrect) continue;
  rows.push({
    exercise_id: exercise.id,
    language,
    type: exercise.type,
    prompt: exercise.prompt,
    key,
    echoed_source: source,
    accepted_as: atLanguage.feedback,
    // The two reasons a survivor survives, and both are deliberate.
    folds_onto_the_key: stripDiacritics(normalize(source)) === stripDiacritics(normalize(key)),
  });
}

const report = {
  question: 'Does typing the prompt back score correct on a translate row?',
  answer: 'The sibling-key rule already closes all but a handful; no separate rule was written. ' +
    'See the header of this script for why a source-echo rule is the wrong shape.',
  snapshot: snapshotPath,
  snapshot_captured_at: snapshot.captured_at ?? null,
  accepted_with_no_sibling_keys: acceptedWithoutSiblings,
  still_accepted_at_unit_scope: stillAcceptedAtUnit,
  still_accepted_at_language_scope: rows.length,
  survivors_that_fold_onto_the_key: rows.filter(r => r.folds_onto_the_key).length,
  rows,
};
const out = args.get('json');
if (out) await writeFile(out, JSON.stringify(report, null, 1));

console.log(`echoing the prompt is accepted on ${acceptedWithoutSiblings} rows with no sibling keys`);
console.log(`  still accepted with unit-scoped keys:     ${stillAcceptedAtUnit}`);
console.log(`  still accepted with language-scoped keys: ${rows.length}`);
console.log(`  of those, folding onto the key (accent cognates): ${rows.filter(r => r.folds_onto_the_key).length}`);
for (const r of rows) {
  console.log(`    [${r.language}] ${r.type} ${JSON.stringify(r.prompt).slice(0, 46)} key ${JSON.stringify(r.key)} <- ${JSON.stringify(r.echoed_source)}`);
}
