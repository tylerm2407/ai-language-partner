import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { chineseWordOrder, chineseWordOrderFixes } from './chinese-word-order-fixes.mjs';
import { reviews } from '../../docs/audits/question-verification/remediation/zh-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/zh-word-order-root-review';
const sourceSha = createHash('sha256').update(await readFile('scripts/question-audit/chinese-word-order-fixes.mjs')).digest('hex');
if (sourceSha !== 'a6abd7271e7e6eb9fc828e421354f84c825fff3660c9b3fcc09d48310860cdf5') throw new Error('Unreviewed source revision');
const archived = JSON.parse(await readFile(`${base}/reviewed-source-52d26bdf6b2c.json`, 'utf8'));
const expected = structuredClone(archived.rows);
for (const row of expected) {
  const r = reviews.find(x => x.ref === row[0]);
  if (r.additions.length) row[4] = [...(row[4] ?? []), ...r.additions];
  if (r.recommended_segmented) { row[2] = r.recommended_english; row[3] = r.recommended_segmented; }
}
if (!eq(expected, chineseWordOrder)) throw new Error('Unreviewed tuple change');
const set = await createPatchSet(); chineseWordOrderFixes(set);
const originals = (await readFile(`${base}/field-decisions.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse);
const fields = [], runtime = [];
for (const patch of set.patches()) {
  const old = originals.find(x => x.id === patch.id);
  const r = reviews.find(x => `zh-E${String(x.ref).padStart(4, '0')}` === old.ref);
  for (const field of Object.keys(patch.after)) {
    const prior = originals.find(x => x.id === patch.id && x.field === field);
    if (prior?.decision === 'approve_as_correction' && eq(prior.after, patch.after[field])) continue;
    if (r.canonical === 'approved' && (field !== 'accepted_answers' || !r.additions.length)) throw new Error('Unexpected follow-up field');
    fields.push({ ...(prior ?? old), field, before: set.snapshot.exercises.find(x => x.id === patch.id)[field], after: patch.after[field],
      decision: 'approve_as_correction', recommended_after: undefined, recommended_replacement: undefined, source_sha256: sourceSha,
      rationale: r.canonical === 'approved'
        ? 'Exact follow-up: independently adjudicated additional order applied precisely; entire126-tuple comparison excludes other changes.'
        : `Exact follow-up: author applied the agreed replacement and root verified its full sentence, meaning and context. ${r.note}` });
  }
  for (const segment of r.additions) {
    const answer = segment.split('|').join('');
    if (!gradeAnswer(answer, patch.after.correct_answer, patch.after.accepted_answers,
      { exerciseHints: { exerciseType: 'sentence_construction', skillType: 'vocabulary', language: 'zh' } }).isCorrect) throw new Error('Revised answer rejected');
    runtime.push({ ref: old.ref, answer, accepted_after: true });
  }
}
if (fields.length !== 17 || runtime.length !== 11) throw new Error(`Unexpected counts ${fields.length}/${runtime.length}`);
for (const [file, data] of [['followup-field-decisions.jsonl', fields], ['followup-runtime-results.jsonl', runtime]]) {
  const output = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${base}/${file}`, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else await writeFile(`${base}/${file}`, output);
}
console.log(JSON.stringify({ canonical_rows: 126, exact_followup_fields: fields.length, new_orders_pass: runtime.length }));
