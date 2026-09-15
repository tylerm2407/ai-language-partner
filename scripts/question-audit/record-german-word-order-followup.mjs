// Verify the author's exact application of root's individually reviewed orders.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { germanWordOrder, germanWordOrderFixes } from './german-word-order-fixes.mjs';
import { reviews } from '../../docs/audits/question-verification/remediation/de-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/de-word-order-root-review';
const source = await readFile('scripts/question-audit/german-word-order-fixes.mjs');
const sourceSha = createHash('sha256').update(source).digest('hex');
if (sourceSha !== '45c9f636f1e5f8d5bf6009b8f62b0ead864a94f7db2a8dc10004065b1759306a') throw new Error('Unreviewed source revision');
const archived = JSON.parse(await readFile(`${base}/reviewed-source-a6a8986730c1.json`, 'utf8'));
const expectedRows = structuredClone(archived.rows);
for (const row of expectedRows) {
  const review = reviews.find(r => r.ref === row[0]);
  if (review.additions.length) row[4] = [...new Set([...(row[4] ?? []), ...review.additions])];
  if (row[0] === 1562) row[3] = 'Zuerst fanden wir eine alte Karte, und dann begannen wir, nach dem verschwundenen Haus zu suchen.';
}
if (!isDeepStrictEqual(expectedRows, germanWordOrder)) throw new Error('Author revision differs from individually adjudicated changes');
const set = await createPatchSet();
germanWordOrderFixes(set);
const oldFields = (await readFile(`${base}/field-decisions.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse);
const fields = [], runtime = [];
for (const patch of set.patches()) {
  for (const field of Object.keys(patch.after)) {
    const old = oldFields.find(d => d.id === patch.id && d.field === field);
    if (!old) throw new Error('Missing original review');
    if (old.decision === 'approve_as_correction' && isDeepStrictEqual(old.after, patch.after[field])) continue;
    if (old.ref !== 'de-E1562' && field !== 'accepted_answers') throw new Error('Unexpected field revision');
    fields.push({ ...old, after: patch.after[field], decision: 'approve_as_correction', source_sha256: sourceSha,
      rationale: old.ref === 'de-E1562'
        ? 'Exact follow-up: the expanded infinitive is explicitly punctuated as a subordinate clause. This is a valid authored replacement for the original sole tile, not a claim that coherent beginnen without a comma is always wrong.'
        : 'Exact follow-up: author applied precisely the independently reviewed additional orders; complete tuple comparison excludes other changes.',
      dependency: null, recommended_after: undefined });
  }
  const old = oldFields.find(d => d.id === patch.id);
  const review = reviews.find(r => `de-E${String(r.ref).padStart(4, '0')}` === old.ref);
  for (const answer of review.additions) {
    const result = gradeAnswer(answer, patch.after.correct_answer, patch.after.accepted_answers,
      { exerciseHints: { exerciseType: 'sentence_construction', skillType: 'vocabulary', language: 'de' } });
    if (!result.isCorrect) throw new Error(`Revised grader rejection: ${old.ref}`);
    runtime.push({ ref: old.ref, answer, accepted_after: true });
  }
}
if (fields.length !== 35 || runtime.length !== 41) throw new Error(`Unexpected counts: ${fields.length}/${runtime.length}`);
for (const [file, data] of [['followup-field-decisions.jsonl', fields], ['followup-runtime-results.jsonl', runtime]]) {
  const output = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${base}/${file}`, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else await writeFile(`${base}/${file}`, output);
}
console.log(JSON.stringify({ exact_revised_fields: fields.length, added_orders_pass: runtime.length, canonical_rows: 106, deployed: false }));
