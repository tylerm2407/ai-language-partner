/** Independent review record — Italian cross-row consistency.
 *
 * Reviews `scripts/question-audit/italian-cross-row-fixes.mjs`: 21 fields on 21 rows,
 * `accepted_answers` on 20 and `prompt` on one. The reviewer did not author the batch and
 * did not raise the findings it answers.
 *
 * Every before-value is RE-DERIVED here against the grader as it stands, with the runtime
 * `exerciseHints` from `lib/exercise-restore.ts`, rather than transcribed from the author's
 * evidence file. An authored acceptance is feedback exactly "Correct!"; anything else is a
 * tolerance pass and is recorded as such. The source SHA is pinned, so this script throws
 * rather than emitting a review against a file that has moved.
 *
 * Read-only apart from the three files under `it-cross-row-root-review/`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
import { refusalRegressions } from './refusal-guard.mjs';
import { italianCrossRowFixes, italianCrossRowGroups, selectItalianAlternativesBeforeCrossRow } from './italian-cross-row-fixes.mjs';
import { italianAcceptedAlternatives } from './italian-accepted-alternatives.mjs';
import { italianOptionCollisionFixes } from './italian-option-collision-fixes.mjs';

const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch and did not raise the findings it answers';
const REVIEWED_ON = '2026-09-14';
const SOURCE = 'scripts/question-audit/italian-cross-row-fixes.mjs';
const PINNED = '8c088e49f27e1653e7df80ef24c738b904f7f5dd8781ea266469459a336eddff';
const BASE = 'docs/audits/question-verification/remediation/it-cross-row-root-review';
const DRAFT = 'docs/audits/question-verification/remediation/draft-patches.json';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(SOURCE));
if (sourceSha !== PINNED) throw new Error(`Unreviewed source: ${SOURCE} is ${sourceSha}, review pinned ${PINNED}`);

/** The exact hint shape the runner builds, so the grade is what a learner meets. */
const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'it' } });
/** Authored acceptance is "Correct!" and nothing else. A tolerance pass is not acceptance. */
const classify = r => (!r.isCorrect ? 'rejected' : r.feedback === 'Correct!' ? 'authored' : 'tolerance');

const set = await createPatchSet();
italianCrossRowFixes(set);
const get = lessonRefs(set.snapshot, 'it');
const refById = new Map();
for (let n = 1; n <= 2312; n++) { const f = get(n); refById.set(f.exercise.id, f.ref); }
const { patches: draftPatches } = JSON.parse(await readFile(DRAFT, 'utf8'));
const draft = new Map(draftPatches.filter(p => p.table === 'exercises' && p.op !== 'insert').map(p => [p.id, p.after]));

// ---- the batch must be exactly what it declares -------------------------------------------
const byField = {};
for (const p of set.patches()) {
  if (p.table !== 'exercises') throw new Error(`Out-of-scope table: ${p.table}`);
  for (const f of Object.keys(p.after)) byField[f] = (byField[f] ?? 0) + 1;
}
if (set.patches().length !== 21 || byField.accepted_answers !== 20 || byField.prompt !== 1 || Object.keys(byField).length !== 2) {
  throw new Error(`Batch shape moved: ${JSON.stringify(byField)} over ${set.patches().length} rows`);
}

// ---- readmission: does levelling make a wrong answer right? --------------------------------
// Composed exactly as the handoff prescribes, then compared with the same chain minus this
// batch, so the delta is this batch's and not the approved producers' inheritance.
const chainOf = async withCrossRow => {
  const s = await createPatchSet();
  italianOptionCollisionFixes(s);
  if (withCrossRow) { italianAcceptedAlternatives(selectItalianAlternativesBeforeCrossRow(s)); italianCrossRowFixes(s); }
  else italianAcceptedAlternatives(s);
  return refusalRegressions(s).map(v => `${v.language}|${v.id}|${v.readmitted}`).sort();
};
const withBatch = await chainOf(true), withoutBatch = await chainOf(false);
const introduced = withBatch.filter(x => !withoutBatch.includes(x));
const alone = refusalRegressions(set).map(v => `${v.language}|${v.id}|${v.readmitted}`);
const allowlist = new Set(JSON.parse(await readFile('docs/audits/question-verification/remediation/readmission-allowlist.json', 'utf8')).readmissions);
const inherited = withBatch.filter(x => !allowlist.has(x));

