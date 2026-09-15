/**
 * Independent review of `scripts/question-audit/korean-accepted-alternatives.mjs`.
 *
 * The reviewer did not author the batch. 453 rows, 790 `accepted_answers`
 * additions, 375 candidates refused, 104 rows emptied.
 *
 * Everything is measured with the real `gradeAnswer` called with the runtime
 * `exerciseHints` from `lib/exercise-restore.ts`, against the frozen snapshot.
 * Every before-value was re-derived on 2026-09-14, after the three grader
 * changes of that day: the confusable list is consulted on both the target and
 * English sides and inside the accent-tolerant branch; the typo budget is the
 * SHORTER of the matched alternative and the key; and the Korean budget is
 * measured on the decomposed form.
 *
 * The check this batch had never had is the readmission sweep: adding a right
 * answer must not make a wrong one right. Each entry in `accepted_answers`
 * carries a typo ball of radius `min(2, floor(min(len(entry), len(key)) * 0.3))`,
 * so an addition can admit whatever already sits inside it. The batch was
 * replayed onto the current draft and `scripts/question-audit/readmission.test.mjs`
 * was run against the result.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
import { koreanAcceptedAlternatives, koreanAlternativeRows } from './korean-accepted-alternatives.mjs';

const base = 'docs/audits/question-verification/remediation/ko-alternatives-root-review';
const source = 'scripts/question-audit/korean-accepted-alternatives.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== '875925fdb6f81edea948b58b8854c09cabec3ab17ce9765062dd7c869b32b56e') throw Error('Unreviewed source');

const set = await createPatchSet();
koreanAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'ko');
const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ko' } });

/**
 * Readmissions this batch introduces. Measured by replaying batch A onto the
 * current draft and running readmission.test.mjs, which was green before and
 * fails after with exactly these. `merge_only` is reachable only if the
 * ko-E0002 producer collision is resolved by merging both batches' additions,
 * which is what the batch's own evidence proposes.
 */
const READMISSIONS = [
  { ref: 'ko-E0002', readmitted: '잘 자요', gloss: 'Good night', owner: 'ko-E0038 / ko-E0057', cause: '잘 가요', severity: 'meaning_flip', merge_only: true,
    note: 'Reachable only through the proposed ko-E0002 merge. "Goodbye" would accept "Sleep well".' },
  { ref: 'ko-E0520', readmitted: '아픈', gloss: 'Sick (adnominal)', owner: 'ko-E0528', cause: '아픔', severity: 'card_blur',
    note: 'A noun card for "Pain" begins accepting the adnominal adjective that is the sibling card for "Sick" — a form-class crossing this batch refuses everywhere else.' },
  { ref: 'ko-E0743', readmitted: 'To clean', gloss: '청소하다', owner: 'ko-E0731', cause: 'To cleanse', severity: 'card_blur',
    note: 'The batch itself refused "To clean" here under code `contrast`, then readmitted it through the typo ball of "To cleanse". 씻다 and 청소하다 become interchangeable.' },
  { ref: 'ko-E0780', readmitted: '나는', gloss: 'the 신나는 "Excited" stem', owner: 'ko-E0792', cause: '하는', severity: 'nonword',
    note: 'fill_blank "걱정_____ (Worried)" begins accepting 나는, which yields the non-word 걱정나는 and is the sibling card\'s answer.' },
  { ref: 'ko-E0886', readmitted: '놀았어요', gloss: 'I played', owner: 'ko-E0868', cause: '보았어요', severity: 'meaning_flip',
    note: '"I saw" accepts "I played". Two different verbs taught in the same past-tense unit.' },
  { ref: 'ko-E0888', readmitted: '일했어요', gloss: 'I worked', owner: 'ko-E0880', cause: '을 했어요', severity: 'meaning_flip',
    note: 'fill_blank "여행_____ (I traveled)" accepts 일했어요. The light-verb addition\'s particle-plus-space is exactly what puts it one edit away.' },
  { ref: 'ko-E1006', readmitted: '더 나쁜', gloss: 'Worse', owner: 'ko-E1018', cause: '더 나은', severity: 'antonym_flip',
    note: '"Better" accepts "Worse". The Korean analogue of the cheap/expensive readmission that prompted the guard.' },
  { ref: 'ko-E1006', readmitted: '더 빠른', gloss: 'Faster', owner: 'ko-E1012', cause: '더 나은', severity: 'card_blur',
    note: 'The same addition also admits the separately taught comparative "Faster".' },
  { ref: 'ko-E1560', readmitted: '사이에', gloss: 'Meanwhile', owner: 'ko-E1616', cause: ' 사이에', severity: 'card_blur',
    note: 'The addition is " 사이에" with a leading space, which normalize() strips, so it exact-matches the sibling card\'s key rather than being a distinct string.' },
];

