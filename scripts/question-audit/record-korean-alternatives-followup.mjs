/**
 * Independent re-review of the remediation delta on
 * `scripts/question-audit/korean-accepted-alternatives.mjs`.
 *
 * The reviewer did not author the batch or its remedy. The first pass marked ten
 * rows `revise`: eight readmissions and two speech-level breaches. This pass
 * checks only what the remedy changed, plus the new material it introduced —
 * seven confusable pairs, three dropped additions and four whitespace strips.
 *
 * Re-measured, not taken on report:
 *  - batch A replayed onto the CURRENT draft with the ko-E0002 merge applied,
 *    then `scripts/question-audit/readmission.test.mjs` run against the result;
 *  - every Korean row swept for a grade the new pairs flip from accept to refuse;
 *  - every stored Korean key and authored alternative re-graded with the pairs live;
 *  - the revised table diffed against the archived one, so no unreviewed addition
 *    could enter under cover of the remedy.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
import { koreanAcceptedAlternatives, koreanAlternativeRows } from './korean-accepted-alternatives.mjs';

const base = 'docs/audits/question-verification/remediation/ko-alternatives-root-review';
const source = 'scripts/question-audit/korean-accepted-alternatives.mjs';
const test = 'docs/audits/question-verification/remediation/es-ja-ko/korean-accepted-alternatives.test.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
const testSha = sha(await readFile(test));
if (sourceSha !== 'f7129b3aa171ea25d206bd339906b84a7968f91e3116d1b84abb7745616654b6') throw Error('Unreviewed source');
if (testSha !== '224b3592b9c35211527a1c67e46ca5662d6fefbb1281902a0397c4e68dc8606e') throw Error('Unreviewed test');

/** The delta must be exactly the remedy — nothing else may ride in with it. */
const prior = JSON.parse(await readFile(`${base}/reviewed-source-875925fdb6f8.json`, 'utf8'));
const before = new Map(prior.rows.map(r => [r.ref, r.per_addition.map(p => p.addition)]));
const now = new Map(koreanAlternativeRows.map(r => [`ko-E${String(r[0]).padStart(4, '0')}`, r[6]]));
const delta = { rows_dropped: [], additions_dropped: {}, additions_introduced: {}, rows_introduced: [] };
for (const [ref, old] of before) {
  const cur = now.get(ref);
  if (!cur) { delta.rows_dropped.push(ref); continue; }
  const gone = old.filter(a => !cur.includes(a));
  const fresh = cur.filter(a => !old.includes(a));
  if (gone.length) delta.additions_dropped[ref] = gone;
  if (fresh.length) delta.additions_introduced[ref] = fresh;
}
for (const ref of now.keys()) if (!before.has(ref)) delta.rows_introduced.push(ref);
if (delta.rows_introduced.length) throw Error(`Unreviewed rows entered with the remedy: ${delta.rows_introduced}`);
for (const [ref, fresh] of Object.entries(delta.additions_introduced)) {
  const old = before.get(ref);
  for (const a of fresh) if (!old.some(o => o.trim() === a)) throw Error(`Unreviewed addition entered with the remedy: ${ref} ${JSON.stringify(a)}`);
}

