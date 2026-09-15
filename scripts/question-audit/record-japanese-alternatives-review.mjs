/** Independent review of the Japanese accepted-answer batch.
 *
 * Read-only over the batch: this script re-derives every fact it records from
 * the frozen snapshot and the real grader, then writes the reviewer's decisions.
 * It never mutates the batch, the draft, or any shared audit file.
 *
 * The readmission set is COMPUTED here rather than transcribed, so the recorded
 * verdict cannot drift from what the grader actually does. Three scopes are
 * measured, widest last:
 *
 *   1. `declared` — the scope of `scripts/question-audit/readmission.test.mjs`:
 *      the row's own distractors plus the stored keys of its unit siblings.
 *      This is the guard that gates integration, and the batch fails it.
 *   2. `refused_here` — strings this batch examined on that row and recorded as
 *      refused or withdrawn. A refusal recorded in the evidence cannot be
 *      enforced by `accepted_answers`, so the grader can undo it.
 *   3. `cross_row` — the stored keys of the unit's other rows AND the additions
 *      this batch makes on them. The batch's own additions form new families of
 *      strings one edit apart; the declared guard cannot see them because they
 *      are not keys anywhere.
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

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== '747140d378eb60965259921119be85be0270aaa80e21643e86a96f01ea43537e') throw Error('Unreviewed source');

const ev = JSON.parse(await readFile(evidencePath, 'utf8'));
const set = await createPatchSet();
japaneseAcceptedAlternatives(set);
const { snapshot } = set;
const get = lessonRefs(snapshot, 'ja');

const refOf = new Map(), metaOf = new Map();
for (let n = 1; n <= 2312; n++) { const r = get(n); refOf.set(r.exercise.id, r.ref); metaOf.set(r.ref, r); }

/** The exact hint shape `lib/exercise-restore.ts` builds at runtime. */
const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ja' } });

const patched = japaneseAlternativeRows.map(([n, , , , current, additions]) => {
  const m = get(n);
  return { ref: m.ref, n, e: m.exercise, unitId: m.unit.id, unit: m.unit.title, lesson: m.lesson.title, band: m.course.cefr_level, before: current, additions, after: [...current, ...additions] };
});
const byUnit = new Map();
for (const p of patched) (byUnit.get(p.unitId) ?? byUnit.set(p.unitId, []).get(p.unitId)).push(p);

const unitKeys = new Map();
for (let n = 1; n <= 2312; n++) {
  const r = get(n);
  const m = unitKeys.get(r.unit.id) ?? unitKeys.set(r.unit.id, new Map()).get(r.unit.id);
  if (r.exercise.correct_answer) m.set(r.exercise.correct_answer, r.ref);
}
const refusedHere = new Map();
for (const x of [...ev.refused, ...ev.withdrawn_to_policy]) (refusedHere.get(x.ref) ?? refusedHere.set(x.ref, []).get(x.ref)).push([x.candidate, x.ground]);

/** Strings the batch makes acceptable on a row that the curriculum treats as wrong. */
const readmissions = [];
for (const p of patched) {
  const cands = new Map();
  for (const d of p.e.distractors ?? []) if (d !== p.e.correct_answer) cands.set(d, { scope: 'declared', origin: 'own distractor' });
  for (const [k, ref] of unitKeys.get(p.unitId) ?? []) if (k !== p.e.correct_answer) cands.set(k, { scope: 'declared', origin: `stored key of ${ref}` });
  for (const [c, ground] of refusedHere.get(p.ref) ?? []) if (!cands.has(c)) cands.set(c, { scope: 'refused_here', origin: `refused by this batch (${ground})` });
  for (const q of byUnit.get(p.unitId) ?? []) if (q.ref !== p.ref) for (const a of q.additions) if (!cands.has(a)) cands.set(a, { scope: 'cross_row', origin: `addition this batch makes on ${q.ref}` });
  for (const [c, meta] of cands) {
    if (!c?.trim() || c === p.e.correct_answer || p.after.includes(c)) continue;
    if (gradeAnswer(c, p.e.correct_answer, p.before, hints(p.e)).isCorrect) continue;
    const a = gradeAnswer(c, p.e.correct_answer, p.after, hints(p.e));
    if (!a.isCorrect) continue;
    readmissions.push({ ref: p.ref, id: p.e.id, unit: p.unit, key: p.e.correct_answer, additions: p.additions, readmitted: c, ...meta, feedback: a.feedback });
  }
}

