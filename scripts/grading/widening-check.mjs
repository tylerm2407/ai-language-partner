/**
 * Does adding a correct answer make a WRONG one correct?
 *
 * Every accepted answer carries a typo neighbourhood around itself, so adding
 * one can admit whatever already sits inside it. The curriculum audit measured
 * the consequence twice. The first sweep found 88 rows in seven languages where
 * an authored addition silently readmitted a string that should have stayed
 * refused — the key "Cheap" gains "Inexpensive", and "Expensive" lands two
 * edits from it. The second, on the round-2 Japanese and Korean transcription
 * additions, found that 88 of 298 rows widen their neighbourhood at all, and
 * that on exactly four of them something real lives in the new space: adding
 * the kanji spelling of おばあさん brings お母さん, お父さん, お姉さん, お嬢さん and
 * お隣さん inside the budget, on rows whose entire job is telling kinship terms
 * apart.
 *
 * THE SCOPE IS THE WHOLE LANGUAGE, AND THAT IS THE POINT. A per-row check —
 * "does this addition widen tolerance on this row" — passes all 88 and catches
 * none of the four. A unit-scoped check misses them too: the colliding terms
 * are taught in other units. What finds them is grading every proposed row
 * against every string the language teaches anywhere: 2,121 in Japanese and
 * 2,030 in Korean, once fill-blank fragments are folded into the words their
 * prompts complete (triage counted the fragments too, and got 2,281 / 2,152).
 *
 *   deno run -A --no-check --sloppy-imports scripts/grading/widening-check.mjs \
 *     --snapshot .question-audit/snapshot-9a20145dc6b5.json \
 *     --additions docs/audits/.../confirmed.json \
 *     [--language ja] [--sibling-scope unit|course|language|lesson|none] [--json out.json]
 *
 * With `--additions` it checks a proposal: each row is graded against the
 * language's taught strings before and after its additions are applied, and
 * anything newly accepted is reported. Without it, it audits the curriculum as
 * it stands — every typed row against every taught string — which is the same
 * question asked of the content already shipped.
 *
 * Exits non-zero when anything is newly accepted, so it can gate a patch.
 *
 * Reads the frozen snapshot and the proposal file. Never writes to the database
 * and never calls a provider.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gradeAnswer, normalize, stripDiacritics } from '../../lib/grading.ts';
import { blankContext, taughtKeys } from '../../lib/exercise-restore.ts';

const args = new Map();
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) args.set(arg.slice(2), process.argv[i + 1]);
}
const snapshotPath = args.get('snapshot');
if (!snapshotPath) throw Error('--snapshot <path to a frozen snapshot json> is required');

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
const units = new Map(snapshot.units.map(u => [u.id, u]));
const courses = new Map(snapshot.courses.map(c => [c.id, c]));
const unitOf = e => lessons.get(e.lesson_id)?.unit_id;
const courseOf = e => units.get(unitOf(e))?.course_id;
const languageOf = e => courses.get(courseOf(e))?.target_language;

/** Types the learner types into. Choice rows are strict and speaking is scored
 *  by `gradeSpeechTranscription`, so neither can be widened by an addition. */
const TYPED = new Set([
  'translate_to_native', 'translate_to_target', 'fill_blank', 'listening_type', 'dictation',
  'free_production', 'cloze_deletion', 'word_form', 'sentence_transformation',
  'error_correction', 'mini_dialogue', 'sentence_construction',
]);

/**
 * Everything the language teaches: keys, accepted answers, options and
 * distractors, from every row of every course in that language. An option is
 * taught in the sense that matters here — the learner has been shown it as a
 * candidate answer and may type it.
 *
 * A fill-blank answer is welded into the word its prompt completes first. The
 * row stores `ごい`, but nobody types `ごい` as an answer to another question —
 * `すごい` is the string the curriculum teaches. Counting the fragment instead
 * produces 205 false alarms in Japanese alone, every one of them a row
 * correctly accepting its own completed word.
 */
const taughtStrings = new Map();
const rowsByUnit = new Map();
const rowsByCourse = new Map();
const rowsByLesson = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!language) continue;
  if (!taughtStrings.has(language)) taughtStrings.set(language, new Set());
  const strings = taughtStrings.get(language);
  const blank = exercise.type === 'fill_blank' ? blankContext(exercise.prompt ?? '') : undefined;
  const whole = value => (blank ? `${blank.prefix}${value}${blank.suffix}` : value);
  for (const value of [
    whole(exercise.correct_answer),
    ...(exercise.accepted_answers ?? []).map(whole),
    ...(exercise.options ?? []),
    ...(exercise.distractors ?? []),
  ]) {
    if (typeof value === 'string' && value.trim() !== '') strings.add(value);
  }
  const unitId = unitOf(exercise);
  if (!rowsByUnit.has(unitId)) rowsByUnit.set(unitId, []);
  rowsByUnit.get(unitId).push(exercise);
  const courseId = courseOf(exercise);
  if (!rowsByCourse.has(courseId)) rowsByCourse.set(courseId, []);
  rowsByCourse.get(courseId).push(exercise);
  if (!rowsByLesson.has(exercise.lesson_id)) rowsByLesson.set(exercise.lesson_id, []);
  rowsByLesson.get(exercise.lesson_id).push(exercise);
}

