/**
 * Independent review record for `scripts/question-audit/spanish-accepted-alternatives.mjs`.
 *
 * I did not author that batch. This script hard-checks the reviewed source by SHA-256,
 * replays the producer on a FRESH patch set, and writes the exact before/after of every
 * field it touches together with one decision per field. Nothing here edits the batch,
 * the draft, the grader or the confusable list.
 *
 * Every grading claim behind these decisions was re-derived against the grader as it
 * stands today, with the runtime `exerciseHints` that `lib/exercise-restore.ts` builds.
 * Recorded before-values from the author's evidence were not reused: `lib/grading.ts`
 * changed again during this review (a6afa8e9 -> 96519839, tolerance now scaled by the
 * SHORTER of the matched alternative and the key), which closed five of the widenings
 * the author's handoff prose still lists.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { spanishAcceptedAlternatives, spanishAlternativeRows } from './spanish-accepted-alternatives.mjs';

const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const SOURCE = 'scripts/question-audit/spanish-accepted-alternatives.mjs';
const REVIEWED_SHA = 'a84e8fce4b7cd1b5cb954264943775b9dca18818a7d588607a651d54474ce8fd';
const base = 'docs/audits/question-verification/remediation/es-alternatives-root-review';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(SOURCE));
if (sourceSha !== REVIEWED_SHA) throw new Error(`Unreviewed source: ${sourceSha}`);

/**
 * Rows whose values I approve but whose INTEGRATION is blocked on a precondition I
 * verified by simulation. Each entry names the string a learner can now type and be
 * scored correct for, and the exact `lib/confusable-pairs.ts` entry that refuses it.
 * The pairs are keyed on `expectedForTolerance` — the best-matching ACCEPTED answer,
 * not the stored key — because that is the string `gradeAnswer` hands to
 * `isConfusablePair`. The author's proposed key-keyed pairs do not fire; these do.
 */
const PENDING = new Map([
  [1138, { admits: ['No estoy de acuerdo'], pair: ['no estoy de acuerdo', 'yo estoy de acuerdo'], why: 'Polarity flip. "No estoy de acuerdo" is the OPPOSITE proposition and is the stored key of es-E1152; a learner who types it is scored Correct! (Minor typo). The most serious class in this batch.' }],
  [1152, { admits: ['No no estoy de acuerdo'], pair: ['no no estoy de acuerdo', 'yo no estoy de acuerdo'], why: 'Degenerate double negation admitted by the optional-yo addition. Not a meaning flip, but the same mechanism and free to close.' }],
  [1166, { admits: ['No creo que'], pair: ['no creo que', 'yo creo que'], why: 'Polarity flip: "No creo que" is the opposite of the keyed "Creo que".' }],
  [1684, { admits: ['No desearía'], pair: ['no desearía', 'yo desearía'], why: 'Polarity flip: "No desearía" is the opposite of the keyed "Desearía".' }],
  [1601, { admits: ['Water'], pair: ['later', 'water'], why: 'The addition "Later" brings the taught key "Water" (Agua, es-E0137) inside the budget, so Luego is scored correct as "Water".' }],
  [1978, { admits: ['Preposición', 'Preposition'], pair: ['proposición', 'preposición'], pair2: ['preposition', 'proposición'], why: 'The addition "Proposición" admits the separately taught word Preposición/Preposition (es-E2283, es-E2284) as an answer for Propuesta.' }],
  [2133, { admits: ['Head'], pair: ['lead', 'head'], why: 'The addition "Lead" brings the taught key "Head" (Cabeza, es-E0557) inside the budget on Protagonista.' }],
]);

/**
 * Rows carrying a widening I verified, disclosed and accept: no meaning is inverted and
 * no taught contrast is credited. Four are the prompt's own cue readmitted through a
 * cognate; four are `fill_blank` suffix fragments of unrelated rows; one is a Spanish
 * word admitted on a translate-to-English row.
 */