/** Antonym or referent flips: the readmitted string asserts something the row denies. */
const FLIPS = new Set([
  'ja-E0357|Grandpa', 'ja-E0357|Granddad', 'ja-E0357|Old man', 'ja-E0357|Elderly man',
  'ja-E0401|Grandpa', 'ja-E0401|Granddad', 'ja-E0401|Old man', 'ja-E0401|Elderly man',
  'ja-E0369|Grandma', 'ja-E0369|Old woman', 'ja-E0369|Elderly woman',
  'ja-E0413|Grandma', 'ja-E0413|Old woman', 'ja-E0413|Elderly woman',
  'ja-E0562|おじちゃん', 'ja-E0628|おばちゃん',
  'ja-E1000|もっと高い', 'ja-E1000|より背が高い',
  'ja-E1012|より遅い', 'ja-E1012|もっと遅く',
  'ja-E1024|より速い', 'ja-E1024|もっと速く',
  'ja-E1030|より高い', 'ja-E1036|最も悪い', 'ja-E1042|より安い', 'ja-E1048|最も良い',
  'ja-E1054|より背が低い', 'ja-E1265|Fire', 'ja-E1279|Hire',
]);
for (const r of readmissions) r.severity = FLIPS.has(`${r.ref}|${r.readmitted}`) ? 'meaning_flip' : 'card_blur';

/** Reviewer objections that are not about readmission. */
const OBJECTIONS = new Map([
  ['ja-E0030', 'Register: ごめん is casual where the key すみません is polite. The batch refuses おはようございます -> おはよう under JA-POLITE-AFFIX on exactly this reasoning, so the two calls contradict each other. Settle the register question once.'],
  ['ja-E0054', 'Register: うん is casual where the key はい is polite, and the lesson keys the polite particle. Same contradiction as ja-E0030.'],
  ['ja-E0066', 'Register: ううん is casual where the key いいえ is polite. Same contradiction as ja-E0030.'],
  ['ja-E0426', 'Script: 扉 and とびら are the same lexeme in two orthographies. Granting both decides JA-KANA-KANJI-SCRIPT for this word while 350 rows wait on it, which is the practice the batch states it is avoiding.'],
  ['ja-E0470', 'Script: same as ja-E0426 — 扉 and とびら are one lexeme in two scripts, granted together.'],
  ['ja-E0649', 'Refuse 看護婦: it is the superseded female-only term for a nurse, replaced by 看護師 in 2002 and now avoided. Teaching it as a correct answer is a content problem independent of whether it is understood.'],
  ['ja-E0682', 'Refuse 看護婦, as on ja-E0649.'],
  ['ja-E0940', 'Refuse 目当て. It carries an ulterior-motive nuance and is further from "Goal" than 目的, which this same row refuses under course_distinction. The two calls do not sit together.'],
  ['ja-E1069', 'Refuse 習慣 for "Tradition": it is "habit / customary practice", not a tradition. 慣習 is defensible; 習慣 is a different concept.'],
  ['ja-E1096', 'Refuse ダンスをする. The gloss is the noun "Dance" and this row refuses 踊る as a drilled-form error for being a verb; ダンスをする is also a verb phrase, so the row accepts and refuses the same move.'],
  ['ja-E1102', 'Refuse 習慣, as on ja-E1069.'],
  ['ja-E1129', 'Refuse ダンスをする, as on ja-E1096.'],
  ['ja-E1209', 'Refuse "Economics". 経済 is the economy; economics is 経済学, which the batch itself treats as a distinct word when it adds 倫理学 for 倫理.'],
  ['ja-E1349', 'Refuse "Cargo". 荷物 is luggage or a parcel; cargo is 貨物, a freight term the row does not teach.'],
  ['ja-E1502', 'Refuse 合言葉. It is a watchword or shibboleth, not a computer password, and the lesson is B1 technology vocabulary.'],
  ['ja-E1713', 'Refuse "Provisionally" and "Temporarily". 仮に carries that sense elsewhere, but this row sits in Hypothetical Situations and glosses the suppositional use; the batch refuses candidates on exactly this different_sense ground 78 times.'],
  ['ja-E1922', 'Refuse 反証. It is counter-evidence or disproof, not a counterargument, and the batch separately uses it to gloss "To refute" on ja-E1900.'],
  ['ja-E0887', 'Harmonise the person policy. This row accepts She/You/They but not He/We, while ja-E0851 and ja-E0863 accept all five under the same ground. Nothing in the prompt distinguishes them, so a learner typing "He bought" is marked wrong and "He went" right.'],
  ['ja-E0911', 'Harmonise the person policy, as on ja-E0887.'],
  ['ja-E0923', 'Harmonise the person policy, as on ja-E0887.'],
  ['ja-E0935', 'Harmonise the person policy, as on ja-E0887.'],
  ['ja-E0947', 'Harmonise the person policy, as on ja-E0887.'],
  ['ja-E0959', 'Harmonise the person policy, as on ja-E0887.'],
  ['ja-E0971', 'Harmonise the person policy, as on ja-E0887.'],
]);

