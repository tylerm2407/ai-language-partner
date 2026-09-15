/**
 * Independent review of `scripts/question-audit/korean-goodbye-fixes.mjs`.
 *
 * The reviewer did not author the batch. One row, one field: ko-E0002
 * `accepted_answers` gains 안녕히 계세요 against the frozen key 안녕히 가세요.
 * It is the only field in the 9,225-field draft at `awaiting_independent_review`.
 *
 * Verified with the real `gradeAnswer` called with the runtime `exerciseHints`
 * from `lib/exercise-restore.ts`, against the frozen snapshot, with the
 * 가세요/계세요 and 안녕히 가세요/안녕히 계세요 entries present in
 * `lib/confusable-pairs.ts`. Every before-value was re-derived today, after the
 * three grader changes (pair list consulted in the accent branch and on both
 * language sides; tolerance basis clamped to the shorter of key and matched
 * alternative; Korean budget measured on the decomposed form).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
import { koreanGoodbyeFixes } from './korean-goodbye-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/ko-goodbye-root-review';
const source = 'scripts/question-audit/korean-goodbye-fixes.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== '555f89d0eec2229bb09a34ec8073d0045e235f900e2e048e68ebeda709b623c7') throw Error('Unreviewed source');

const set = await createPatchSet();
koreanGoodbyeFixes(set);
const get = lessonRefs(set.snapshot, 'ko');
const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ko' } });
const grade = (answer, e, accepted) => {
  const g = gradeAnswer(answer, e.correct_answer, accepted, hints(e));
  return { answer, correct: g.isCorrect, feedback: g.feedback, exact: g.feedback === 'Correct!' };
};

/** The three rows the precondition turns on, graded before and after. */
const probes = [];
for (const [n, answers] of [[2, ['안녕히 가세요', '안녕히 계세요']], [21, ['안녕히 가세요', '안녕히 계세요']], [68, ['가세요', '계세요']]]) {
  const { exercise: e, ref, unit, lesson } = get(n);
  const patch = set.patches().find(p => p.id === e.id);
  const frozen = e.accepted_answers ?? [];
  const after = patch?.after?.accepted_answers ?? frozen;
  probes.push({
    ref, id: e.id, type: e.type, unit: unit.title, lesson: lesson.title,
    prompt: e.question ?? e.prompt, key: e.correct_answer,
    accepted_before: frozen, accepted_after: after, patched_by_this_batch: Boolean(patch),
    before: answers.map(a => grade(a, e, frozen)),
    after: answers.map(a => grade(a, e, after)),
  });
}

/** Does the addition readmit anything the unit teaches as a different answer? */
const unit2 = get(2).unit.id;
const siblingKeys = new Set();
for (let n = 1; n <= 2312; n++) { const r = get(n); if (r.unit.id === unit2 && r.exercise.correct_answer) siblingKeys.add(r.exercise.correct_answer); }
const e2 = get(2).exercise;
const frozen2 = e2.accepted_answers ?? [];
const after2 = set.patches().find(p => p.id === e2.id).after.accepted_answers;
const readmitted = [];
for (const candidate of siblingKeys) {
  if (candidate === e2.correct_answer || after2.includes(candidate)) continue;
  const b = gradeAnswer(candidate, e2.correct_answer, frozen2, hints(e2));
  const a = gradeAnswer(candidate, e2.correct_answer, after2, hints(e2));
  if (!b.isCorrect && a.isCorrect) readmitted.push({ candidate, feedback: a.feedback });
}

const findings = [
  'Precondition confirmed. Without the addition ko-E0002 refuses 안녕히 계세요 ("Almost! The correct answer is: 안녕히 가세요"), because the confusable pair blocks the one-jamo typo match. The pair and this addition must ship together, as the batch states.',
  'ko-E0002 returns exactly "Correct!" for both 안녕히 가세요 and 안녕히 계세요 after the patch. Both are exact matches, not tolerance.',
  'ko-E0021 (listening_type, audio says 안녕히 가세요) still refuses 안녕히 계세요. The row is untouched and falls through to the pair, which is the intended split.',
  'ko-E0068 (fill_blank "안녕히_____ (Goodbye)") accepts both 가세요 and 계세요 as exact matches, from the earlier korean-lesson-fixes batch in the same draft.',
  'No readmission. Against every stored key taught in the same unit ("Greetings & Basics"), the addition makes nothing newly correct.',
  'The batch guards the frozen key, type, lesson title and the exact empty accepted list, carries the existing list through first, touches only accepted_answers, and throws rather than skipping if another producer reaches the field. All re-verified against the frozen snapshot.',
];