/**
 * How much of the curriculum counts as "taught alongside this row" — the
 * `siblingKeys` scope in lib/grading.ts. `unit` is what the app passes today;
 * the others are here so the question "what would another scope close, and at
 * what cost" can be answered with the real grader rather than argued.
 */
const siblingScope = args.get('sibling-scope') ?? 'unit';
const rowsByLanguage = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!language) continue;
  if (!rowsByLanguage.has(language)) rowsByLanguage.set(language, []);
  rowsByLanguage.get(language).push(exercise);
}
const siblingRowsFor = (exercise) => {
  if (siblingScope === 'none') return [];
  if (siblingScope === 'lesson') return rowsByLesson.get(exercise.lesson_id) ?? [];
  if (siblingScope === 'course') return rowsByCourse.get(courseOf(exercise)) ?? [];
  // A course is one language at one band — 36 of them across nine languages —
  // so `language` is a wider scope again, covering every band of the course's
  // language.
  if (siblingScope === 'language') return rowsByLanguage.get(languageOf(exercise)) ?? [];
  return rowsByUnit.get(unitOf(exercise)) ?? [];
};
const scopeIdOf = (exercise) => {
  if (siblingScope === 'none') return null;
  if (siblingScope === 'lesson') return exercise.lesson_id;
  if (siblingScope === 'course') return courseOf(exercise);
  if (siblingScope === 'language') return languageOf(exercise);
  return unitOf(exercise);
};

/**
 * One sibling array per scope group, not per row. `gradeAnswer` caches the
 * normalized key set on the array's identity, so handing it a fresh array per
 * row throws that cache away — at language scope, a thousand keys renormalized
 * for every grade.
 */
const siblingsByScope = new Map();
const siblingKeysFor = (exercise) => {
  const id = scopeIdOf(exercise);
  if (id == null) return [];
  const cached = siblingsByScope.get(id);
  if (cached) return cached;
  const built = taughtKeys(siblingRowsFor(exercise).map(row => ({
    type: row.type,
    prompt: row.prompt ?? '',
    correctAnswer: row.correct_answer ?? '',
  })));
  siblingsByScope.set(id, built);
  return built;
};

/** The hints the lesson runner really builds — see lib/exercise-restore.ts.
 *  Without them the strict gate does not fire on choice and grammar rows and
 *  the result is not what a learner meets. */
const runtimeHints = exercise => ({
  exerciseHints: {
    exerciseType: exercise.type,
    skillType: exercise.skill_type,
    targetGrammar: exercise.target_grammar,
    targetWord: exercise.target_word,
    language: languageOf(exercise),
    blankContext: exercise.type === 'fill_blank' ? blankContext(exercise.prompt ?? '') : undefined,
    siblingKeys: siblingKeysFor(exercise),
  },
});

const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
const additionsPath = args.get('additions');
const languageFilter = args.get('language');

/** [{ exercise, before: string[], after: string[] }] — one per row under test. */
const cases = [];
if (additionsPath) {
  const proposals = JSON.parse(await readFile(additionsPath, 'utf8'));
  for (const proposal of Array.isArray(proposals) ? proposals : proposals.rows ?? []) {
    const exercise = byId.get(proposal.exercise_id ?? proposal.id);
    if (!exercise) throw Error(`Proposal names a row that is not in the snapshot: ${proposal.ref ?? proposal.exercise_id}`);
    if (languageFilter && languageOf(exercise) !== languageFilter) continue;
    const before = exercise.accepted_answers ?? [];
    const after = proposal.proposed ?? [...before, ...(proposal.additions ?? [])];
    cases.push({ exercise, ref: proposal.ref ?? exercise.id, before, after });
  }
} else {
  for (const exercise of snapshot.exercises) {
    if (!TYPED.has(exercise.type)) continue;
    if (languageFilter && languageOf(exercise) !== languageFilter) continue;
    const accepted = exercise.accepted_answers ?? [];
    cases.push({ exercise, ref: exercise.id, before: accepted, after: accepted });
  }
}

/**
 * A candidate more than two characters longer or shorter than the key cannot
 * be reached by tolerance: the edit distance is at least the length
 * difference, and the budget is capped at 2. Only used in corpus-audit mode,
 * where the candidate set is every taught string and the comparison would
 * otherwise be tens of millions of grades. Proposal mode checks everything,
 * because an addition can change which string the row compares against.
 */