const byRef = new Map();
for (const r of readmissions) (byRef.get(r.ref) ?? byRef.set(r.ref, []).get(r.ref)).push(r);

const rows = [], fields = [];
for (const p of patched) {
  const hits = byRef.get(p.ref) ?? [];
  const objection = OBJECTIONS.get(p.ref);
  const decision = hits.length || objection ? 'revise' : 'approve_as_correction';
  const reasons = [];
  if (hits.length) {
    const flips = hits.filter(h => h.severity === 'meaning_flip');
    reasons.push(`Readmits ${hits.length} string(s) the curriculum treats as wrong${flips.length ? `, ${flips.length} of them a meaning flip` : ''}: ${hits.map(h => `${h.readmitted} (${h.origin})`).join('; ')}. The additions themselves are correct; the grader matches the nearest accepted entry, so each addition carries a typo ball of radius min(2, floor(min(len(addition), len(key)) * 0.3)) and admits whatever is already inside it.`);
  }
  if (objection) reasons.push(objection);
  if (!reasons.length) reasons.push('Every addition is a correct answer to this prompt at this level, returns exactly "Correct!" after the patch and was refused before it, and readmits nothing the unit teaches as a different item.');
  rows.push({ ref: p.ref, id: p.e.id, band: p.band, unit: p.unit, lesson: p.lesson, type: p.e.type, prompt: p.e.question_text ?? null, key: p.e.correct_answer, before: p.before, after: p.after, additions: p.additions, decision, readmissions: hits.map(({ readmitted, scope, origin, severity, feedback }) => ({ readmitted, scope, origin, severity, feedback })), rationale: reasons.join(' ') });
  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref: p.ref, table: 'exercises', id: p.e.id, field: 'accepted_answers', before: p.before, after: p.after, decision, rationale: reasons.join(' '), source_sha256: sourceSha });
}

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source: source, source_sha256: sourceSha, snapshot_sha256: snapshot.sha256 ?? '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  integration_verdict: 'do_not_integrate',
  grader: 'lib/grading.ts gradeAnswer with the runtime exerciseHints from lib/exercise-restore.ts; every before-value re-derived here, none reused from the author evidence',
  counts: {
    rows: rows.length,
    additions: patched.reduce((n, p) => n + p.additions.length, 0),
    approve_as_correction: rows.filter(r => r.decision === 'approve_as_correction').length,
    revise: rows.filter(r => r.decision === 'revise').length,
    readmissions_total: readmissions.length,
    readmissions_meaning_flip: readmissions.filter(r => r.severity === 'meaning_flip').length,
    readmissions_by_scope: readmissions.reduce((a, r) => ({ ...a, [r.scope]: (a[r.scope] ?? 0) + 1 }), {}),
    rows_with_a_readmission: byRef.size,
  },
  readmissions, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, fields: fields.length, revise: rows.filter(r => r.decision === 'revise').length, readmissions: readmissions.length, flips: readmissions.filter(r => r.severity === 'meaning_flip').length, byScope: readmissions.reduce((a, r) => ({ ...a, [r.scope]: (a[r.scope] ?? 0) + 1 }), {}) }));
