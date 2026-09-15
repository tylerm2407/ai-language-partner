/**
 * Write the rollback for the round-2 content patch.
 *
 * Built from `draft-patches.json`, not from the producers, because that file is
 * the artifact a reviewer approves field by field. To prove it is a faithful
 * record of what would ship, this re-renders the forward SQL from it first and
 * requires the result to be byte-identical to `draft.sql`; if the two have
 * diverged the rollback would be reversing something other than the deploy.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPatchSql, renderReverseSql, SNAPSHOT_SHA } from './patch-set-round2.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const round2 = resolve(scriptDirectory, '../../../docs/audits/question-verification/round2');

const draft = JSON.parse(await readFile(resolve(round2, 'draft-patches.json'), 'utf8'));
if (draft.snapshot_sha256 !== SNAPSHOT_SHA) throw new Error('Draft was built against a different frozen snapshot');

const forward = await readFile(resolve(round2, 'draft.sql'), 'utf8');
if (renderPatchSql(draft.patches) !== forward) {
  throw new Error('draft-patches.json no longer renders draft.sql; the rollback would not match the deploy');
}

const reverse = renderReverseSql(draft.patches);
const path = resolve(round2, 'reverse.sql');
await writeFile(path, reverse);

console.log(JSON.stringify({
  path,
  sha256: createHash('sha256').update(reverse).digest('hex'),
  forward_sha256: createHash('sha256').update(forward).digest('hex'),
  reverted_updates: draft.patches.filter(p => p.op !== 'insert').length,
  authored_inserts: draft.patches.filter(p => p.op === 'insert').length,
}, null, 2));