// ---- the composition wrapper must drop nothing the approved producer authored --------------
const approvedAlone = await createPatchSet(); italianAcceptedAlternatives(approvedAlone);
const composed = await createPatchSet();
italianAcceptedAlternatives(selectItalianAlternativesBeforeCrossRow(composed));
italianCrossRowFixes(composed);
const composedAfter = new Map(composed.patches().map(p => [p.id, p.after]));
let identical = 0, superset = 0;
for (const p of approvedAlone.patches()) {
  const c = composedAfter.get(p.id);
  if (!c) throw new Error(`Wrapper dropped an approved row: ${refById.get(p.id) ?? p.id}`);
  for (const [f, v] of Object.entries(p.after)) {
    if (!Object.hasOwn(c, f)) throw new Error(`Wrapper dropped ${refById.get(p.id)}.${f}`);
    if (JSON.stringify(c[f]) === JSON.stringify(v)) { identical++; continue; }
    if (Array.isArray(v) && Array.isArray(c[f]) && v.every(x => c[f].includes(x))) { superset++; continue; }
    throw new Error(`Wrapper changed ${refById.get(p.id)}.${f}`);
  }
}

// ---- per-field decisions -------------------------------------------------------------------
const NOTES = new Map(Object.entries({
  gender: 'The English gloss is not gendered and the bare prompt names no referent, so the counterpart Italian form is equally grammatical. Both rows are the same bare-gloss question in the same unit and band, with no hint, explanation or options to narrow the sense.',
  number: 'The English gloss is unmarked for number and the bare prompt names no quantity, so the number Italian habitually uses for it is equally licensed. Both rows carry the same key, unit and band with nothing narrowing either.',
  pronoun: 'Italian licenses an explicit subject pronoun and nothing in the bare prompt forbids one. The form is passato prossimo, the tense the unit teaches, so the declared passato remoto refusal does not reach it; cloze rows it-E0925, it-E0937 and it-E0949 already accept the pronoun form of the same frame.',
  reflexive: 'Riposarsi is a standard reading of the objectless English infinitive "To rest", and the bare prompt supplies no object to exclude it.',
  person: 'The bare prompt names no addressee, so the other imperative persons of the same verb are equally licensed.',
  citation: 'The bare English gloss is a citation form and the Italian infinitive is the matching citation form of the same verb.',
  lexical: 'An ordinary dictionary equivalent of the stored key, with nothing in the bare prompt narrowing the sense.',
}));

