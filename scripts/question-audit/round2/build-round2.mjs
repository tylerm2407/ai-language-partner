/**
 * Compile the round-2 content patch. Writes a draft; deploys nothing.
 *
 * Round one is applied, so this build is pinned to the CURRENT snapshot
 * (9a20145dc6b5…) and its output is a second, independent patch set that sits on
 * top of what already shipped. `scripts/question-audit/build-remediation.mjs`
 * and every producer it calls are untouched.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRound2PatchSet, renderPatchSql, SNAPSHOT_SHA } from './patch-set-round2.mjs';
import { filmTheaterFixes } from './film-theater-fixes.mjs';
import { idiomaticEquivalentsRetitle } from './idiomatic-equivalents-retitle.mjs';
import { productiveParadigmFixes } from './productive-paradigm-fixes.mjs';
import { triageAcceptedAnswers } from './triage-accepted-answers.mjs';

const set = await createRound2PatchSet();
const counts = {
  film_theater_rows: filmTheaterFixes(set),
  retitled_lessons: idiomaticEquivalentsRetitle(set),
  productive_paradigms: productiveParadigmFixes(set),
  // Last, so that a row this block shares with the paradigm class carries both
  // edits as one patch: the addition lands on the exact-match path, which runs
  // before the strict return, so strictness never rejects it.
  triage_accepted_answers: await triageAcceptedAnswers(set),
};
const patches = set.patches();
const directory = 'docs/audits/question-verification/round2';
await mkdir(directory, { recursive: true });
const draft = JSON.stringify({
  snapshot_sha256: SNAPSHOT_SHA,
  status: 'Draft: independent round-2 review and migration tests required; NOT deployed.',
  round: 2,
  applies_on_top_of: 'the round-1 content patch deployed 2026-09-14',
  apply_precondition: 'MUST ship in the same release as the grader branch (Japanese edit-distance gate + the kinship confusable pairs). The 313 accepted-answer additions widen typo tolerance on 88 rows without that gate; under strict grading all 313 still pass and all 12 collateral acceptances vanish.',
  patches,
}, null, 2) + '\n';
await writeFile(`${directory}/draft-patches.json`, draft);
const sql = renderPatchSql(patches);
await writeFile(`${directory}/draft.sql`, sql);
console.log(JSON.stringify({
  ...counts,
  draft_rows: patches.length,
  changed_fields: patches.reduce((total, patch) => total + Object.keys(patch.after).length, 0),
  per_table: patches.reduce((acc, p) => ({ ...acc, [p.table]: (acc[p.table] ?? 0) + 1 }), {}),
  draft_sha256: createHash('sha256').update(draft).digest('hex'),
  sql_sha256: createHash('sha256').update(sql).digest('hex'),
  deployed: false,
}, null, 1));
