/** Record the root review actually performed on these exact86 proposals.
 * Hashes prevent this decision from approving future unseen changes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = 'docs/audits/question-verification/remediation';
const target = `${base}/root-narrow-review`;
const reviewed = [
  ['de', 13, '9b3ec307eff351e5b7af00215d4850b08cc9333b763e681a646b450cbbcdc103'],
  ['it', 46, '4a5fe4875cbaef8f1f866550073038eec81fa84458fe8be193e5733f70d6421e'],
  ['zh', 27, 'dac2a0ec4bc00d3918426943d35417d37a55a9fd9721b646e5649f2216b13438'],
];
await mkdir(target, { recursive: true });
const decisions = [];
for (const [language, count, expectedHash] of reviewed) {
  const archive = `${target}/reviewed-${language}-${expectedHash.slice(0, 12)}.json`;
  let text;
  try { text = await readFile(archive, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    text = await readFile(`${base}/de-it-zh/${language}-narrow-evidence.json`, 'utf8');
  }
  if (createHash('sha256').update(text).digest('hex') !== expectedHash) throw new Error(`Unreviewed ${language} evidence; do not extend approval`);
  const evidence = JSON.parse(text);
  if (evidence.patches.length !== count) throw new Error('Reviewed row count changed');
  try { await writeFile(archive, text, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  for (const p of evidence.patches) for (const [field, after] of Object.entries(p.after)) {
    if (isDeepStrictEqual(p.before[field], after)) throw new Error('No changed field');
    decisions.push({ table: p.table, id: p.id, field, before: p.before[field], after,
      decision: 'approve_as_correction', reviewer: 'root, independent of correction author audit_french',
      reviewed_on: '2026-09-13', evidence: archive, evidence_sha256: expectedHash,
      reason: 'Root read every emitted changed value against full original prompt/key/alternatives/metadata and linked reference/card context, then requested and reread selecting-context and explanation revisions. Approval is for the exact correction, not all unchanged content or remaining issue groups.',
    });
  }
}
const output = decisions.map(x => JSON.stringify(x)).join('\n') + '\n';
if (process.argv.includes('--verify')) {
  if (await readFile(`${target}/field-decisions.jsonl`, 'utf8') !== output) throw new Error('Saved review differs');
} else await writeFile(`${target}/field-decisions.jsonl`, output);
console.log(JSON.stringify({ independently_reviewed_rows: 86, changed_fields: decisions.length }));