const fields = [], rows = [];
for (const group of italianCrossRowGroups) {
  for (const [n, , , carried, additions] of group.rows) {
    if (!additions.length) continue;
    const { exercise: e, lesson: l, unit: u, course: c, ref } = get(n);
    const patch = set.patches().find(p => p.id === e.id);
    // Before integration the draft holds the declared `carried` on this row; after it, the
    // batch's own union. Accept either and reject anything else, so this record stays
    // byte-identical across integration instead of drifting with the draft.
    const final = [...carried, ...additions];
    const draftValue = (draft.get(e.id) ?? {}).accepted_answers ?? (e.accepted_answers ?? []);
    if (JSON.stringify(draftValue) !== JSON.stringify(carried) && JSON.stringify(draftValue) !== JSON.stringify(final)) {
      throw new Error(`${ref}: the draft holds ${JSON.stringify(draftValue)}, which is neither the declared carried ${JSON.stringify(carried)} nor the composed union ${JSON.stringify(final)}`);
    }
    const liveBefore = { ...e, accepted_answers: carried };
    const liveAfter = { ...liveBefore, ...patch.after };
    const graded = additions.map(a => {
      const before = classify(gradeAnswer(a, liveBefore.correct_answer, liveBefore.accepted_answers ?? [], hints(liveBefore)));
      const after = gradeAnswer(a, liveAfter.correct_answer, liveAfter.accepted_answers, hints(liveAfter));
      if (classify(after) !== 'authored') throw new Error(`${ref}: ${a} is not authored-accepted after the patch (${after.feedback})`);
      if (before === 'authored') throw new Error(`${ref}: ${a} was already authored-accepted before the patch`);
      return { addition: a, before, after: after.feedback };
    });
    for (const v of [liveAfter.correct_answer, ...(liveBefore.accepted_answers ?? [])]) {
      const r = gradeAnswer(v, liveAfter.correct_answer, liveAfter.accepted_answers, hints(liveAfter));
      if (classify(r) !== 'authored') throw new Error(`${ref}: ${v} regressed to ${r.feedback}`);
    }
    const twin = group.rows.find(r => r[0] !== n);
    const rationale = `${group.grounds.map(g => NOTES.get(g)).join(' ')} The identically-keyed ${`it-E${String(twin[0]).padStart(4, '0')}`} puts the same question — same key, same unit, same band, same bare frame — and already accepts ${additions.length > 1 ? 'these forms' : 'this form'}, so leaving the two unequal marks one learner wrong for what the other is marked right for. Levelled on the union; re-derived against the grader, ${graded.map(g => `${JSON.stringify(g.addition)} was ${g.before} before and is "Correct!" after`).join('; ')}.`;
    rows.push({ ref, n, id: e.id, band: c.cefr_level, unit: u.title, lesson: l.title, type: e.type, gloss: group.gloss, key: group.key, prompt: e.prompt, hint_text: e.hint_text ?? null, explanation: e.explanation ?? null, options: e.options ?? null, carried, additions, graded, final: liveAfter.accepted_answers, grounds: group.grounds, sources: group.sources });
    fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers', before: liveBefore.accepted_answers ?? [], after: patch.after.accepted_answers, decision: 'approve_as_correction', rationale, source_sha256: sourceSha, ...(group.sources.length ? { sources: group.sources } : {}) });
  }
}

// the one prompt
{
  const promptPatch = set.patches().find(p => Object.hasOwn(p.after, 'prompt'));
  const ref = refById.get(promptPatch.id);
  const { exercise: e, lesson: l, unit: u, course: c } = get(1008);
  if (ref !== 'it-E1008') throw new Error(`Unexpected prompt row: ${ref}`);
  if (promptPatch.after.prompt !== 'Meno _____ (Cheaper)') throw new Error(`Unexpected corrected prompt: ${promptPatch.after.prompt}`);
  const rationale = 'it-E1008 welds a whole word to the blank: the prompt "Meno_____ (Cheaper)" with key "caro" renders as "Menocaro", which is not Italian. Re-derived independently across all 207 Italian prompts that weld "_____" to the preceding character, this is the only one where both sides are complete words; every other is a suffix completion whose key continues a word fragment, which is the exercise type working correctly. The one-character fix matches the already-approved it-E2190 and it-E2204 and the it-E1546 fix in the option-collision batch. The draft patches this row\'s accepted_answers and not its prompt, so nothing contends.';
  rows.push({ ref, n: 1008, id: e.id, band: c.cefr_level, unit: u.title, lesson: l.title, type: e.type, key: e.correct_answer, prompt: e.prompt, corrected: promptPatch.after.prompt, renders_before: 'Menocaro', renders_after: 'Meno caro' });
  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'prompt', before: e.prompt, after: promptPatch.after.prompt, decision: 'approve_as_correction', rationale, source_sha256: sourceSha });
}

if (fields.length !== 21) throw new Error(`Expected 21 field decisions, built ${fields.length}`);

