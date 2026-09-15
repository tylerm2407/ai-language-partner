import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { italianWordOrder, italianWordOrderFixes } from './italian-word-order-fixes.mjs';
import { reviews } from '../../docs/audits/question-verification/remediation/it-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/it-word-order-root-review';
const sourceSha = createHash('sha256').update(await readFile('scripts/question-audit/italian-word-order-fixes.mjs')).digest('hex');
if (sourceSha !== 'cd4a4a8e984a12b75f22fed2f58331238e6965dcfe3dd80122ac22f981d3c8ea') throw new Error('Unreviewed source revision');
const archived = JSON.parse(await readFile(`${base}/reviewed-source-7710f9badaab.json`, 'utf8'));
const expected = structuredClone(archived.rows);
for (const row of expected) {
  const r = reviews.find(x => x.ref === row[0]);
  if (r.additions.length) row[4] = [...new Set([...(row[4] ?? []), ...r.additions])];
}
if (!eq(expected, italianWordOrder)) throw new Error('Unexpected tuple change');
const set = await createPatchSet(); italianWordOrderFixes(set);
const originals = (await readFile(`${base}/field-decisions.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse);
const fields = [], runtime = [];
for (const patch of set.patches()) {
  const original = originals.find(x => x.id === patch.id);
  const d = originals.find(x => x.id === patch.id && x.field === 'accepted_answers') ?? {
    ...original, field: 'accepted_answers', before: set.snapshot.exercises.find(x => x.id === patch.id).accepted_answers,
  };
  const r = reviews.find(x => `it-E${String(x.ref).padStart(4, '0')}` === originals.find(x => x.id === patch.id).ref);
  if (!r.additions.length) continue;
  const oldTuple = archived.rows.find(x => x[0] === r.ref);
  if (!eq([...new Set([...(oldTuple[4] ?? []), ...r.additions])], patch.after.accepted_answers)) throw new Error('Unreviewed answer list');
  fields.push({ ...d, after: patch.after.accepted_answers, decision: 'approve_as_correction', source_sha256: sourceSha,
    recommended_after: undefined, dependency: null,
    rationale: 'Exact follow-up after independent author adjudication: all19 proposed orders were applied exactly; complete99-tuple comparison excludes any other wording change.' });
  for (const answer of r.additions) {
    if (!gradeAnswer(answer, patch.after.correct_answer, patch.after.accepted_answers,
      { exerciseHints: { exerciseType: 'sentence_construction', skillType: 'vocabulary', language: 'it' } }).isCorrect) throw new Error('Revised answer rejected');
    runtime.push({ ref: d.ref, answer, accepted_after: true });
  }
}
if (fields.length !== 19 || runtime.length !== 19) throw new Error('Incomplete follow-up');
for (const [file, data] of [['followup-field-decisions.jsonl', fields], ['followup-runtime-results.jsonl', runtime]]) {
  const output = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${base}/${file}`, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else await writeFile(`${base}/${file}`, output);
}
console.log(JSON.stringify({ canonical_rows: 99, revised_fields: fields.length, actual_new_order_passes: runtime.length }));
