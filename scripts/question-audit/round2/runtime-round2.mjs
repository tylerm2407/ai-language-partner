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
import { TRAVEL_BOOKING_RULING } from './travel-booking-ruling.mjs';
import { derivationalRows, alreadyStrict } from './productive-paradigm-fixes.mjs';
import { loadTriage, DEPENDENT_ROWS } from './triage-accepted-answers.mjs';
import { GATE_DEPENDENT_COMPARATIVES } from './restored-withdrawals.mjs';
import { lessonRefs } from '../lesson-refs.mjs';
import { FR_C0024, REGISTER_REMOVALS } from './product-rulings.mjs';
import { isCorrect as checkpointCorrect } from '../../../supabase/functions/checkpoint/checkpoint-core.ts';

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
 * 5. Every accepted-answer addition, checked the way triage insisted it be checked.
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
 *
 * The rows checked are every exercise whose `accepted_answers` this patch
 * changes AND whose key it leaves alone: the triage block, both product rulings,
 * and the union rows where they overlap. Film & Theater is excluded because it
 * rewrites the key as well, so a before/after grading comparison there would be
 * comparing two different questions; those rows are covered by check 1.
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
/**
 * Collateral this branch WILL observe and the merged branch will not.
 *
 * Two sources, both gate-dependent and both declared: the four kinship rows, and
 * the three comparatives restored under the same condition. This worktree's
 * lib/grading.ts has no Japanese kanji gate — verified, zero occurrences — so a
 * tolerance measurement made here describes a grader that will not ship. The
 * gate withdraws fuzzy acceptance on a kanji-bearing answer before the budget is
 * consulted, which is why the merged branch measures none of this. Declaring
 * them keeps the check honest in both directions: it must see exactly these and
 * nothing else.
 */
const declaredCollateral = new Set([
  ...Object.entries(DEPENDENT_ROWS).flatMap(([ref, strings]) => strings.map(string => `${ref}|${string}`)),
  ...GATE_DEPENDENT_COMPARATIVES.flatMap(entry => entry.admits_without_the_gate.map(string => `${entry.ref}|${string}`)),
]);
const observedCollateral = new Set();
/** Rows the paradigm block also makes strict; see the loss branch below. */
const strictened = new Set(draft.patches.filter(p => Object.hasOwn(p.after, 'target_grammar')).map(p => p.id));
/** Rows where losing a string IS the authored change: the two register removals.
 * Only the argued string may go, and only from its own row. */
const withdrawn = new Map(REGISTER_REMOVALS.map(entry => [entry.id, entry.remove]));
const intendedLosses = [];
const intendedRemovals = [];
/** Ref for every Japanese row, so a declared collateral entry written as a ref
 * and an observed one keyed by exercise id compare as the same thing. */
const japanese = lessonRefs(snapshot, 'ja');
const refOf = new Map(triage.map(entry => [entry.exercise_id, entry.ref]));
for (let n = 1; n <= 2312; n++) {
  const { exercise } = japanese(n);
  if (!refOf.has(exercise.id)) refOf.set(exercise.id, `ja-E${String(n).padStart(4, '0')}`);
}
/** Every row whose accepted_answers moves and whose key does not. */
const acceptedAnswerRows = draft.patches
  .filter(patch => patch.table === 'exercises' && Array.isArray(patch.after.accepted_answers)
    && !Object.hasOwn(patch.after, 'correct_answer'))
  .map(patch => ({
    id: patch.id,
    ref: refOf.get(patch.id) ?? patch.id,
    additions: patch.after.accepted_answers.filter(value => !(patch.before.accepted_answers ?? []).includes(value)),
  }));
