/**
 * Follow-up to the independent review of `german-accepted-alternatives.mjs`.
 *
 * The first pass reviewed source `b8fd2f56…` and returned 7 revisions and 1
 * uncertain. All 7 were applied by the integration owner. This script re-checks
 * the INTEGRATED source, confirms each revision landed as recommended and that
 * the property behind it still holds, decides the field left uncertain, and
 * records the confusable-pair adjudication the author's handoff left open.
 *
 * It replays the producer rather than trusting the diff, and re-runs the two
 * checks that found the original defects: grading through the real `gradeAnswer`
 * with runtime `exerciseHints`, and a course-wide lookup of every addition as an
 * authored OPTION on a choice row sharing that row's stimulus.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { germanAcceptedAlternativeRows, germanAcceptedAlternatives } from './german-accepted-alternatives.mjs';
import { gradeAnswer } from '../../lib/grading.ts';

const SOURCE = 'scripts/question-audit/german-accepted-alternatives.mjs';
const SOURCE_SHA = 'c170fc969c5e77cd6a43b4f2072d7741dbaf9002cfa8b21d01b7cf33202ba58a';
const PRIOR_SOURCE_SHA = 'b8fd2f565d0babb67e1a22e4fa1b99e7948962576a9fb859398c77ceff20ad2a';
const EVIDENCE = 'docs/audits/question-verification/remediation/de-it-zh/german-accepted-alternatives-evidence.json';
const TEST = 'docs/audits/question-verification/remediation/de-it-zh/german-accepted-alternatives.test.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const BASE = 'docs/audits/question-verification/remediation/de-alternatives-root-review';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(SOURCE));
if (sourceSha !== SOURCE_SHA) throw new Error(`Integrated source moved: ${sourceSha}`);

const hints = exercise => ({ exerciseHints: {
  exerciseType: exercise.type, skillType: exercise.skill_type,
  targetGrammar: exercise.target_grammar, targetWord: exercise.target_word, language: 'de',
} });

const set = await createPatchSet();
germanAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'de');
const patches = new Map(set.patches().map(p => [p.id, p]));
const every = [];
for (let n = 1; n <= 2312; n++) every.push(get(n));
const K = s => String(s).toLowerCase().trim();

const asOption = new Map();
for (const r of every) for (const option of r.exercise.options ?? []) {
  if (K(option) === K(r.exercise.correct_answer)) continue;
  const k = K(option);
  if (!asOption.has(k)) asOption.set(k, []);
  asOption.get(k).push(r);
}

/** Re-verify the whole integrated set, not only the seven touched rows. */
let additions = 0;
const collisions = [];
for (const [n, key, before, adds] of germanAcceptedAlternativeRows) {
  const { exercise, ref } = get(n);
  const after = patches.get(exercise.id).after.accepted_answers;
  if (JSON.stringify(Object.keys(patches.get(exercise.id).after)) !== '["accepted_answers"]') throw new Error(`${ref} touches more than accepted_answers`);
  if (JSON.stringify(after) !== JSON.stringify([...before, ...adds])) throw new Error(`${ref} is not append-only`);
  const stimulus = exercise.prompt.replace(/^Translate to (English|German): /, '').replace(/^Fill in the missing word: _____ means /, '');
  for (const alternative of adds) {
    additions++;
    if (gradeAnswer(alternative, key, before, hints(exercise)).isCorrect) throw new Error(`${ref}: "${alternative}" already passed`);
    const graded = gradeAnswer(alternative, key, after, hints(exercise));
    if (!graded.isCorrect || graded.feedback !== 'Correct!') throw new Error(`${ref}: "${alternative}" is not an authored acceptance (${graded.feedback})`);
    for (const other of asOption.get(K(alternative)) ?? []) {
      if (other.exercise.prompt.includes(stimulus) || K(other.exercise.correct_answer) === K(key)) {
        collisions.push(`${ref} "${alternative}" is a distractor on ${other.ref}`);
      }
    }
  }
}
if (collisions.length) throw new Error(`Same-stimulus distractor collisions remain: ${collisions.join('; ')}`);
if (germanAcceptedAlternativeRows.length !== 217 || additions !== 302) throw new Error(`Unexpected shape: ${germanAcceptedAlternativeRows.length}/${additions}`);

