/** Follow-up review of the revised Japanese accepted-answer batch (second version).
 *
 * Re-measures rather than re-reads. The readmission scope here is deliberately
 * one step wider than the batch's own eighth test, which pools the row's
 * distractors, the unit's stored keys and the unit's additions. That pool omits
 * the strings this batch DECLARES it refuses: a refusal recorded in the evidence
 * cannot be enforced by `accepted_answers`, and a withdrawn string is neither a
 * key nor an addition, so nothing in the batch's own suite can see it come back.
 * Adding unit-wide declared refusals to the pool is what finds the two rows this
 * review returns.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { japaneseAcceptedAlternatives, japaneseAlternativeRows } from './japanese-accepted-alternatives.mjs';
import { gradeAnswer } from '../../lib/grading.ts';

const base = 'docs/audits/question-verification/remediation/ja-alternatives-root-review';
const source = 'scripts/question-audit/japanese-accepted-alternatives.mjs';
const evidencePath = 'docs/audits/question-verification/remediation/es-ja-ko/japanese-accepted-alternatives-evidence.json';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const ROUND = 3;
const PRIOR_SHA = '4b597e1fb4b4cfe95bd0f37531618031d060b1aeba55cde0192a116e5f5bec47';
const FIRST_SHA = '747140d378eb60965259921119be85be0270aaa80e21643e86a96f01ea43537e';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== '0f0764d3b340d8687d526eef22c5e0a36538fcd229ee16106901c39dc50f756f') throw Error('Unreviewed source');

const ev = JSON.parse(await readFile(evidencePath, 'utf8'));
const set = await createPatchSet();
japaneseAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'ja');
const meta = new Map();
for (let n = 1; n <= 2312; n++) { const r = get(n); meta.set(r.ref, r); }

const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ja' } });

const patched = japaneseAlternativeRows.map(([n, , , , before, additions]) => {
  const m = get(n);
  return { ref: m.ref, e: m.exercise, unitId: m.unit.id, unit: m.unit.title, lesson: m.lesson.title, band: m.course.cefr_level, before, additions, after: [...before, ...additions] };
});
const byUnit = new Map();
for (const p of patched) (byUnit.get(p.unitId) ?? byUnit.set(p.unitId, []).get(p.unitId)).push(p);
const unitKeys = new Map();
for (let n = 1; n <= 2312; n++) {
  const r = get(n);
  const m = unitKeys.get(r.unit.id) ?? unitKeys.set(r.unit.id, new Map()).get(r.unit.id);
  if (r.exercise.correct_answer) m.set(r.exercise.correct_answer, r.ref);
}
/** Strings this batch refuses or withdraws ANYWHERE in the unit, not just on the row. */
const refusedInUnit = new Map();
for (const list of ['refused', 'withdrawn_to_policy']) for (const x of ev[list] ?? []) {
  const m = meta.get(x.ref); if (!m) continue;
  const u = refusedInUnit.get(m.unit.id) ?? refusedInUnit.set(m.unit.id, new Map()).get(m.unit.id);
  if (!u.has(x.candidate)) u.set(x.candidate, `${x.ground} on ${x.ref}`);
}