const DEPENDENCY = new Map([
  [1265, 'Admits the Spanish taught key "Iré" on a translate-to-English row. A wrong-language answer, not a wrong meaning in English.'],
  [1334, "Admits the prompt's own cue \"Reservation\". gradeAnswer should never accept an answer equal to the cue; that is a grader rule, not a reason to refuse the correct regional variant Reservación."],
  [1364, 'Admits the fragment "ario" (the key of es-E1238, Sal_____). A suffix fragment of another blank, not an answer a learner composes.'],
  [1390, "Admits the prompt's own cue \"Pollution\". Same grader rule as es-E1334."],
  [1530, 'Admits the fragment "argar" (the key of es-E1490, Desc_____).'],
  [1783, "Admits the prompt's own cue \"Increíble\". Same grader rule as es-E1334."],
  [1993, "Admits the prompt's own cue \"Implementar\". Same grader rule as es-E1334."],
  [2048, 'Admits the fragment "teresada" (the key of es-E2022, Parte in_____).'],
  [2049, 'Admits the fragment "diaré" (the key of es-E0936, Estu_____).'],
]);

/** Reservations recorded against values I nonetheless approve. */
const RESERVATIONS = new Map([
  [1281, '"Gerenta" is the weakest of the three gender pairs: gerente is common in gender and gerenta is regional. Attested, so approved, but it is the value most likely to be reversed on a stricter reading.'],
  [1755, '"Something like that" is a distractor on es-E1762, but that row asks about a DIFFERENT stimulus ("Informal"), so the course draws no contrast between it and "Algo así". Unlike the refused "Then" on es-E1601, which is a distractor on a row built on the very same stimulus. Approved; recorded because the handoff calls es-E1601 the only sibling-distractor fact in the batch and this one is not mentioned.'],
  [1799, '"Bacano" carries no dictionary line of its own; it is ordinary Colombian for "cool" and is approved on usage, not citation.'],
  [2048, '"Interesado"/"Interesada" is a thinner gloss of Stakeholder than the keyed "Parte interesada". Defensible in administrative and corporate Spanish; the weakest lexical value in the batch.'],
  [2203, 'Approved, and it is the one row where this batch still contradicts the landed German work: de-E2203 refuses "To tease someone" on the mirror row while this accepts it. German itself accepts a plain gloss in the same direction on de-E2161 and de-E2217, so the contradiction is German-internal and the fix belongs there, not here.'],
]);

const set = await createPatchSet();
spanishAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'es');
const patches = new Map(set.patches().map(p => [p.id, p]));
if (patches.size !== 137) throw new Error(`Expected 137 patches, got ${patches.size}`);

