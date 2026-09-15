/**
 * Run the SHIPPED grader over the round-2 draft. Mechanical routing only: this
 * proves what the patch does to grading, not that any authored string is right.
 *
 *   node --import ./scripts/question-audit/round2/ts-resolve.mjs \
 *        scripts/question-audit/round2/runtime-round2.mjs
 *
 * Nothing here touches Supabase; it reads the frozen snapshot and the draft.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gradeAnswer } from '../../../lib/grading.ts';
import { SNAPSHOT_FILE, SNAPSHOT_SHA } from './patch-set-round2.mjs';
import { derivationalRows, alreadyStrict } from './productive-paradigm-fixes.mjs';
import { loadTriage, DEPENDENT_ROWS } from './triage-accepted-answers.mjs';

const raw = await readFile(SNAPSHOT_FILE, 'utf8');
if (createHash('sha256').update(raw).digest('hex') !== SNAPSHOT_SHA) throw new Error('Changed frozen snapshot');
const snapshot = JSON.parse(raw);
const draft = JSON.parse(await readFile('docs/audits/question-verification/round2/draft-patches.json', 'utf8'));
if (draft.snapshot_sha256 !== SNAPSHOT_SHA) throw new Error('Draft built against a different snapshot');

const courses = new Map(snapshot.courses.map(c => [c.id, c]));
const units = new Map(snapshot.units.map(u => [u.id, u]));
const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
const before = new Map(snapshot.exercises.map(e => [e.id, e]));
const after = new Map(snapshot.exercises.map(e => [e.id, { ...e }]));
for (const patch of draft.patches) {
  if (patch.table !== 'exercises') continue;
  const row = after.get(patch.id);
  if (!row) throw new Error(`Draft patches a row that is not in the snapshot: ${patch.id}`);
  Object.assign(row, patch.after);
}
const languageOf = exercise => courses.get(units.get(lessons.get(exercise.lesson_id).unit_id).course_id).target_language;
const hints = exercise => ({
  exerciseType: exercise.type, skillType: exercise.skill_type, targetGrammar: exercise.target_grammar,
  targetWord: exercise.target_word, language: languageOf(exercise),
});
const grade = (exercise, answer) => gradeAnswer(answer, exercise.correct_answer, exercise.accepted_answers ?? [], { exerciseHints: hints(exercise) }).isCorrect;

const failures = [];
const counts = {
  patched_rows: 0, stored_answers: 0, choice_rows: 0, closed_acceptances: 0, still_open: 0, refusal_claims: 0,
  triage_rows: 0, triage_additions: 0, whole_language_comparisons: 0, collateral_acceptances: 0, strict_additions_accepted: 0,
};

/** 1. Every stored answer of every patched row must still be accepted. A strict
 * row that rejects its own key would be a far worse defect than the one fixed. */
for (const patch of draft.patches) {
  if (patch.table !== 'exercises') continue;
  counts.patched_rows++;
  const row = after.get(patch.id);
  for (const answer of [row.correct_answer, ...(row.accepted_answers ?? [])]) {
    counts.stored_answers++;
    if (typeof answer !== 'string' || !answer.trim() || !grade(row, answer)) {
      failures.push({ id: patch.id, kind: 'stored_answer_rejected_after_patch', answer });
    }
  }
  if (['multiple_choice', 'listening_choice'].includes(row.type)) {
    counts.choice_rows++;
    const accepted = (row.options ?? []).filter(option => grade(row, option));
    if (accepted.length !== 1) failures.push({ id: patch.id, kind: 'choice_key_count', accepted, options: row.options });
  }
}

/** 2. The derivational table must still be exactly the set the shipped grader
 * finds, and each listed string must go from accepted to rejected. */
const SUFFIXES = { es: ['r', 'ar', 'er', 'ir'], pt: ['r', 'ar', 'er', 'ir'], it: ['re', 'are', 'ere', 'ire'], fr: ['r', 'er', 'ir', 're'], de: ['n', 'en', 'ung'], ru: ['ть', 'ать', 'ить'] };
const taught = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!taught.has(language)) taught.set(language, new Set());
  for (const value of [exercise.correct_answer, ...(exercise.accepted_answers ?? []), ...(exercise.options ?? [])]) {
    if (typeof value === 'string' && value.trim()) taught.get(language).add(value.trim());
  }
}
const rederived = [];
for (const exercise of snapshot.exercises) {
  if (exercise.type === 'speaking' || exercise.response_mode === 'speak' || alreadyStrict(exercise)) continue;
  const language = languageOf(exercise);
  const suffixes = SUFFIXES[language];
  if (!suffixes) continue;
  const key = String(exercise.correct_answer).toLowerCase();
  const own = new Set([exercise.correct_answer, ...(exercise.accepted_answers ?? [])].map(x => String(x).toLowerCase().trim()));
  const hits = [...taught.get(language)].sort().filter(candidate => {
    const lower = candidate.toLowerCase();
    if (own.has(lower)) return false;
    if (!suffixes.some(suffix => lower === key + suffix || key === lower + suffix)) return false;
    return grade(exercise, candidate);
  });
  if (hits.length) rederived.push([exercise.id, hits]);
}
const authored = new Map(derivationalRows.map(([id, , , , , accepts]) => [id, accepts]));
if (rederived.length !== authored.size) failures.push({ kind: 'derivational_set_changed', rederived: rederived.length, authored: authored.size });
for (const [id, hits] of rederived) {
  const listed = authored.get(id);
  if (!listed) { failures.push({ id, kind: 'derivational_row_missing_from_table', hits }); continue; }
  if (JSON.stringify(listed) !== JSON.stringify(hits)) failures.push({ id, kind: 'derivational_strings_changed', listed, hits });
}

