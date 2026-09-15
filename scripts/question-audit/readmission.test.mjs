/**
 * Adding a right answer must not make a wrong one right.
 *
 * The measurement lives in `readmission.mjs`, shared with the generator that
 * writes the allowlist, so the two cannot disagree about what a readmission is.
 * Read that file for the mechanism and for why this is a guard rather than a
 * grader tune.
 *
 * This is an ALLOWLIST, not a ratchet to zero. A new readmission fails
 * immediately; a fixed one also fails, so the list cannot rot. Shrinking it is
 * the good direction and requires deleting the entry.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findReadmissions } from './readmission.mjs';

const base = 'docs/audits/question-verification/remediation';
const allowed = JSON.parse(await readFile(`${base}/readmission-allowlist.json`, 'utf8'));
const { patches } = JSON.parse(await readFile(`${base}/draft-patches.json`, 'utf8'));

Deno.test('no patch readmits a string the curriculum treats as wrong, beyond the declared list', () => {
  const found = findReadmissions();
  const declared = [...allowed.readmissions].sort();

  const appeared = found.filter(x => !declared.includes(x));
  const closed = declared.filter(x => !found.includes(x));
  assert.deepEqual(appeared, [], `new readmissions — a correct addition made a wrong answer right:\n${appeared.join('\n')}`);
  assert.deepEqual(closed, [], `these readmissions are fixed; delete them from readmission-allowlist.json:\n${closed.join('\n')}`);
});

Deno.test('the allowlist says what each entry is and stays honest about the total', () => {
  assert.equal(allowed.readmissions.length, allowed.count);
  assert.equal(new Set(allowed.readmissions).size, allowed.readmissions.length);
  assert.ok(allowed.mechanism && allowed.why_not_fixed_in_the_grader);
  // Every entry must name a real patched row, so the list cannot accumulate
  // strings that no longer correspond to anything in the draft.
  const patched = new Set(patches.filter(p => p.table === 'exercises').map(p => p.id));
  for (const entry of allowed.readmissions) {
    const [, id] = entry.split('|');
    assert.ok(patched.has(id), `allowlist entry names an unpatched row: ${entry}`);
  }
});
