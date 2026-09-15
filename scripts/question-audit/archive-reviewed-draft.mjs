import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'docs/audits/question-verification/remediation';
const raw = await readFile(`${directory}/draft-patches.json`);
const hash = createHash('sha256').update(raw).digest('hex');
if (hash !== '4af708bccf879b758e4d2b445760a33ebe25829b014935df25afdab735a807f7') throw new Error('Expected the independently inspected first draft');
async function freeze(path, data) {
  try { await writeFile(path, data, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST' || !(await readFile(path)).equals(data)) throw error;
  }
}
await freeze(`${directory}/reviewed-draft-${hash.slice(0, 12)}.json`, raw);
await freeze(`${directory}/nonlesson-review/runtime-at-review.json`, await readFile('docs/audits/question-verification/runtime-current.json'));
console.log(JSON.stringify({ frozen_draft_sha256: hash, status: 'Historical review inputs preserved; no database action.' }));
