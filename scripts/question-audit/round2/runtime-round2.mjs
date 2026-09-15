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
const counts = { patched_rows: 0, stored_answers: 0, choice_rows: 0, closed_acceptances: 0, still_open: 0, refusal_claims: 0 };

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

/** 5. The refusals in findings.json are claims about the grader too: each listed
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
  failures,
  production_writes: 0,
  limitations: [
    'Mechanical routing only: says nothing about whether an authored string is linguistically right.',
    'Corpus-attested strings only. The productive hole is on the learner\'s side, so the strings a learner would actually type are not enumerable here.',
    'Does not exercise the semantic grader behind free_production; gradeOpenResponse returns the fixed result first, which is what this measures.',
  ],
};
await writeFile('docs/audits/question-verification/round2/runtime-checks.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ counts, failures: failures.length }, null, 1));
if (failures.length) { console.error(JSON.stringify(failures.slice(0, 20), null, 1)); process.exitCode = 1; }