const rows = [], fields = [];
let additions = 0;
for (const [n, type, lessonTitle, key, current, rowAdditions, grounds, sources = []] of spanishAlternativeRows) {
  const { exercise: e, lesson, unit, course, ref } = get(n);
  const patch = patches.get(e.id);
  if (!patch) throw new Error(`${ref}: producer emitted no patch`);
  if (Object.keys(patch.after).length !== 1 || !('accepted_answers' in patch.after)) throw new Error(`${ref}: touches a field other than accepted_answers`);
  additions += rowAdditions.length;

  const pending = PENDING.get(n), dependency = DEPENDENCY.get(n), reservation = RESERVATIONS.get(n);
  const decision = pending ? 'approve_pending_grader_precondition'
    : dependency ? 'approve_with_known_dependency'
    : 'approve_as_correction';
  const rationale = pending
    ? `${pending.why} Verified by simulation: adding ${JSON.stringify(pending.pair)}${pending.pair2 ? ` and ${JSON.stringify(pending.pair2)}` : ''} to lib/confusable-pairs.ts refuses it and leaves all 273 additions and every stored key returning exactly "Correct!". Values approved; integration blocked until that pair lands or a grader-level negation guard replaces it.`
    : dependency ? `${dependency} Values approved; the widening is recorded, not repaired here.`
    : `Every addition is a correct answer to this exact prompt, re-read against the frozen row at ${course.cefr_level} ${unit.title} > ${lessonTitle}. Licensed by: ${grounds.join('; ')}.`;

  rows.push({ ref, id: e.id, number: n, band: course.cefr_level, unit: unit.title, lesson: lesson.title, type,
    prompt: e.prompt, key, before_accepted_answers: e.accepted_answers ?? [], additions: rowAdditions,
    after_accepted_answers: patch.after.accepted_answers, grounds, sources, decision,
    ...(pending ? { admits: pending.admits, required_pairs: [pending.pair, ...(pending.pair2 ? [pending.pair2] : [])] } : {}),
    ...(reservation ? { reservation } : {}) });

  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id,
    field: 'accepted_answers', before: patch.before.accepted_answers, after: patch.after.accepted_answers,
    decision, rationale, grounds, source_sha256: sourceSha,
    ...(pending ? { required_pairs: [pending.pair, ...(pending.pair2 ? [pending.pair2] : [])], admits: pending.admits } : {}),
    ...(reservation ? { reservation } : {}),
    ...(sources.length ? { sources } : {}) });
}
if (additions !== 273) throw new Error(`Expected 273 additions, got ${additions}`);

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source: SOURCE, source_sha256: sourceSha, reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  grading_sha256: sha(await readFile('lib/grading.ts')),
  confusable_pairs_sha256: sha(await readFile('lib/confusable-pairs.ts')),
  rows_reviewed: rows.length, alternatives_reviewed: additions,
  decisions: rows.reduce((acc, r) => ({ ...acc, [r.decision]: (acc[r.decision] ?? 0) + 1 }), {}),
  rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw error; }