for (const entry of acceptedAnswerRows) {
  const original = before.get(entry.id);
  const patched = after.get(entry.id);
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
      if (withdrawn.get(entry.id) === candidate) intendedRemovals.push({ ref: entry.ref, candidate });
      else if (strictened.has(entry.id)) intendedLosses.push({ ref: entry.ref, candidate });
      // The Travel unit ruling withdraws "To reserve" from the 预约 row on
      // purpose, argued in travel-booking-ruling.mjs. Declared here so it is a
      // recorded decision rather than an unexplained loss.
      else if (entry.id === TRAVEL_BOOKING_RULING.rows[0]) intendedRemovals.push({ ref: entry.ref, candidate, ruling: 'travel-booking' });
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
const alreadyRefusedByTheFixedGrader = [];
const graderSource = await readFile(new URL('../../../lib/grading.ts', import.meta.url), 'utf8');
const gatePresent = /kanji/i.test(graderSource);

counts.collateral_acceptances = observedCollateral.size;
counts.intended_losses_on_rows_made_strict = intendedLosses.length;
/**
 * How many strings the paradigm block withdraws by making a row strict.
 *
 * Grader-dependent, like everything else on this page. Five of them are
 * accepted by the grader as it shipped; four of those five are already refused
 * once the audit's grading fixes are in, so on a branch carrying them only one
 * loss is left for strictness to cause. Both numbers are the correct answer for
 * their own grader, and pinning either alone makes the check wrong on the other
 * branch — which is how this run came to fail on a change that improved things.
 */
const expectedIntendedLosses = gatePresent ? 1 : 5;
counts.intended_loss_expectation = `${expectedIntendedLosses} (grader ${gatePresent ? 'with' : 'without'} the audit's fixes)`;
if (intendedLosses.length !== expectedIntendedLosses) {
  failures.push({ kind: 'intended_loss_count_changed', expected: expectedIntendedLosses, intendedLosses });
}
counts.argued_register_removals = intendedRemovals.length;
if (intendedRemovals.length !== REGISTER_REMOVALS.length + 1) {
  failures.push({ kind: 'register_removal_not_observed', expected: REGISTER_REMOVALS.map(e => e.remove), observed: intendedRemovals });
}
// The withdrawn strings must be rejected on their own row and nowhere else must
// have started rejecting them.
for (const entry of REGISTER_REMOVALS) {
  if (!grade(before.get(entry.id), entry.remove)) failures.push({ ref: entry.ref, kind: 'removal_was_not_accepted_before', candidate: entry.remove });
  if (grade(after.get(entry.id), entry.remove)) failures.push({ ref: entry.ref, kind: 'removal_still_accepted', candidate: entry.remove });
  for (const kept of entry.after) {
    if (!grade(after.get(entry.id), kept)) failures.push({ ref: entry.ref, kind: 'kept_answer_lost', candidate: kept });
  }
}
/**
 * Whether the grader this run is measuring HAS the Japanese kanji gate.
 *
 * This check was written on a branch that could not execute the gate, where the
 * declared collateral is the honest expectation and failing to reproduce it
 * would mean the declaration had gone stale. On a branch where the gate IS
 * present the expectation inverts: the gate exists precisely to close these,
 * so every one of them must be ABSENT, and any that survives is the gate
 * failing at the job the apply precondition rests on.
 *
 * Detected from the source rather than assumed, so a run always states which
 * grader it measured instead of which branch someone thought they were on.
 */

for (const declared of declaredCollateral) {
  const observed = observedCollateral.has(declared);
  if (gatePresent && observed) {
    failures.push({ kind: 'gate_present_but_collateral_survives', declared,
      note: 'The kanji gate is in this grader and should have closed this. The apply precondition rests on it closing all of them.' });
  }
  if (!gatePresent && !observed) {
    failures.push({ kind: 'declared_collateral_not_reproduced', declared });
  }
}

/**
 * 6. The precondition, reproduced rather than taken on trust: under strict
 * grading every one of the 313 additions still passes and every collateral
 * acceptance disappears. The probe sets target_grammar, which is the strictness
 * switch this worktree has; the grader branch's Japanese edit-distance gate is
 * not here to test directly, so this establishes the shape of the claim, not
 * that branch's implementation of it.
 */
for (const entry of acceptedAnswerRows) {
  const strict = { ...after.get(entry.id), target_grammar: 'strictness-probe' };
  for (const addition of entry.additions) {
    if (!grade(strict, addition)) failures.push({ ref: entry.ref, kind: 'addition_rejected_under_strict_grading', addition });
    else counts.strict_additions_accepted++;
  }
  for (const candidate of DEPENDENT_ROWS[entry.ref] ?? []) {
    if (grade(strict, candidate)) failures.push({ ref: entry.ref, kind: 'collateral_survives_strict_grading', candidate });
  }
}

/**
 * 6b. fr-C0024 goes through the checkpoint grader, not gradeAnswer. Its
 * normalizeAnswer strips punctuation, so the paraphrase's elided apostrophe is
 * not in the comparison — which is why the hypothesis this claim was filed under
 * was disproved. Check the addition is accepted and nothing else moved.
 */
{
  const patch = draft.patches.find(p => p.table === 'checkpoint_items');
  const frozen = snapshot.checkpoint_items.find(item => item.id === FR_C0024.id);
  const patched = { ...frozen, ...patch.after };
  const item = row => ({ id: row.id, strand: row.strand, prompt: row.prompt, audio_text: row.audio_text, correct_answer: row.correct_answer, accepted_answers: row.accepted_answers, options: row.options });
  if (checkpointCorrect(FR_C0024.addition, item(frozen))) failures.push({ ref: 'fr-C0024', kind: 'paraphrase_was_already_accepted' });
  if (!checkpointCorrect(FR_C0024.addition, item(patched))) failures.push({ ref: 'fr-C0024', kind: 'paraphrase_not_accepted_after_patch' });
  for (const answer of FR_C0024.before) {
    if (!checkpointCorrect(answer, item(patched))) failures.push({ ref: 'fr-C0024', kind: 'existing_answer_lost', answer });
  }
  // The unelided form stays wrong: "de un" is ungrammatical and the checkpoint
  // normaliser keeps the two apart.
  if (checkpointCorrect('par l’intermédiaire de', item(patched))) failures.push({ ref: 'fr-C0024', kind: 'unelided_form_accepted' });
  counts.checkpoint_answers_checked = FR_C0024.before.length + 2;
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
      // "accepted today" was measured against the grader as it shipped. On a
      // branch carrying the grading fixes the candidate may already be refused
      // — the claim is then satisfied more strongly than it asked, not broken —
      // so it is recorded rather than failed.
      if (!grade(original, candidate)) {
        if (gatePresent) alreadyRefusedByTheFixedGrader.push({ id: entry.id, candidate });
        else failures.push({ id: entry.id, kind: 'refusal_claim_not_accepted_today', candidate });
      }
      if (grade(strict, candidate)) failures.push({ id: entry.id, kind: 'refusal_claim_would_not_be_rejected', candidate });
    }
  }
}