const evidence = {
  source: SOURCE, source_sha256: sourceSha, snapshot_sha256: SNAPSHOT_SHA,
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  // The draft is read to cross-check each row's live value, but its row count is deliberately
  // not recorded here: it moves with every other producer's batch, and a volatile number in this
  // archive would change the evidence hash on every replay. The follow-up below records the
  // draft state at the moment it mattered.
  draft_read: { path: DRAFT },
  batch_shape: { rows: set.patches().length, fields: byField },
  additions: { total: rows.filter(r => r.additions).reduce((n, r) => n + r.additions.length, 0), rejected_before: rows.flatMap(r => r.graded ?? []).filter(g => g.before === 'rejected').length, tolerance_before: rows.flatMap(r => r.graded ?? []).filter(g => g.before === 'tolerance').length },
  readmission: { chain_with_batch: withBatch, chain_without_batch: withoutBatch, introduced_by_this_batch: introduced, batch_alone: alone, undeclared_in_allowlist: inherited },
  composition: { approved_rows: approvedAlone.patches().length, identical_fields: identical, superset_fields: superset, dropped_fields: 0 },
  rows,
};
await mkdir(BASE, { recursive: true });
const archive = `${BASE}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify(evidence, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (err) { if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err; }
const evidenceSha = sha(body);
await writeFile(`${BASE}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n');

console.log(JSON.stringify({
  source_sha256: sourceSha, fields: fields.length,
  decisions: fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {}),
  readmissions_introduced: introduced.length, readmissions_inherited_undeclared: inherited.length,
  composition: { identical, superset, dropped: 0 },
}, null, 1));