/** The seven revisions, each with the exact value that had to land. */
const APPLIED = [
  [664, ['Ruhen', 'Ausruhen'], 'Ausruhen added as recommended. Re-verified: it was graded wrong before the patch and is now an authored acceptance returning exact-match "Correct!", not a typo near miss.'],
  [697, ['Ruhen', 'Ausruhen'], 'Ausruhen added as recommended, same re-verification as de-E0664.'],
  [1295, ['Abgabetermin', 'Abgabefrist'], 'Abgabefrist added as recommended. Re-verified as an authored acceptance, and re-checked course-wide: it is still the key of no row and an option on no choice row.'],
  [1853, ['Morals'], 'Ethics withdrawn as recommended. Re-verified that nothing in this row’s emitted array is now an authored distractor on de-E1879, whose options are Doubt / Freedom / Morality / Ethics. Morals is unaffected and still an authored acceptance.'],
  [1923, ['But'], 'Nevertheless withdrawn as recommended. Re-verified against de-E1949, whose options are Fallacy / Nevertheless / Rhetoric / However. But is unaffected and still an authored acceptance.'],
  [2040, ['Abgabetermin', 'Abgabefrist'], 'Abgabefrist added as recommended, same re-verification as de-E1295.'],
  [2217, ['Very rarely'], 'Row now patched as recommended, overturning the idiom rule for this comprehension-direction row. Re-verified that "Very rarely" is an authored acceptance and collides with no key and no choice option course-wide.'],
];

const decisions = [];
const push = d => decisions.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ...d, source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA });

for (const [n, expectedAfter, rationale] of APPLIED) {
  const { exercise, ref } = get(n);
  const after = patches.get(exercise.id).after.accepted_answers;
  if (JSON.stringify(after) !== JSON.stringify(expectedAfter)) throw new Error(`${ref} did not land as recommended: ${JSON.stringify(after)}`);
  push({ ref, table: 'exercises', id: exercise.id, field: 'accepted_answers',
    before: exercise.accepted_answers ?? [], after, decision: 'approve_as_correction', closes: 'independent_revise', rationale });
}

/** The one field left uncertain, now decided. */
{
  const { exercise, ref } = get(2035);
  push({ ref, table: 'exercises', id: exercise.id, field: 'accepted_answers',
    before: exercise.accepted_answers ?? [], after: patches.get(exercise.id).after.accepted_answers,
    decision: 'approve_as_correction', closes: 'independent_uncertain',
    rationale: 'Decided: keep both as authored. The incoherence I flagged is real — "Pressure group" was accepted on this row while "Lobby" was rejected on it, and in English a pressure group IS a lobby — but the incoherent half is the Lobby rejection, not the Pressure group acceptance. Collins and Langenscheidt both give pressure group for Interessengruppe/Interessenverband, so refusing it would mark a dictionary-attested answer wrong, which is the defect this whole batch exists to remove. Resolving it the other way costs nothing and risks nothing. Lobby is a reasonable further addition for the editorial owner, but it is a widening, not a correction, and is not required for this batch to integrate.' });
}

/**
 * Confusable-pair adjudication. These are recommendations for a file this review
 * does not own, recorded here so the decision is bound to evidence rather than
 * to a message. `matches` is the accepted string the grader actually fuzzy-matched,
 * measured by replaying the row — it is what determines the correct pair members.
 */
const PAIRS = [
  ['de', ['vortrag', 'vertrag'], 'add', 'de-E1250', 'Vertrag', 'Vortrag',
   'Confirmed as named by the author. Contract vs talk, unrelated, both taught — Vertrag is the key of de-E1979. o and e are not adjacent on QWERTZ.'],
  ['de', ['gütig', 'mutig'], 'add', 'de-E0784', 'Mutig', 'Gütig',
   'Confirmed as named. Kind vs brave, taught in the SAME unit (A2 Emotions & Personality) — Mutig is the key of de-E0805 and de-E0838. g and m are not adjacent.'],
  ['de', ['feier', 'feiern'], 'add', 'de-E1126', 'Feiern', 'Feier',
   'Confirmed as named. Noun vs verb rather than unrelated words, but the list already carries that shape deliberately (billig/billiger, teuer/teurer), and Feiern is the key of de-E1127.'],
  ['de', ['mann', 'dann'], 'add', 'de-E0610', 'Dann', 'Mann',
   'Confirmed as named. Husband vs then, unrelated — Dann is the key of de-E1558, de-E1575 and de-E1614. m and d are not adjacent.'],
  ['de', ['fegen', 'legen'], 'revise', 'de-E0766', 'legen', 'Fegen',
   'The author names this candidate "Kehren/legen". That pair would be INERT. Replaying the row shows "legen" is fuzzy-matched against the added "Fegen" at distance 1, not against the key "Kehren", which is 6 edits away and outside any budget. The grader consults the pair list on the matched candidate, so the pair must be fegen/legen (to sweep vs to lay). Adding kehren/legen would ship as a no-op fix.'],
  ['de', ['feier', 'fever'], 'add', 'de-E1126', 'Fever', 'Feier',
   'Omitted from the author’s candidate list although it is pinned in the same test. "Fever" is fuzzy-matched against the added "Feier" at distance 1 and is a taught English string, so a learner typing an English illness word on a German-answer row is graded correct.'],
  ['en', ['nice', 'niece'], 'revise', 'de-E0839', 'Niece', 'Nice',
   'Right pair, wrong list. The author files it under German candidates, but both members are English and this row is translate_to_native. The grader already consults the pair list twice, on hints.language and again on "en", so it belongs in the en list where it also protects every other course.'],
  ['en', ['nice', 'rice'], 'add', 'de-E0839', 'Rice', 'Nice',
   'Omitted from the author’s candidate list although pinned in the same test on the same row. Rice is taught and is one edit from the added "Nice".'],
];

