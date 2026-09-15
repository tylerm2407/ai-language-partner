/**
 * Write the rollback for the frozen content patch.
 *
 * Built from `draft-patches.json` rather than from the producer modules, because
 * that file is the artifact the independent reviewers actually approved,
 * field by field. To prove it is a faithful record of what ships, this first
 * re-renders the forward SQL from it and requires the result to be byte-identical
 * to `draft.sql`. If that check fails the two have diverged and the rollback
 * would be reversing something other than what was deployed.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPatchSql, renderReverseSql, SNAPSHOT_SHA } from './patch-set.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const remediation = resolve(scriptDirectory, '../../docs/audits/question-verification/remediation');

const draft = JSON.parse(await readFile(resolve(remediation, 'draft-patches.json'), 'utf8'));
if (draft.snapshot_sha256 !== SNAPSHOT_SHA) throw new Error('Draft was built against a different frozen snapshot');

const forward = await readFile(resolve(remediation, 'draft.sql'), 'utf8');
if (renderPatchSql(draft.patches) !== forward) {
  throw new Error('draft-patches.json no longer renders draft.sql; the rollback would not match the deploy');
}

const reverse = renderReverseSql(draft.patches);
const path = resolve(remediation, 'reverse.sql');
await writeFile(path, reverse);

console.log(JSON.stringify({
  path,
  sha256: createHash('sha256').update(reverse).digest('hex'),
  forward_sha256: createHash('sha256').update(forward).digest('hex'),
  reverted_updates: draft.patches.filter((p) => p.op !== 'insert').length,
  deleted_inserts: draft.patches.filter((p) => p.op === 'insert').length,
}, null, 2));