// ---------------------------------------------------------------------------------------------
// Follow-up, 2026-09-14, after integration.
//
// The ledger reported `changed_since_independent_review` on exactly the seven rows the wrapper
// composes. Re-derived against the integrated draft, the cause is NOT the after-value: the
// composed after matches what this review approved byte for byte on all seven. The mismatch is
// entirely in `before`.
//
// The first pass recorded `before` as the value the draft held at review time, which on these
// seven rows already carried `italian-accepted-alternatives.mjs`'s write. A patch set records
// `before` from the FROZEN snapshot instead (`patch.before[field] = original[field]`), and every
// one of the seven is frozen with `accepted_answers: []`. So the ledger matched the pair on a
// `before` this review had stated on the wrong basis. The other fourteen fields are unaffected
// because their frozen and draft values are both `[]`.
//
// These entries restate the same seven approvals on the patch set's own basis: frozen `[]` to
// the composed union, with every member of the final list re-graded from the frozen row rather
// than carried over from the first pass.
{
  const INTEGRATED = JSON.parse(await readFile(DRAFT, 'utf8'));
  const integrated = new Map(INTEGRATED.patches.filter(p => p.table === 'exercises' && p.op !== 'insert').map(p => [p.id, p]));
  const frozenById = new Map();
  for (let n = 1; n <= 2312; n++) { const f = get(n); frozenById.set(f.exercise.id, f.exercise); }

  const composedRows = [];
  for (const group of italianCrossRowGroups) {
    for (const [n, , , carried, additions] of group.rows) {
      if (!carried.length || !additions.length) continue;
      composedRows.push({ n, group, carried, additions });
    }
  }
  if (composedRows.length !== 7) throw new Error(`Expected seven composed rows, found ${composedRows.length}`);

  const followups = [], evidenceRows = [];
  for (const { n, group, carried, additions } of composedRows) {
    const { exercise: e, lesson: l, unit: u, course: c, ref } = get(n);
    const frozen = frozenById.get(e.id);
    const patch = integrated.get(e.id);
    if (!patch) throw new Error(`${ref}: no patch in the integrated draft`);
    const composedValue = [...carried, ...additions];
    if (JSON.stringify(patch.after.accepted_answers) !== JSON.stringify(composedValue)) {
      throw new Error(`${ref}: the integrated draft holds ${JSON.stringify(patch.after.accepted_answers)}, not the composed union ${JSON.stringify(composedValue)} this review approved — do not record, unwind`);
    }
    if ((frozen.accepted_answers ?? []).length) throw new Error(`${ref}: frozen row is not empty`);
    if (JSON.stringify(patch.before.accepted_answers) !== JSON.stringify(frozen.accepted_answers ?? [])) {
      throw new Error(`${ref}: the patch's before is not the frozen value`);
    }
    const after = { ...frozen, ...patch.after };
    const graded = after.accepted_answers.map(v => {
      const before = classify(gradeAnswer(v, frozen.correct_answer, frozen.accepted_answers ?? [], hints(frozen)));
      const now = gradeAnswer(v, after.correct_answer, after.accepted_answers, hints(after));
      if (classify(now) !== 'authored') throw new Error(`${ref}: ${v} is not authored-accepted after integration (${now.feedback})`);
      return { value: v, from_frozen: before, after: now.feedback };
    });
    const key = gradeAnswer(after.correct_answer, after.correct_answer, after.accepted_answers, hints(after));
    if (classify(key) !== 'authored') throw new Error(`${ref}: stored key regressed to ${key.feedback}`);

    const rationale = `Re-recorded on the patch set's own basis after integration. The approved value is unchanged: the integrated draft holds exactly the composed union this review approved, ${JSON.stringify(after.accepted_answers)}, matching byte for byte. Only the before-value is restated — the first pass gave the draft's intermediate value ${JSON.stringify(carried)}, which already carried the suppressed alternatives producer's write, where a patch records the frozen value []. Re-derived from the frozen row against the current grader, every member of the final list is authored-accepted with feedback exactly "Correct!" and the stored key ${JSON.stringify(after.correct_answer)} still passes: ${graded.map(g => `${JSON.stringify(g.value)} was ${g.from_frozen} from frozen`).join('; ')}. The union remains right for the same reason as the first pass: ${`it-E${String(group.rows.find(r => r[0] !== n)[0]).padStart(4, '0')}`} puts the same bare-gloss question with the same key in the same unit and band, with no hint, explanation or options narrowing either row.`;

    evidenceRows.push({ ref, n, id: e.id, band: c.cefr_level, unit: u.title, lesson: l.title, type: e.type, key: after.correct_answer, prompt: after.prompt, frozen_accepted: frozen.accepted_answers ?? [], recorded_before_first_pass: carried, patch_before: patch.before.accepted_answers, patch_after: patch.after.accepted_answers, composed_expected: composedValue, graded });
    followups.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers', before: patch.before.accepted_answers, after: patch.after.accepted_answers, decision: 'approve_as_correction', rationale, supersedes: { before: carried, note: 'same after-value; before restated on the frozen basis the patch set uses' }, source_sha256: sourceSha, ...(group.sources.length ? { sources: group.sources } : {}) });
  }

  const followupEvidence = JSON.stringify({ source: SOURCE, source_sha256: sourceSha, snapshot_sha256: SNAPSHOT_SHA, reviewer: REVIEWER, reviewed_on: REVIEWED_ON, occasion: 'ledger reported changed_since_independent_review on the seven wrapper-composed rows after integration', draft_read: { path: DRAFT, patch_rows: INTEGRATED.patches.length }, finding: 'after-values match the approved composed union on all seven; only the recorded before-value was on the wrong basis', rows: evidenceRows }, null, 2) + '\n';
  const followupArchive = `${BASE}/followup-evidence-${sha(followupEvidence).slice(0, 12)}.json`;
  try { await writeFile(followupArchive, followupEvidence, { flag: 'wx' }); }
  catch (err) { if (err.code !== 'EEXIST' || await readFile(followupArchive, 'utf8') !== followupEvidence) throw err; }
  await writeFile(`${BASE}/followup-field-decisions.jsonl`, followups.map(f => JSON.stringify({ ...f, evidence: followupArchive, evidence_sha256: sha(followupEvidence) })).join('\n') + '\n');
  console.log(JSON.stringify({ followup_fields: followups.length, after_values_changed: 0, before_values_restated: followups.length, archive: followupArchive }, null, 1));
}