const MAX_BUDGET = 2;
const reachable = (candidate, row) => {
  const lengths = [row.correct_answer, ...(row.accepted_answers ?? [])]
    .filter(Boolean)
    .map(value => stripDiacritics(normalize(value)).length);
  const length = stripDiacritics(normalize(candidate)).length;
  return lengths.some(other => Math.abs(other - length) <= MAX_BUDGET + 1);
};

const findings = [];
const refused = [];
let rowsWidened = 0;
let graded = 0;
for (const { exercise, ref, before, after } of cases) {
  const language = languageOf(exercise);
  const hints = runtimeHints(exercise);
  const key = exercise.correct_answer;
  if (!key) continue;
  const blank = exercise.type === 'fill_blank' ? blankContext(exercise.prompt ?? '') : undefined;
  const despace = value => value.replace(/\s+/g, '');
  const completed = value => normalize(blank ? `${blank.prefix}${value}${blank.suffix}` : value);
  // The row's own answers, in both the stored and the completed spelling: a
  // fill-blank row accepting the word it completes to is the grader working,
  // not a collision.
  const acceptedNow = new Set([
    ...[key, ...after].map(value => normalize(value)),
    ...[key, ...after].map(value => despace(completed(value))),
  ]);
  // An addition the grader still refuses is a broken proposal, and it is the
  // other half of the same question: does the patch do what it says AND only
  // what it says.
  for (const addition of after.filter(value => !before.includes(value))) {
    graded++;
    if (!gradeAnswer(addition, key, after, hints).isCorrect) {
      refused.push({ ref, id: exercise.id, language, key, addition,
        feedback: gradeAnswer(addition, key, after, hints).feedback });
    }
  }
  let widened = false;
  const newly = [];
  for (const candidate of taughtStrings.get(language)) {
    // The row's own answers are not collateral.
    if (acceptedNow.has(normalize(candidate)) || acceptedNow.has(despace(normalize(candidate)))) continue;
    if (!additionsPath && !reachable(candidate, exercise)) continue;
    graded += additionsPath ? 2 : 1;
    // Proposal mode asks what the addition CHANGED. Corpus mode has nothing to
    // compare against, so it asks the standing question instead: does this row
    // accept a string the language teaches as some other answer, today.
    const after_ = gradeAnswer(candidate, key, after, hints);
    const wasCorrect = additionsPath ? gradeAnswer(candidate, key, before, hints).isCorrect : false;
    if (after_.isCorrect && !wasCorrect) {
      widened = true;
      newly.push({ candidate, feedback: after_.feedback });
    }
    // An addition that makes a previously ACCEPTED string wrong is worth
    // seeing too, but it is not a widening and does not fail the check.
  }
  if (widened) {
    rowsWidened++;
    findings.push({
      ref,
      id: exercise.id,
      language,
      type: exercise.type,
      key,
      added: after.filter(value => !before.includes(value)),
      newly_accepted: newly,
    });
  }
}

const report = {
  snapshot: snapshotPath,
  mode: additionsPath ? 'proposal' : 'corpus audit',
  sibling_scope: siblingScope,
  additions: additionsPath ?? null,
  languages: [...taughtStrings].map(([language, strings]) => ({ language, taught_strings: strings.size })),
  rows_checked: cases.length,
  grades_run: graded,
  [additionsPath ? 'rows_where_a_taught_string_is_newly_accepted' : 'rows_accepting_another_taught_string']:
    rowsWidened,
  additions_the_grader_still_refuses: refused,
  findings,
};
const out = args.get('json');
if (out) await writeFile(out, JSON.stringify(report, null, 1));

console.log(`${report.mode}: ${cases.length} rows, ${graded} grades, sibling scope ${siblingScope}`);
for (const { language, taught_strings } of report.languages) {
  console.log(`  ${language}: ${taught_strings} taught strings`);
}
if (refused.length > 0) {
  console.log(`\n${refused.length} proposed addition(s) the grader still refuses:`);
  for (const r of refused) {
    console.log(`  [${r.language}] ${r.ref}: key ${JSON.stringify(r.key)} refuses its own addition ` +
      `${JSON.stringify(r.addition)} (${r.feedback})`);
  }
  process.exitCode = 1;
}
if (findings.length === 0) {
  console.log(additionsPath
    ? 'No taught string is newly accepted anywhere. Clean.'
    : 'No row accepts another taught string. Clean.');
} else {
  console.log(`\n${rowsWidened} row(s) ${additionsPath ? 'newly ' : ''}accept a string the language teaches as something else:`);
  for (const finding of findings) {
    const added = finding.added.length ? ` after adding ${JSON.stringify(finding.added)}` : '';
    for (const { candidate, feedback } of finding.newly_accepted) {
      console.log(`  [${finding.language}] ${finding.ref} ${finding.type}: key ${JSON.stringify(finding.key)} ` +
        `accepts ${JSON.stringify(candidate)} (${feedback})${added}`);
    }
  }
  process.exitCode = 1;
}