for (const [list, pair, verdict, ref, typed, matched, rationale] of PAIRS) {
  push({ ref: `confusable/${pair.join('-')}`, table: 'lib/confusable-pairs.ts', id: pair.join('/'),
    field: `CONFUSABLE_PAIRS.${list}`, before: null, after: null,
    decision: verdict === 'add' ? 'approve_as_correction' : 'revise',
    ...(verdict === 'revise' ? { recommended_after: pair } : { recommended_addition: pair }),
    observed_on: ref, learner_typed: typed, fuzzy_matched_against: matched, rationale });
}

/** One candidate that cannot be fixed this way at all. */
push({ ref: 'confusable/mutig-muetig', table: 'lib/confusable-pairs.ts', id: 'mütig/mutig',
  field: 'CONFUSABLE_PAIRS.de', before: null, after: null, decision: 'reject',
  observed_on: 'de-E0840', learner_typed: 'Mutig', fuzzy_matched_against: 'mütig',
  rationale: 'No pair can close this one. On de-E0840 "Mutig" is accepted through the ACCENT-tolerant branch, not the fuzzy branch: it folds to the same string as the added "mütig". isConfusablePair deliberately skips any pair whose members fold together (the `fa !== fb` guard, there so a pair like avô/avó cannot refuse an exact answer), so mütig/mutig would be inert by construction. If this widening must be closed, the only lever is dropping the "mütig" addition, which I approved as the second-weakest acceptance in the batch.' });

/** The two files I did not review in the first pass, checked now. */
push({ ref: 'evidence/german-accepted-alternatives', table: 'docs', id: EVIDENCE, field: 'file',
  before: '41f4ac4f3503e5cf235218344992690361b2b262b16384c39216b1da8a26a294', after: sha(await readFile(EVIDENCE)),
  decision: 'approve_as_correction',
  rationale: 'Checked, and the arithmetic reconciles: 302 accepted and 25 rejected both match the per-row sums and the declared totals, and 325+2 proposed / 299+5-2 accepted / 26-3+2 rejected each follow from the seven revisions. Two nits, neither affecting a value. `rows_left_unpatched` changed from a list of refs to the integer 4, which loses the refs and would break any consumer expecting the array. And the note on de-E0664 and de-E0697 says the author "withheld it on a procedural rather than linguistic ground"; that reason belongs to Abgabefrist — Ausruhen was never proposed at all, so nobody withheld it.' });

push({ ref: 'test/german-accepted-alternatives', table: 'docs', id: TEST, field: 'file',
  before: '8bff0ae865ddd940c2f99718bd1ad62457f47b8e4df79c1ece71129f66090272', after: sha(await readFile(TEST)),
  decision: 'approve_as_correction',
  rationale: 'Checked line by line. Only the three constants moved (ROWS 216→217, ADDITIONS 299→302, pinned rejections 26→25), each with a comment naming the review. No assertion was removed or weakened: the exact-match `Correct!` assertion and the explicit "Minor typo" guard are both still there, and the pinned typo-widening set is still exactly the same 23 strings — so the five inserted alternatives widened nothing new and the two withdrawals removed nothing from it. Passes 5/5 on the current lib/grading.ts and lib/confusable-pairs.ts, which have both moved again since the author pinned them.' });

await mkdir(BASE, { recursive: true });
const archive = `${BASE}/followup-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, source: SOURCE, source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
  snapshot_sha256: SNAPSHOT_SHA, grading_sha256: sha(await readFile('lib/grading.ts')),
  confusable_pairs_sha256: sha(await readFile('lib/confusable-pairs.ts')),
  rows: germanAcceptedAlternativeRows.length, additions,
  same_stimulus_distractor_collisions: collisions, decisions,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw error; }

const evidenceSha = sha(body);
await writeFile(`${BASE}/followup-field-decisions.jsonl`,
  decisions.map(d => JSON.stringify({ ...d, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n');

console.log(JSON.stringify({ rows: germanAcceptedAlternativeRows.length, additions,
  same_stimulus_distractor_collisions: collisions.length, decisions: decisions.length,
  closes_revise: decisions.filter(d => d.closes === 'independent_revise').length,
  closes_uncertain: decisions.filter(d => d.closes === 'independent_uncertain').length,
  confusable: decisions.filter(d => d.table === 'lib/confusable-pairs.ts').map(d => `${d.field} ${d.id} ${d.decision}`) }, null, 1));