/** 3. Every string the two paradigm classes were meant to stop must actually
 * stop, and must have been accepted before the patch. */
for (const [id, , , , , accepts] of derivationalRows) {
  for (const candidate of accepts) {
    if (!grade(before.get(id), candidate)) failures.push({ id, kind: 'was_not_accepted_before', candidate });
    if (grade(after.get(id), candidate)) failures.push({ id, kind: 'still_accepted_after', candidate });
    else counts.closed_acceptances++;
  }
}

/** 4. The same, measured over the whole corpus for the tense class: for each
 * patched row, every OTHER taught string in its language that the row accepts
 * today must be refused after the patch. */
for (const patch of draft.patches) {
  if (patch.table !== 'exercises' || !Object.hasOwn(patch.after, 'target_grammar')) continue;
  const original = before.get(patch.id);
  const patched = after.get(patch.id);
  const language = languageOf(original);
  const own = new Set([original.correct_answer, ...(original.accepted_answers ?? [])].map(x => String(x).toLowerCase().trim()));
  for (const candidate of taught.get(language) ?? []) {
    if (own.has(candidate.toLowerCase().trim())) continue;
    if (!grade(original, candidate)) continue;
    if (grade(patched, candidate)) { failures.push({ id: patch.id, kind: 'wrong_string_still_accepted', candidate }); counts.still_open++; }
    else counts.closed_acceptances++;
  }
}

/**
 * 5. The triage block, checked the way triage insisted it be checked.
 *
 * NOT per row. A per-row check — does this row still accept only its own
 * strings — passes all 88 rows whose typo ball grows and catches none of the
 * four real collisions, because the colliding string belongs to a DIFFERENT
 * row. So every addition is measured against EVERY taught string in its
 * language: 2,281 Japanese and 2,152 Korean keys, accepted answers, options and
 * distractors, re-graded before and after the patch.
 *
 * Three things must hold. Every addition must be accepted after the patch (it
 * is an exact match, so this is really a check that nothing else broke). No
 * stored answer may be lost. And the only strings the patch newly admits must
 * be the twelve the four dependency-bearing kinship rows were declared to admit
 * — anything else is an unrecorded collision and fails the run.
 */
const triage = await loadTriage();

const taughtByLanguage = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!taughtByLanguage.has(language)) taughtByLanguage.set(language, new Set());
  for (const value of [exercise.correct_answer, ...(exercise.accepted_answers ?? []), ...(exercise.options ?? []), ...(exercise.distractors ?? [])]) {
    if (typeof value === 'string' && value.trim()) taughtByLanguage.get(language).add(value.trim());
  }
}
counts.taught_strings_per_language = Object.fromEntries([...taughtByLanguage].map(([k, v]) => [k, v.size]));
const declaredCollateral = new Set(Object.entries(DEPENDENT_ROWS)
  .flatMap(([ref, strings]) => strings.map(string => `${ref}|${string}`)));