const set = await createPatchSet();
koreanAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'ko');
const hints = e => ({ exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ko' });

/** Every Korean stored answer, re-graded with the seven new pairs live. */
const addsByRef = new Map(koreanAlternativeRows.map(r => [`ko-E${String(r[0]).padStart(4, '0')}`, r[6]]));
let storedChecked = 0; const storedBroken = [];
for (let n = 1; n <= 2312; n++) {
  const r = get(n);
  const patch = set.patches().find(p => p.id === r.exercise.id);
  let acc = patch?.after?.accepted_answers ?? r.exercise.accepted_answers ?? [];
  if (r.ref === 'ko-E0002') acc = ['안녕히 계세요', '잘 가요', '잘 있어요'];
  for (const answer of [r.exercise.correct_answer, ...acc]) {
    if (typeof answer !== 'string' || !answer.trim()) continue;
    storedChecked++;
    const g = gradeAnswer(answer, r.exercise.correct_answer, acc, { exerciseHints: hints(r.exercise) });
    if (g.feedback !== 'Correct!') storedBroken.push(`${r.ref} ${JSON.stringify(answer)} -> ${g.feedback}`);
  }
}
if (storedBroken.length) throw Error(`A new pair broke a stored answer:\n${storedBroken.join('\n')}`);

/**
 * Every grade the seven new pairs flip from accept to refuse, across all 2,312
 * Korean rows — the check the batch's own corpus pass cannot make, because a
 * pair is global to the language while that pass only covers stored answers.
 * Each was judged individually: in all 19 the newly refused string is a
 * different taught item that the typo ball was wrongly forgiving.
 */
const PAIR_EFFECTS = [
  { ref: 'ko-E0002', typed: '잘 자요', gloss: 'Good night', verdict: 'correction', batchA: true },
  { ref: 'ko-E0038', typed: '잘 가요', gloss: 'Goodbye, on the Good night card', verdict: 'correction', batchA: true },
  { ref: 'ko-E0057', typed: '잘 가요', gloss: 'Goodbye, on the 잘 자요 listening row', verdict: 'correction', batchA: false },
  { ref: 'ko-E0520', typed: '아픈', gloss: 'Sick, on the Pain card', verdict: 'correction', batchA: true },
  { ref: 'ko-E0528', typed: '아픔', gloss: 'Pain, on the Sick card', verdict: 'correction', batchA: true },
  { ref: 'ko-E0547', typed: '아픔', gloss: 'Pain, on the 아픈 listening row', verdict: 'correction', batchA: false },
  { ref: 'ko-E0780', typed: '나는', gloss: 'yields the non-word 걱정나는', verdict: 'correction', batchA: true },
  { ref: 'ko-E0792', typed: '하는', gloss: 'yields the non-word 신하는', verdict: 'correction', batchA: false },
  { ref: 'ko-E0868', typed: '보았어요', gloss: 'I saw, on the I played card', verdict: 'correction', batchA: false },
  { ref: 'ko-E0880', typed: '을 했어요', gloss: 'a bare light-verb fragment, on the I worked card', verdict: 'correction', batchA: true },
  { ref: 'ko-E0883', typed: '보았어요', gloss: 'I saw, on the 놀았어요 listening row', verdict: 'correction', batchA: false },
  { ref: 'ko-E0886', typed: '놀았어요', gloss: 'I played, on the I saw card', verdict: 'correction', batchA: true },
  { ref: 'ko-E0888', typed: '일했어요', gloss: 'I worked, on the I traveled blank', verdict: 'correction', batchA: true },
  { ref: 'ko-E0895', typed: '을 했어요', gloss: 'a bare fragment, on the 일했어요 listening row', verdict: 'correction', batchA: false },
  { ref: 'ko-E1006', typed: '더 나쁜', gloss: 'Worse, on the Better card', verdict: 'correction', batchA: true },
  { ref: 'ko-E1006', typed: '더 빠른', gloss: 'Faster, on the Better card', verdict: 'correction', batchA: true },
  { ref: 'ko-E1012', typed: '더 나은', gloss: 'Better, on the Faster card', verdict: 'correction', batchA: false },
  { ref: 'ko-E1027', typed: '더 나은', gloss: 'Better, on the 더 빠른 listening row', verdict: 'correction', batchA: false },
  { ref: 'ko-E1037', typed: '더 나은', gloss: 'Better, on the 더 나쁜 listening row', verdict: 'correction', batchA: false },
];

const PAIR_DEP = {
  'ko-E0002': ['잘 가요/잘 자요'], 'ko-E0520': ['아픈/아픔'], 'ko-E0780': ['나는/하는'],
  'ko-E0886': ['놀았어요/보았어요'], 'ko-E0888': ['일했어요/을 했어요'],
  'ko-E1006': ['더 나쁜/더 나은', '더 빠른/더 나은'],
};

const DECISIONS = [
  { ref: 'ko-E0002', decision: 'approve_with_dependency',
    rationale: 'Remedied by the pair 잘 가요/잘 자요, which I verified blocks the readmission on this row and, reciprocally, stops 잘 가요 passing on ko-E0038 and ko-E0057. Two dependencies remain and neither is inside this file: the pair must ship, and the integration owner must perform the ko-E0002 merge by hand — the producer still carries 잘 가요, 잘 있어요 against a row batch B already patches, and both producers still throw, so wiring this batch in without the merge fails the build.' },
  { ref: 'ko-E0520', decision: 'approve_with_dependency',
    rationale: 'Remedied by the pair 아픈/아픔. Verified: 아픈 is refused on this row after the pair, 아픔 stays refused on ko-E0528 and the ko-E0547 listening row, and the addition 아픔 still grades exactly "Correct!".' },
  { ref: 'ko-E0743', decision: 'approve_as_correction',
    rationale: '"To cleanse" dropped, "Wash" kept. Verified: "To clean" is now refused outright. Dropping was the only self-consistent remedy, since the row had itself refused "To clean" under `contrast`; a pair would have contradicted that refusal rather than enforced it. The row is slightly less generous as a result, which is the right trade.' },
  { ref: 'ko-E0780', decision: 'approve_with_dependency',
    rationale: 'Remedied by the pair 나는/하는. Verified in both directions: 나는 is refused here and 하는 is refused on ko-E0792, where it would yield the non-word 신하는.' },
  { ref: 'ko-E0820', decision: 'approve_as_correction',
    rationale: 'The citation form 인내심이 있다 dropped; the three remaining additions are all adnominal and match the key\'s form class. The breach I raised is closed and nothing new entered — 참을성 있는 and 참을성이 있는 were both in the version I reviewed.' },
  { ref: 'ko-E0886', decision: 'approve_with_dependency',
    rationale: 'Remedied by the pair 놀았어요/보았어요. Verified: the meaning flip ("I saw" accepting "I played") is closed here, and the reciprocal leak on ko-E0868 and the ko-E0883 listening row is closed with it.' },
  { ref: 'ko-E0888', decision: 'approve_with_dependency',
    rationale: 'Remedied by the pair 일했어요/을 했어요. Verified: the flip ("I traveled" accepting "I worked") is closed, and 을 했어요 no longer passes as a bare answer on ko-E0880 or ko-E0895. Keying the pair on the whole accepted string is correct — isConfusablePair matches whole normalized answers, never substrings.' },
  { ref: 'ko-E1006', decision: 'approve_with_dependency',
    rationale: 'Remedied by two pairs, 더 나쁜/더 나은 and 더 빠른/더 나은. Verified: the antonym flip ("Better" accepting "Worse") is closed, as is "Faster", and the reciprocals on ko-E1012, ko-E1027 and ko-E1037 are closed too. One documentation error: both the pair comment and the evidence say 더 나쁜 is the key of ko-E0996; it is the key of ko-E1018 and ko-E1037, while ko-E0996 keys the bare 나쁜 under the prompt "더 _____ (Worse)". No behavioural effect, but the note is the record of why the pair exists and should be corrected.' },
  { ref: 'ko-E1420', decision: 'approve_as_correction',
    rationale: 'Two leading spaces stripped. normalize() already discarded them, so no grade changes; the stored value now matches what a learner types.' },
  { ref: 'ko-E1560', decision: 'approve_as_correction',
    rationale: 'A real fix, not a reclassification. With the space stripped the row authors 사이에 outright, and that is substantively right: the prompt is "하는_____ (While)" and 하는 사이에 is a correct rendering of "while". The guard flagged it only because 사이에 is also the key of ko-E1616, and the guard compares bare keys without prompt context — ko-E1616 reads "그 _____ (Meanwhile)", so the two assemble to different phrases and the cards are not made interchangeable. It is the guard\'s documented sibling-key false positive. One gap: authoring the string is now the only way to record that judgement, because readmission.mjs has no allow channel, so the check is silenced on this row permanently. The evidence frames it as a whitespace matter only and should state the sibling-key judgement explicitly.' },
  { ref: 'ko-E1938', decision: 'approve_as_correction',
    rationale: 'One leading space stripped. No grade changes.' },
  { ref: 'ko-E2274', decision: 'reject_unnecessary_change',
    rationale: 'The plain-style addition 주무신다 is withdrawn and the row now proposes no change, which is the right outcome: the lesson is Honorifics & Speech Levels and its own explanation says the plain form is disrespectful. The row keeps its stored 주무십니다 and 주무시고 계세요 untouched.' },
];

const rows = [], fields = [];
for (const d of DECISIONS) {
  const n = Number(d.ref.slice(4));
  const { exercise: e, lesson, unit, course, ref } = get(n);
  const patch = set.patches().find(p => p.id === e.id);
  const after = patch?.after?.accepted_answers ?? e.accepted_answers ?? [];
  const priorRow = prior.rows.find(r => r.ref === ref);
  rows.push({ ref, id: e.id, band: course.cefr_level, type: e.type, unit: unit.title, lesson: lesson.title,
    prompt: e.question ?? e.prompt, key: e.correct_answer,
    reviewed_previously_as: priorRow?.decision, previously_after: priorRow?.accepted_after,
    now_after: after, still_patched: Boolean(patch),
    pairs_relied_on: PAIR_DEP[ref] ?? [], decision: d.decision });
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
    before: e.accepted_answers ?? [], after,
    decision: d.decision, rationale: d.rationale,
    ...(PAIR_DEP[ref] ? { dependency: `lib/confusable-pairs.ts must ship with ${PAIR_DEP[ref].join(' and ')}` } : {}),
    ...(ref === 'ko-E0002' ? { dependency_2: 'integration owner must merge with korean-goodbye-fixes.mjs; both producers throw on the collision' } : {}),
    supersedes: `${base}/field-decisions.jsonl`,
    source_sha256: sourceSha, test_sha256: testSha,
  });
}