counts.refusal_claims_already_closed_by_the_fixed_grader = alreadyRefusedByTheFixedGrader.length;

const record = {
  round: 2,
  grader: 'lib/grading.ts gradeAnswer, with the runtime exerciseHints shape from lib/exercise-restore.ts',
  snapshot_sha256: SNAPSHOT_SHA,
  draft_sha256: createHash('sha256').update(JSON.stringify(draft.patches)).digest('hex'),
  counts,
  triage_source: 'docs/audits/question-verification/round2/triage-confirmed.json',
  declared_collateral: [
    ...Object.entries(DEPENDENT_ROWS).flatMap(([ref, strings]) => strings.map(s => ({ ref, string: s, source: 'kinship' }))),
    ...GATE_DEPENDENT_COMPARATIVES.flatMap(e => e.admits_without_the_gate.map(s => ({ ref: e.ref, string: s, source: 'comparative' }))),
  ],
  gate_present: gatePresent,
  gate_note: gatePresent
    ? 'The Japanese kanji gate IS present in this grader, so every declared gate-dependent collateral acceptance must be absent and this run asserts that. A survivor would mean the gate is not doing the job the apply precondition rests on.'
    : 'This branch has no Japanese kanji gate (detected from lib/grading.ts). Every collateral acceptance recorded here is gate-dependent and measured on a grader that will not ship; a branch carrying the gate measures none of them.',
  intended_losses_on_rows_made_strict: intendedLosses,
  argued_register_removals: REGISTER_REMOVALS.map(entry => ({ ref: entry.ref, key: entry.key, removed: entry.remove, remaining: entry.after, why_downward: entry.why_downward })),
  failures,
  production_writes: 0,
  limitations: [
    'Mechanical routing only: says nothing about whether an authored string is linguistically right.',
    'Corpus-attested strings only. The productive hole is on the learner\'s side, so the strings a learner would actually type are not enumerable here.',
    'Does not exercise the semantic grader behind free_production; gradeOpenResponse returns the fixed result first, which is what this measures.',
    gatePresent
      ? 'Runs lib/grading.ts as it stands on this branch, WITH the Japanese edit-distance gate. Zero collateral acceptances is the expected result and the assertion: the gate closes every one the ungated grader shows, which is what the apply precondition rests on.'
      : 'Runs lib/grading.ts as it stands on this branch. The grader branch\'s Japanese edit-distance gate is not present, so the collateral acceptances are expected here and are the reason this patch must ship with that branch; the strict-grading probe shows they vanish under strictness.',
  ],
};
await writeFile('docs/audits/question-verification/round2/runtime-checks.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ counts, failures: failures.length }, null, 1));
if (failures.length) { console.error(JSON.stringify(failures.slice(0, 20), null, 1)); process.exitCode = 1; }
