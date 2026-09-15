/**
 * Follow-up review of the one held-boundary field revised after
 * held-boundary-root-review (2026-09-14).
 *
 * Covers ja-E0312.accepted_answers only. The original 108-field record in
 * field-decisions.jsonl is not rewritten; this adds a second, narrower record.
 * A drift check re-derives every one of the 30 rows from the new source and
 * fails if anything outside the reviewed field moved.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { heldBoundaryFixes, heldBoundaryRepairs } from './es-ja-ko-held-boundary-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/held-boundary-root-review';
const source = 'scripts/question-audit/es-ja-ko-held-boundary-fixes.mjs';
const PRIOR_SOURCE_SHA = 'fdcbc6b0c7a9b10a911b29cc8b71b911537b6fee51ecf3d4596056d1449386ae';
const NEW_SOURCE_SHA = '5cf81801c9ba0f0e9ad070b0fd7ab4a7b0bd17c549c15ef3f28a3e14f7f012d1';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
if (sourceSha !== NEW_SOURCE_SHA) throw Error(`Unreviewed source: ${sourceSha}`);

const set = await createPatchSet();
heldBoundaryFixes(set);

const idmap = new Map();
for (const p of heldBoundaryRepairs) {
  const c = lessonRefs(set.snapshot, p.language)(p.n);
  idmap.set(c.exercise.id, { ref: c.ref, full: c });
}

/** Everything the prior review approved must still be emitted byte-identically. */
const prior = new Map(
  JSON.parse(await readFile(`${base}/reviewed-source-${PRIOR_SOURCE_SHA.slice(0, 12)}.json`, 'utf8')).rows.map(r => [r.ref, r.after])
);
const REVISED = new Set(['ja-E0312.accepted_answers']);
const patches = set.patches();
if (patches.length !== 30) throw Error(`Expected thirty rows, got ${patches.length}`);
const drift = [];
for (const patch of patches) {
  const { ref } = idmap.get(patch.id);
  const before = prior.get(ref);
  for (const field of new Set([...Object.keys(before), ...Object.keys(patch.after)])) {
    if (!eq(before[field], patch.after[field]) && !REVISED.has(`${ref}.${field}`)) drift.push(`${ref}.${field}`);
  }
}
if (drift.length) throw Error(`Fields moved outside the revised set: ${drift.join(', ')}`);

const DECISIONS = [{
  ref: 'ja-E0312',
  field: 'accepted_answers',
  decision: 'approve_as_correction',
  rationale:
    'Applied exactly as recommended. accepted_answers is now equal to the frozen [], so the field is no longer emitted as a patch at all and the row keys スポーツ alone. Confirmed against the real gradeAnswer on the new source: スポーツ is accepted, 運動 and うんどう are both rejected. The cross-level contradiction is resolved — the curriculum keys 運動 as Exercise in the JA A2 course and no longer credits it as Sport at A1. The author independently reconfirmed the five A2 rows and card aabbccdd-6666-2002-c012-a20000000000, and additionally established that スポーツ appears on no card, which removes the only remaining way the narrowing could have orphaned a review item. The prompt and key were approved in the original review and are unchanged; the drift check above confirms the other 107 approved fields are byte-identical.',
  sources: [
    'frozen snapshot 8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f: ja A2 Health & Wellness card aabbccdd-6666-2002-c012-a20000000000 運動 = Exercise',
    'lib/grading.ts gradeAnswer, re-run on the new source',
  ],
}];

const rows = DECISIONS.map(d => {
  const entry = [...idmap.entries()].find(([, v]) => v.ref === d.ref);
  if (!entry) throw Error(`Unknown ref ${d.ref}`);
  const [id, { full }] = entry;
  const patch = patches.find(p => p.id === id);
  const frozen = set.row('exercises', id)[d.field];
  const emitted = Object.hasOwn(patch.after, d.field);
  return {
    ...d,
    table: 'exercises',
    id,
    language: full.course.target_language,
    lesson: full.lesson.title,
    reviewed_previously_as: prior.get(d.ref)[d.field],
    now_emitted: emitted,
    after: emitted ? patch.after[d.field] : frozen,
    frozen_value: frozen,
  };
});

const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, follow_up_to: `reviewed-source-${PRIOR_SOURCE_SHA.slice(0, 12)}.json`,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  source, source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
  scope: 'Only the fields revised after the original review. All other approved fields re-derived and confirmed byte-identical.',
  rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
const evidenceSha = sha(body);

// Same rule as the phrasal-verb follow-up: `before` is what the emitted patch
// actually replaces (the frozen row value), so the ledger can match on the exact
// (before, after) pair. This review withdrew accepted_answers back to its frozen
// value, so no patch is emitted for it and there is nothing to replace; the
// prior proposal stays as `before` and is also kept in `superseded_proposal`
// whenever the two differ.
const lines = rows.map(r => {
  const before = r.now_emitted ? r.frozen_value : r.reviewed_previously_as;
  return JSON.stringify({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref: r.ref, table: r.table, id: r.id, field: r.field,
    before, after: r.after,
    ...(eq(before, r.reviewed_previously_as) ? {} : { superseded_proposal: r.reviewed_previously_as }),
    decision: r.decision, rationale: r.rationale,
    source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
    evidence: archive, evidence_sha256: evidenceSha, sources: r.sources, now_emitted: r.now_emitted,
  });
});
await writeFile(`${base}/followup-field-decisions.jsonl`, lines.join('\n') + '\n');

console.log(JSON.stringify({
  rows_rederived: patches.length, drift_outside_revised_fields: drift.length,
  followup_fields: lines.length,
  tally: rows.reduce((a, r) => ({ ...a, [r.decision]: (a[r.decision] ?? 0) + 1 }), {}),
  not_approved: rows.filter(r => r.decision !== 'approve_as_correction').map(r => `${r.ref}.${r.field}`),
}));