const observedCollateral = new Set();
/** Rows the paradigm block also makes strict; see the loss branch below. */
const strictened = new Set(draft.patches.filter(p => Object.hasOwn(p.after, 'target_grammar')).map(p => p.id));
const intendedLosses = [];
for (const entry of triage) {
  const original = before.get(entry.exercise_id);
  const patched = after.get(entry.exercise_id);
  counts.triage_rows++;
  for (const addition of entry.additions) {
    counts.triage_additions++;
    if (!grade(patched, addition)) failures.push({ ref: entry.ref, kind: 'addition_not_accepted', addition });
  }
  const language = languageOf(original);
  for (const candidate of taughtByLanguage.get(language)) {
    const was = grade(original, candidate);
    const now = grade(patched, candidate);
    counts.whole_language_comparisons++;
    if (was && !now) {
      // Seven rows are in both blocks, and on those the paradigm patch makes the
      // row strict on purpose. Losing a wrong string there is the fix, not a
      // regression: each one is already counted in closed_acceptances above. A
      // loss on any row the paradigm patch does NOT touch would be a real
      // regression and fails the run.
      if (strictened.has(entry.exercise_id)) intendedLosses.push({ ref: entry.ref, candidate });
      else failures.push({ ref: entry.ref, kind: 'previously_accepted_string_lost', candidate });
    }
    if (!was && now && !entry.additions.includes(candidate)) {
      observedCollateral.add(`${entry.ref}|${candidate}`);
      if (!declaredCollateral.has(`${entry.ref}|${candidate}`)) {
        failures.push({ ref: entry.ref, kind: 'undeclared_collateral_acceptance', candidate });
      }
    }
  }
}
counts.collateral_acceptances = observedCollateral.size;
counts.intended_losses_on_rows_made_strict = intendedLosses.length;
if (intendedLosses.length !== 4) failures.push({ kind: 'intended_loss_count_changed', intendedLosses });
for (const declared of declaredCollateral) {
  if (!observedCollateral.has(declared)) failures.push({ kind: 'declared_collateral_not_reproduced', declared });
}

/**
 * 6. The precondition, reproduced rather than taken on trust: under strict
 * grading every one of the 313 additions still passes and every collateral
 * acceptance disappears. The probe sets target_grammar, which is the strictness
 * switch this worktree has; the grader branch's Japanese edit-distance gate is
 * not here to test directly, so this establishes the shape of the claim, not
 * that branch's implementation of it.
 */
for (const entry of triage) {
  const strict = { ...after.get(entry.exercise_id), target_grammar: 'strictness-probe' };
  for (const addition of entry.additions) {
    if (!grade(strict, addition)) failures.push({ ref: entry.ref, kind: 'addition_rejected_under_strict_grading', addition });
    else counts.strict_additions_accepted++;
  }
  for (const candidate of DEPENDENT_ROWS[entry.ref] ?? []) {
    if (grade(strict, candidate)) failures.push({ ref: entry.ref, kind: 'collateral_survives_strict_grading', candidate });
  }
}

/** 7. The refusals in findings.json are claims about the grader too: each listed
 * string must be accepted TODAY and rejected under target_grammar. If either
 * half stops holding, the reason Russian and Chinese were left out has changed. */
const findings = JSON.parse(await readFile('docs/audits/question-verification/round2/findings.json', 'utf8'));
for (const side of ['russian', 'chinese']) {
  for (const entry of findings.paradigm_refusals[side].correct_strings_currently_riding_on_tolerance) {
    const original = before.get(entry.id);
    if (!original) { failures.push({ id: entry.id, kind: 'refusal_row_missing' }); continue; }
    const strict = { ...original, target_grammar: 'refusal-probe' };
    for (const candidate of entry.would_start_rejecting) {
      counts.refusal_claims++;
      if (!grade(original, candidate)) failures.push({ id: entry.id, kind: 'refusal_claim_not_accepted_today', candidate });
      if (grade(strict, candidate)) failures.push({ id: entry.id, kind: 'refusal_claim_would_not_be_rejected', candidate });
    }
  }
}

const record = {
  round: 2,
  grader: 'lib/grading.ts gradeAnswer, with the runtime exerciseHints shape from lib/exercise-restore.ts',
  snapshot_sha256: SNAPSHOT_SHA,
  draft_sha256: createHash('sha256').update(JSON.stringify(draft.patches)).digest('hex'),
  counts,
  triage_source: 'docs/audits/question-verification/round2/triage-confirmed.json',
  declared_collateral: Object.entries(DEPENDENT_ROWS).flatMap(([ref, strings]) => strings.map(s => ({ ref, string: s }))),
  intended_losses_on_rows_made_strict: intendedLosses,
  failures,
  production_writes: 0,
  limitations: [
    'Mechanical routing only: says nothing about whether an authored string is linguistically right.',
    'Corpus-attested strings only. The productive hole is on the learner\'s side, so the strings a learner would actually type are not enumerable here.',
    'Does not exercise the semantic grader behind free_production; gradeOpenResponse returns the fixed result first, which is what this measures.',
    'Runs lib/grading.ts as it stands on this branch. The grader branch\'s Japanese edit-distance gate is not present, so the 12 collateral acceptances are expected here and are the reason this patch must ship with that branch; the strict-grading probe shows they vanish under strictness.',
  ],
};
await writeFile('docs/audits/question-verification/round2/runtime-checks.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ counts, failures: failures.length }, null, 1));
if (failures.length) { console.error(JSON.stringify(failures.slice(0, 20), null, 1)); process.exitCode = 1; }