/** Candidates the batch declared REFUSED that its own additions then made pass. */
const REFUSAL_LEAKS = [
  { ref: 'ko-E0248', candidate: '파란', code: 'part_of_speech', cause: '파랑', harm: 'same word, different form class' },
  { ref: 'ko-E0676', candidate: '식이요법', code: 'spacing_held', cause: '식이 요법', harm: 'same word, spacing only — settles KO-SPACING on this row by accident' },
  { ref: 'ko-E0743', candidate: 'To clean', code: 'contrast', cause: 'To cleanse', harm: 'different taught verb; also a readmission' },
  { ref: 'ko-E2048', candidate: '이해당사자', code: 'spacing_held', cause: '이해 당사자', harm: 'same word, spacing only — settles KO-SPACING on this row by accident' },
];

/** Additions that cross form class or speech level, against the batch's own SPEECH LEVEL policy. */
const POLICY_EXCEPTIONS = [
  { ref: 'ko-E0820', key: '인내심 있는', addition: '인내심이 있다', note: 'Adnominal key, citation-form addition. The policy refuses exactly this shape 186 times elsewhere. The row stored no alternative that licenses the mix.' },
  { ref: 'ko-E2274', key: '주무세요', addition: '주무신다', note: 'Plain 한다체 added on the "Honorifics & Speech Levels (높임말)" fill_blank, whose explanation says 주무세요 is required and plain 자요 would be disrespectful. The stored alternatives (주무십니다, 주무시고 계세요) are both deferential, so they do not license a plain style. Subject honorific -시- is retained, so the referent stays elevated; the addressee level does not.' },
  { ref: 'ko-E0006 / ko-E0050', key: '주세요', addition: '제발', note: 'Verb key, adverb addition. Defensible as a rendering of the English gloss "Please", but it is the same crossing the batch refuses 17 times under code `part_of_speech`.' },
];

/** Additions carrying leading whitespace. Inert after normalize(), but they dodge the batch's own dedupe. */
const WHITESPACE = koreanAlternativeRows.flatMap(([n, , , , key, , adds]) =>
  adds.filter(a => a !== a.trim()).map(a => ({ ref: `ko-E${String(n).padStart(4, '0')}`, key, addition: a })));

const reviseRefs = new Map();
for (const r of READMISSIONS) reviseRefs.set(r.ref, (reviseRefs.get(r.ref) ?? []).concat(`readmits ${r.readmitted} (${r.gloss}, ${r.severity})`));
for (const r of ['ko-E0820', 'ko-E2274']) reviseRefs.set(r, (reviseRefs.get(r) ?? []).concat('crosses form class or speech level against the batch\'s own policy'));

const fields = [], rows = [];
for (const [n, type, lessonTitle, band, key, current, additions, grounds] of koreanAlternativeRows) {
  const { exercise: e, lesson, unit, course, ref } = get(n);
  const patch = set.patches().find(p => p.id === e.id);
  if (!patch) throw Error(`No patch produced for ${ref}`);
  const after = patch.after.accepted_answers;
  const perAddition = additions.map(a => {
    const b = gradeAnswer(a, e.correct_answer, current, hints(e));
    const g = gradeAnswer(a, e.correct_answer, after, hints(e));
    return { addition: a, before: b.feedback, before_correct: b.isCorrect, after: g.feedback, after_exact: g.feedback === 'Correct!' };
  });
  if (perAddition.some(p => !p.after_exact)) throw Error(`Addition is tolerated rather than accepted: ${ref}`);
  const problems = reviseRefs.get(ref) ?? [];
  const leaks = REFUSAL_LEAKS.filter(l => l.ref === ref);
  const notes = [
    ...problems,
    ...leaks.map(l => `makes its own refused candidate ${l.candidate} (${l.code}) pass: ${l.harm}`),
    ...POLICY_EXCEPTIONS.filter(p => p.ref.includes(ref)).map(p => p.note),
    ...WHITESPACE.filter(w => w.ref === ref).map(w => `addition ${JSON.stringify(w.addition)} carries leading whitespace; normalize() strips it, so the stored value is inconsistent rather than wrong`),
  ];
  const decision = problems.length ? 'revise' : 'approve_as_correction';
  rows.push({ ref, id: e.id, band: course.cefr_level, type: e.type, unit: unit.title, lesson: lesson.title,
    prompt: e.question ?? e.prompt, key: e.correct_answer, accepted_before: current, accepted_after: after,
    grounds, per_addition: perAddition, decision, notes });
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
    before: current, after, decision,
    rationale: decision === 'approve_as_correction'
      ? `Each addition renders the row's prompt as the stored key does (${grounds.join('; ')}), stands in the key's own form class and speech level, and returns exactly "Correct!" after the patch rather than being tolerated. No stored key taught in the same unit becomes newly correct.`
      : `Correct as Korean, but not safe to integrate unchanged: ${notes.join('; ')}.`,
    ...(notes.length && decision === 'approve_as_correction' ? { notes } : {}),
    source_sha256: sourceSha,
  });
}