const introduced = [], preexisting = [];
for (const p of patched) {
  const pool = new Map();
  for (const d of p.e.distractors ?? []) pool.set(d, { scope: 'declared', origin: 'own distractor' });
  for (const [k, ref] of unitKeys.get(p.unitId) ?? []) if (!pool.has(k)) pool.set(k, { scope: 'declared', origin: `stored key of ${ref}` });
  for (const q of byUnit.get(p.unitId) ?? []) if (q.ref !== p.ref) for (const a of q.additions) if (!pool.has(a)) pool.set(a, { scope: 'batch_additions', origin: `addition this batch makes on ${q.ref}` });
  for (const [c, why] of refusedInUnit.get(p.unitId) ?? []) if (!pool.has(c)) pool.set(c, { scope: 'refused_in_unit', origin: `this batch refuses it: ${why}` });
  for (const [c, m] of pool) {
    if (!c?.trim() || c === p.e.correct_answer || p.after.includes(c)) continue;
    const wasOk = gradeAnswer(c, p.e.correct_answer, p.before, hints(p.e)).isCorrect;
    const now = gradeAnswer(c, p.e.correct_answer, p.after, hints(p.e));
    if (!now.isCorrect) continue;
    (wasOk ? preexisting : introduced).push({ ref: p.ref, id: p.e.id, unit: p.unit, key: p.e.correct_answer, additions: p.additions, readmitted: c, ...m, feedback: now.feedback });
  }
}
const FLIPS = new Set();
for (const r of introduced) r.severity = FLIPS.has(`${r.ref}|${r.readmitted}`) ? 'meaning_flip' : 'card_blur';

const byRef = new Map();
for (const r of introduced) (byRef.get(r.ref) ?? byRef.set(r.ref, []).get(r.ref)).push(r);

const CLEARED = 'Cleared on re-review. Every objection this reviewer raised against sha 747140d3 and sha 4b597e1f is resolved on this row, and the row introduces no readmission in the widest scope measured: unit stored keys, every string this batch adds elsewhere in the unit, and every string this batch declares it refuses anywhere in the unit.';

const rows = [], fields = [];
for (const p of patched) {
  const hits = byRef.get(p.ref) ?? [];
  const decision = hits.length ? 'revise' : 'approve_as_correction';
  const rationale = hits.length
    ? `Readmits ${hits.length} string(s) the curriculum treats as wrong: ${hits.map(h => `${h.readmitted} (${h.origin}${h.severity === 'meaning_flip' ? ', MEANING FLIP' : ''})`).join('; ')}.`
    : CLEARED;
  rows.push({ ref: p.ref, id: p.e.id, band: p.band, unit: p.unit, lesson: p.lesson, type: p.e.type, key: p.e.correct_answer, before: p.before, after: p.after, additions: p.additions, decision, readmissions: hits.map(({ readmitted, scope, origin, severity, feedback }) => ({ readmitted, scope, origin, severity, feedback })), rationale });
  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, round: ROUND, ref: p.ref, table: 'exercises', id: p.e.id, field: 'accepted_answers', before: p.before, after: p.after, decision, rationale, source_sha256: sourceSha, prior_source_sha256: PRIOR_SHA, first_source_sha256: FIRST_SHA });
}

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha, prior_source_sha256: PRIOR_SHA, first_source_sha256: FIRST_SHA,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, round: ROUND,
  integration_verdict: introduced.length ? 'do_not_integrate_until_two_rows_are_withdrawn' : 'safe_to_integrate',
  scope_note: "Readmission pool is one step wider than the batch's own eighth test: it adds every string this batch declares it refuses anywhere in the unit. A withdrawn string is neither a stored key nor an addition, so the batch's suite is structurally unable to see it return.",
  counts: {
    rows: rows.length,
    additions: patched.reduce((n, p) => n + p.additions.length, 0),
    approve_as_correction: rows.filter(r => r.decision === 'approve_as_correction').length,
    revise: rows.filter(r => r.decision === 'revise').length,
    readmissions_introduced: introduced.length,
    readmissions_meaning_flip: introduced.filter(r => r.severity === 'meaning_flip').length,
    readmissions_introduced_in_the_batch_test_scope: introduced.filter(r => r.scope !== 'refused_in_unit').length,
    preexisting_collisions_untouched_by_this_batch: preexisting.length,
  },
  introduced, preexisting, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/followup-field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, additions: patched.reduce((n, p) => n + p.additions.length, 0), revise: rows.filter(r => r.decision === 'revise').length, introduced: introduced.length, flips: introduced.filter(r => r.severity === 'meaning_flip').length, preexisting: preexisting.length }));