await writeFile(`${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');

console.log(JSON.stringify({
  rows: rows.length, alternatives: additions,
  decisions: rows.reduce((acc, r) => ({ ...acc, [r.decision]: (acc[r.decision] ?? 0) + 1 }), {}),
  pending: rows.filter(r => r.decision === 'approve_pending_grader_precondition').map(r => r.ref),
}, null, 2));

/* ------------------------------------------------------------------------ *
 * Follow-up, 2026-09-14. The precondition named above was met: the eight
 * pairs are in `lib/confusable-pairs.ts`. Re-derived here against the files
 * as they now stand rather than taken on report — the pair list has changed
 * three times today (822c49f3 -> b1789d3b -> 3ee6754d).
 * ------------------------------------------------------------------------ */
{
  const { gradeAnswer } = await import('../../lib/grading.ts');
  const hintsFor = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'es' } });
  const grade = (a, k, acc, e) => { const r = gradeAnswer(a, k, acc, hintsFor(e)); return { ok: r.isCorrect, exact: r.isCorrect && String(r.feedback ?? '') === 'Correct!' }; };

  /** Each conditioned row, and the string it used to admit. */
  const CLEARED = new Map([
    [1138, ['No estoy de acuerdo']], [1152, ['No no estoy de acuerdo']], [1166, ['No creo que']],
    [1684, ['No desearía']], [1601, ['Water']], [1978, ['Preposición', 'Preposition']], [2133, ['Head']],
  ]);
  /** Rows whose remaining readmission is declared in the allowlist, and those it does not reach. */
  const READMISSION = new Map([
    [1265, ['Iré', false]], [1334, ['Reservation', true]], [1364, ['ario', false]], [1390, ['Pollution', true]],
    [1530, ['argar', true]], [1783, ['Increíble', true]], [1993, ['Implementar', true]],
    [2048, ['teresada', true]], [2049, ['diaré', false]], [2133, ['ldad', false]],
  ]);

  const followup = [];
  // Re-assert the whole batch still grades as approved, not just the seven rows.
  let stillExact = 0;
  for (const [n, , , key, current, rowAdditions] of spanishAlternativeRows) {
    const { exercise: e } = get(n);
    const after = patches.get(e.id).after.accepted_answers;
    for (const a of [key, ...current, ...rowAdditions]) {
      if (!grade(a, key, after, e).exact) throw new Error(`${get(n).ref}: "${a}" no longer returns exactly "Correct!"`);
      stillExact++;
    }
  }
  if (stillExact !== 410) throw new Error(`Expected 410 exact acceptances (273 additions + 137 keys), got ${stillExact}`);

  for (const [n, admitted] of CLEARED) {
    const { exercise: e, ref } = get(n);
    const patch = patches.get(e.id);
    const after = patch.after.accepted_answers;
    const stillAdmits = admitted.filter(s => grade(s, e.correct_answer, after, e).ok);
    if (stillAdmits.length) throw new Error(`${ref}: precondition NOT met, still admits ${stillAdmits.join(', ')}`);
    const [leftover, declared] = READMISSION.get(n) ?? [];
    followup.push({
      reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
      before: patch.before.accepted_answers, after: patch.after.accepted_answers,
      decision: 'approve_as_correction', supersedes: 'approve_pending_grader_precondition',
      precondition_met: true,
      rationale: `Re-derived against lib/grading.ts 96519839 and lib/confusable-pairs.ts 3ee6754d: ${admitted.map(s => JSON.stringify(s)).join(' and ')} ${admitted.length > 1 ? 'are' : 'is'} now refused on this row, and all 273 additions and all 137 stored keys across the batch still return exactly "Correct!". The condition I set is satisfied; this field is approved without reservation.`,
      ...(leftover ? { residual_readmission: leftover, declared_in_readmission_allowlist: declared } : {}),
      source_sha256: sourceSha,
    });
  }

  /**
   * The nine rows I approved with a known dependency, re-checked against the
   * integration owner's allowlist rather than assumed. All nine still readmit
   * their string. Six are declared; three are not, and neither is the residual
   * fragment on es-E2133. The split is not an oversight — it follows exactly
   * from the allowlist's own stated scope, which checks a patched row against
   * the keys of its siblings in the SAME unit. The four undeclared strings are
   * all taught in a different unit.
   */
  for (const [n, [string, declared]] of READMISSION) {
    if (CLEARED.has(n)) continue;
    const { exercise: e, ref } = get(n);
    const patch = patches.get(e.id);
    followup.push({
      reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
      before: patch.before.accepted_answers, after: patch.after.accepted_answers,
      decision: 'approve_with_known_dependency', precondition_met: null,
      residual_readmission: string, declared_in_readmission_allowlist: declared,
      recommend_confusable_pair: false,
      rationale: declared
        ? `Still readmits ${JSON.stringify(string)} and is declared in readmission-allowlist.json. A confusable pair is the WRONG instrument here and I do not recommend one: the list means "two distinct words a learner must not conflate", and ${JSON.stringify(string)} is either the prompt's own cue (the learner echoed the question) or a bare suffix fragment that is not a word. Declaring it is right. The grader-side remedy for the cue class is a rule that no answer equal to the prompt's cue is ever accepted.`
        : `Still readmits ${JSON.stringify(string)} and is NOT declared: the allowlist's stated scope checks a patched row against its siblings in the same unit, and ${JSON.stringify(string)} is taught in a different unit. Consistent with the allowlist's own rule, so not an oversight — but the standing guard will not notice if this one changes. Lowest-severity class in the batch: no meaning is inverted. No pair recommended, for the same reason as the declared entries.`,
      source_sha256: sourceSha,
    });
  }

  await writeFile(`${base}/followup-field-decisions.jsonl`,
    followup.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
  console.log(JSON.stringify({
    followup_fields: followup.length,
    cleared: [...CLEARED.keys()].map(n => get(n).ref),
    exact_acceptances_reasserted: stillExact,
    residual_readmissions_undeclared: followup.filter(f => f.declared_in_readmission_allowlist === false).map(f => `${f.ref}|${f.residual_readmission}`),
  }, null, 2));
}