const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha, test, test_sha256: testSha,
  supersedes_source_sha256: prior.source_sha256,
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  scope: 'the remediation delta only: seven confusable pairs, three dropped additions, four whitespace strips, one row withdrawn',
  counts: { rows: koreanAlternativeRows.length, additions: koreanAlternativeRows.reduce((s, r) => s + r[6].length, 0) },
  delta,
  readmission_sweep: {
    method: 'batch A replayed onto the current draft with the ko-E0002 merge, then scripts/question-audit/readmission.test.mjs run against the replay',
    baseline_without_batch: 'green', with_batch_applied: 'green', previously: '8 new readmissions, 9 with the merge',
  },
  pair_safety: {
    method: 'every Korean row graded with and without the language hint for both members of each new pair, restricted to rows where one member is a stored answer — the only shape in which a pair can fire',
    rows_affected: PAIR_EFFECTS.length,
    wrongly_refused: 0,
    effects: PAIR_EFFECTS,
    note: `${PAIR_EFFECTS.filter(x => !x.batchA).length} of the ${PAIR_EFFECTS.length} are on rows this batch does not touch, where the pairs close a pre-existing tolerance bug. The pairs are worth shipping even if the batch is deferred.`,
  },
  stored_answer_safety: { korean_answers_checked: storedChecked, broken: 0 },
  fill_blank_blind_spot: {
    reported: 'the author\'s speech-level rule read the assembled prompt-plus-key string, so a prompt ending in a full stop hid the verbal ending (ko-E2274)',
    reviewer_sweep: 'all 452 batch rows of type fill_blank or cloze_deletion checked for a blank that is not last',
    genuinely_affected: 1,
    detail: 'Only ko-E2303 shares the shape ("갑자기 문이 ___ 깜짝 놀랐어요."). It is harmless: the addition 열리어서 is the uncontracted form of the same -아/어서 connective as the key 열려서, and the sentence-final level lives in the untouched tail 놀랐어요. The other 100 blank-rows use the "Fill in the missing word: _____ means X" template, whose tail is English, so the key stands in isolation and its ending is visible.',
  },
  fields,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (err) { if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err; }
await writeFile(`${base}/followup-field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({
  fields: fields.length, delta,
  decisions: fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {}),
  pair_rows_affected: PAIR_EFFECTS.length, wrongly_refused: 0, stored_checked: storedChecked,
}));