const collision = {
  ref: 'ko-E0002',
  other_producer: 'scripts/question-audit/korean-goodbye-fixes.mjs',
  disclosed_by_author: true,
  behaviour: 'Both producers throw rather than skip, so whichever runs second fails the build. Wiring this batch into build-remediation.mjs in either position breaks it.',
  authors_proposed_merge: ['안녕히 계세요', '잘 가요', '잘 있어요'],
  reviewer_finding: 'The proposed merge is NOT safe as written. 잘 가요 puts 잘 자요 ("Good night", the stored key of ko-E0038 and ko-E0057 in the same unit) one jamo inside its typo ball, so the merged row grades "Sleep well" as a correct translation of "Goodbye". Either drop 잘 가요, or add the pair 잘 가요/잘 자요 to lib/confusable-pairs.ts alongside the 가세요/계세요 entries already there. Batch B alone on this row is clean.',
};

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha, reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  grader: 'lib/grading.ts gradeAnswer with the runtime exerciseHints from lib/exercise-restore.ts; every before-value re-derived 2026-09-14 after the decomposed-budget, shorter-basis and accent-branch pair changes',
  counts: {
    rows: rows.length, additions: rows.reduce((s, r) => s + r.per_addition.length, 0),
    approve_as_correction: fields.filter(f => f.decision === 'approve_as_correction').length,
    revise: fields.filter(f => f.decision === 'revise').length,
    additions_exactly_correct_after: rows.reduce((s, r) => s + r.per_addition.filter(p => p.after_exact).length, 0),
    additions_already_tolerated_before: rows.reduce((s, r) => s + r.per_addition.filter(p => p.before_correct).length, 0),
  },
  readmissions: READMISSIONS, refusal_leaks: REFUSAL_LEAKS, policy_exceptions: POLICY_EXCEPTIONS,
  whitespace_additions: WHITESPACE, producer_collision: collision, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (err) { if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err; }
await writeFile(`${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');

const readme = `# Korean accepted-alternatives batch — independent review

Source: \`${source}\`
SHA-256: \`${sourceSha}\`
Reviewer: ${REVIEWER}
Reviewed: ${REVIEWED_ON}

## Verdict

**Do not integrate as-is.** The Korean judgements are sound and the declared counts are exact,
but the batch introduces readmissions and collides with a producer already in the draft.

| | |
|---|---|
| Rows | ${rows.length} |
| Additions | ${rows.reduce((s, r) => s + r.per_addition.length, 0)} |
| \`approve_as_correction\` | ${fields.filter(f => f.decision === 'approve_as_correction').length} |
| \`revise\` | ${fields.filter(f => f.decision === 'revise').length} |
| Additions returning exactly \`Correct!\` after the patch | ${rows.reduce((s, r) => s + r.per_addition.filter(p => p.after_exact).length, 0)} of ${rows.reduce((s, r) => s + r.per_addition.length, 0)} |
| Additions already typo-tolerated before the patch | ${rows.reduce((s, r) => s + r.per_addition.filter(p => p.before_correct).length, 0)} (matches the author's disclosure) |

Re-verified independently against the frozen snapshot: every declared type, lesson title, band,
stored key and frozen alternative list matches. No row carries options or distractors. All 790
additions are NFC. Nothing already reachable is added.

## Readmissions

\`scripts/question-audit/readmission.test.mjs\` is green on the current draft and fails with
batch A applied. Korean had no allowlist entries before this batch; these would be the first.

${READMISSIONS.map(r => `- **${r.ref}** readmits \`${r.readmitted}\` (${r.gloss}, owned by ${r.owner}) via \`${r.cause}\` — *${r.severity}*${r.merge_only ? ' (merge path only)' : ''}. ${r.note}`).join('\n')}

Three flip meaning outright: ko-E0886 ("I saw" accepts "I played"), ko-E0888 ("I traveled"
accepts "I worked") and ko-E1006 ("Better" accepts "Worse"). ko-E1006 is the direct Korean
analogue of the cheap/expensive case that prompted the guard.

## The batch's own refusals that its additions then admit

${REFUSAL_LEAKS.map(l => `- **${l.ref}** refused \`${l.candidate}\` (\`${l.code}\`) but \`${l.cause}\` admits it — ${l.harm}.`).join('\n')}

## Verdict on the two declared policies