const caveats = [
  'This approves the exact value 안녕히 계세요 on ko-E0002 only. It is not approval of the row\'s prompt, key, hint, or of the confusable-pair entries themselves.',
  'A batch-A collision exists on this same row: scripts/question-audit/korean-accepted-alternatives.mjs also patches ko-E0002.accepted_answers, with 잘 가요 and 잘 있어요. That batch is reviewed separately and its addition 잘 가요 readmits 잘 자요 ("Good night", the stored key of ko-E0038 and ko-E0057 in the same unit) on this row. The approval recorded here covers the batch-B value alone; the merged list is NOT approved.',
  'Verified by grading, not on a device. No learner has met this row.',
];

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha,
  reviewer: 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches',
  reviewed_on: '2026-09-14',
  grader: 'lib/grading.ts gradeAnswer with the runtime exerciseHints from lib/exercise-restore.ts; before-values re-derived 2026-09-14 after the decomposed-budget, shorter-basis and accent-branch pair changes',
  confusable_pairs_present: ['가세요/계세요', '안녕히 가세요/안녕히 계세요'],
  patch_rows: set.patches().length,
  probes, readmission_check: { scope: 'stored keys of every row in the same unit', readmitted },
  findings, caveats,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (err) { if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err; }

const patch = set.patches().find(p => p.id === e2.id);
const fields = [{
  reviewer: 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches',
  reviewed_on: '2026-09-14',
  ref: 'ko-E0002', table: 'exercises', id: e2.id, field: 'accepted_answers',
  before: frozen2, after: after2,
  decision: 'approve_as_correction',
  rationale: 'The prompt is the bare gloss "Goodbye" and fixes neither speaker role, so 안녕히 계세요 (to the one staying) renders it as well as the stored 안녕히 가세요 (to the one leaving). Verified with the real grader and the runtime hints: after the patch the row returns exactly "Correct!" for both, while the listening row ko-E0021, whose audio fixes the phrase, still refuses 계세요, and no stored key taught in the unit becomes newly correct. Without this addition the confusable pair turns a correct translation into a rejection.',
  source_sha256: sourceSha,
  sources: ['국립국어원 표준국어대사전 (National Institute of Korean Language, Standard Korean Dictionary): 안녕히 가세요 / 안녕히 계세요'],
  scope_note: 'Approves this exact value only. Does not approve the merged ko-E0002 list proposed by korean-accepted-alternatives.mjs.',
  evidence: archive, evidence_sha256: sha(body),
}];
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify(f)).join('\n') + '\n');

const readme = `# Korean goodbye fix — independent review

Source: \`${source}\`
SHA-256: \`${sourceSha}\`
Reviewer: independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches
Reviewed: 2026-09-14

## Verdict

**Approved as a correction.** One row, one field: \`ko-E0002.accepted_answers\` = ${JSON.stringify(after2)}.
This was the only field in the 9,225-field draft at \`awaiting_independent_review\`.

## What was checked

| Check | Result |
|---|---|
| ko-E0002 accepts 안녕히 가세요 | exactly \`Correct!\` |
| ko-E0002 accepts 안녕히 계세요 | exactly \`Correct!\` (exact match, not tolerance) |
| ko-E0002 WITHOUT the addition | refuses 안녕히 계세요 — the precondition is real |
| ko-E0021 (listening, audio says 가세요) refuses 계세요 | refused, row untouched |
| ko-E0068 accepts 가세요 and 계세요 | both exactly \`Correct!\` |
| Readmission against every sibling key in the unit | none |

Graded with \`lib/grading.ts\` \`gradeAnswer\` and the runtime \`exerciseHints\` from
\`lib/exercise-restore.ts\`, with the 가세요/계세요 pairs present in \`lib/confusable-pairs.ts\`.
Every before-value was re-derived after today's three grader changes.

## Findings

${findings.map(f => `- ${f}`).join('\n')}

## Limits of this approval

${caveats.map(c => `- ${c}`).join('\n')}

This review is not a proof of correctness. It checked the row, its two siblings, and the
unit's stored keys; it did not re-verify the confusable-pair list or the rest of the draft.
`;
await writeFile(`${base}/README.md`, readme);
console.log(JSON.stringify({ rows: probes.length, fields: fields.length, readmitted: readmitted.length, decision: fields[0].decision }));
