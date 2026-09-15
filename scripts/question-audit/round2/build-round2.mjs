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
import { productRulings, frenchCheckpointParaphrase, registerRemovals } from './product-rulings.mjs';
import { createAcceptedAnswerLedger } from './accepted-answer-ledger.mjs';
import { restoredWithdrawals } from './restored-withdrawals.mjs';
import { sameGlossLevelling } from './same-gloss-levelling.mjs';
import { alternativesAxisRemainder } from './alternatives-axis-remainder.mjs';

const set = await createRound2PatchSet();
// Four blocks reach `accepted_answers` and five rows fall to more than one of
// them, so they all contribute to one ledger and it writes each row once.
const ledger = createAcceptedAnswerLedger();
const counts = {
  film_theater_rows: filmTheaterFixes(set),
  retitled_lessons: idiomaticEquivalentsRetitle(set),
  productive_paradigms: productiveParadigmFixes(set),
  // The accepted-answer blocks contribute, then the ledger writes each row
  // once. A row one of them shares with the paradigm class carries both edits
  // as one patch: the addition lands on the exact-match path, which runs before
  // the strict return, so strictness never rejects it.
  triage_accepted_answers: await triageAcceptedAnswers(set, ledger),
  product_rulings: await productRulings(set, ledger),
  restored_withdrawals: await restoredWithdrawals(set, ledger),
  same_gloss_levelling: sameGlossLevelling(set, ledger),
  alternatives_axis_remainder: alternativesAxisRemainder(set, ledger),
  french_checkpoint_paraphrase: frenchCheckpointParaphrase(set),
  // Before the ledger writes, so that a row this touches and an addition block
  // also claims would collide loudly instead of one silently winning.
  register_removals: registerRemovals(set),
};
counts.accepted_answer_rows = ledger.write(set).length;
const patches = set.patches();
const directory = 'docs/audits/question-verification/round2';
await mkdir(directory, { recursive: true });
const draft = JSON.stringify({
  snapshot_sha256: SNAPSHOT_SHA,
  status: 'Draft: independent round-2 review and migration tests required; NOT deployed.',
  round: 2,
  applies_on_top_of: 'the round-1 content patch deployed 2026-09-14',
  ruled_on: '2026-09-15 (Japanese script: accept the reading; register: accept upward, refuse downward; fr-C0024: accept the paraphrase; reading bar: no change)',
  apply_precondition: 'MUST ship in the same release as the grader branch (Japanese edit-distance gate + the kinship confusable pairs). The accepted-answer additions widen typo tolerance without that gate; under strict grading every addition still passes and all 12 collateral acceptances vanish.',
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