**SPEECH LEVEL — the reasoning is right, the resting state is not neutral.** Refusing to settle a
course-wide grading question from a 561-row sample is correct, and the rule is applied
consistently across the 186 refusals. But holding does not hold the line at runtime. Eleven of
the refused form/speech-level candidates are already accepted by the grader as "Correct! (Minor
typo)" before any patch, which the author disclosed. So near-identical rows disagree today:
ko-E0496 (건강한) tolerates 건강하다 while ko-E0804 (부끄러운) refuses 러워요. The policy should be
recorded as "held, and currently inconsistent at runtime on 11 rows", not as "held, therefore
neutral". Two additions also breach the policy: see \`policy_exceptions\` in the evidence file.

**SPACING — right to hold in general, wrong as a resting state for four rows.** Holding KO-SPACING
is correct where the question is grader normalisation. It is not correct for ko-E1451, ko-E1465
and ko-E1521, which are \`error_correction\` rows, and ko-E0661, a \`cloze_deletion\`. All four take
the strict branch of \`gradeAnswer\` with no typo tolerance at all, so a learner writing the
standard-orthography 야생 동물, 지속 가능한, 인공 지능 or 치과 의사 gets a flat rejection. On the three
error_correction rows the row exists to assert which spelling is correct, so no normalisation
decision can fix it — the KEY needs content adjudication, which is outside an additions-only
batch. These four should be escalated as a content question, not parked under KO-SPACING.
Separately, KO-SPACING is already breached by accident on ko-E0676 and ko-E2048, where the
authored spaced form admits the unspaced one through tolerance.

## Other calls checked

- **The 29 uncertain claims** do resolve to KO-SPEECH-LEVEL (25) and KO-SPACING (4). None is a
  lexical omission this batch could have closed. Accepted.
- **신랑 refused for 남편** — correct. The quoted 표준국어대사전 entry glosses 신랑(新郞) only as a man
  just or about to be married.
- **뜰 accepted for 정원** — defensible. The entry gives 집 안의 ... 빈터 where 화초나 나무를 가꾸기도 하고.
  Mildly generous: 뜰 is closer to "yard" than "garden".
- **시간/시각 refused** — defensible on the pedagogical ground that the A1 card teaches duration,
  and the author disclosed the ≒시간 cross-reference. Two caveats. The refusal is inert: the
  grader already accepts 시각 for 시간 as a minor typo, so the stated decision and the runtime
  behaviour disagree. And the 표준국어대사전 text quoted in \`dictionary_lookups\` shows only
  시각1(始覺) and 시각2(時角); it does not contain the 時刻 sense the cross-reference rests on, so
  the evidence file does not support its own note. Escalate as a confusable-pair candidate.
- **Aunt/uncle accepted, sister refused** — principled, not arbitrary. On "Aunt" the key 이모 is
  itself one of several equally narrow Korean terms and English supplies no cover word, so the
  row would otherwise demand a guess. On "Sister" the key 자매 IS the Korean cover term, so
  언니/누나/여동생 add relative age and speaker gender the gloss does not supply. The same rule
  runs the other way on ko-E0365, where 형제 accepts "Siblings". The one place it bites: 자매 is
  rarely how a speaker names their own sister, so ko-E0364 is the refusal a learner is most
  likely to meet and rightly contest. It belongs to neither held question and should be raised
  on its own.

## Integration verdict

1. Resolve the ko-E0002 collision. Batch B is approved and already in the draft; this batch's
   additions must be merged in by the integration owner, not by editing either producer. The
   author's proposed merge is unsafe as written — see \`producer_collision\` in the evidence file.
2. Then either drop the causing additions on the ${new Set(READMISSIONS.filter(r => !r.merge_only).map(r => r.ref)).size} readmitting rows, or add the
   corresponding confusable pairs. Pairs are the better remedy on ko-E1006, ko-E0886, ko-E0888
   and ko-E0520, where the addition is genuinely correct and only the neighbour is wrong.
3. Strip the leading space from the four whitespace additions.
4. Re-run \`deno test --allow-read --sloppy-imports scripts/question-audit/readmission.test.mjs\`
   and require it green, rather than adding Korean entries to the allowlist.

The remaining ${fields.filter(f => f.decision === 'approve_as_correction').length} rows are approved and can be integrated once the above is done.

## Limits

This review is not a proof that the batch is error-free. It verified every frozen assertion,
graded all 790 additions and all 375 declared refusals with the real grader, and ran the
readmission sweep at its declared scope — a row's own distractors and the stored keys of its
unit siblings. A wrong answer taught only in another unit is out of that scope and remains the
confusable-pair list's business. The Korean semantic judgements on the ~400 uncontested lexical
rows were spot-checked, not exhaustively re-derived.
`;
await writeFile(`${base}/README.md`, readme);
console.log(JSON.stringify({
  rows: rows.length, fields: fields.length,
  approve: fields.filter(f => f.decision === 'approve_as_correction').length,
  revise: fields.filter(f => f.decision === 'revise').length,
  revise_refs: fields.filter(f => f.decision === 'revise').map(f => f.ref),
}));
