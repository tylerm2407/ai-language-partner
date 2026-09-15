/**
 * Closing record for the two Korean ledger items.
 *
 * Supersedes the pending decisions in this directory's earlier follow-up. It
 * rewrites `followup-field-decisions.jsonl`, which is the path
 * `scripts/question-audit/review-current.mjs` reads, so the ledger sees the
 * final disposition rather than the pending one. The two earlier archives are
 * left in place as the record of what was found at each stage.
 *
 * ITEM ONE — the ko-E0002 union. Two producers claim one field. The build now
 * composes them through `korean-goodbye-composition.mjs`, which asserts each
 * payload and emits the union. This script reproduces that value FROM SOURCE by
 * applying the same wrapper in the same order, rather than copying it out of the
 * draft, so the approval is bound to the producers and not to a build artefact.
 *
 * ITEM TWO — the confusable-pair dependency. Six rows were approved only on
 * condition that `lib/confusable-pairs.ts` ship with seven Korean pairs. This
 * script re-checks, against the current pair list: that all seven are live; that
 * each row still grades every addition exactly "Correct!"; that each readmission
 * is still refused; and that no stored Korean answer anywhere in the course
 * breaks. Two further pairs shipped after the review — one of them English, and
 * therefore consulted for every language through the grader's second lookup — so
 * the whole-course re-grade is what licenses upgrading the six.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
import { isConfusablePair } from '../../lib/confusable-pairs.ts';
import { koreanAcceptedAlternatives } from './korean-accepted-alternatives.mjs';
import { koreanGoodbyeFixes } from './korean-goodbye-fixes.mjs';
import { beforeGoodbye, beforeAlternatives } from './korean-goodbye-composition.mjs';

const base = 'docs/audits/question-verification/remediation/ko-alternatives-root-review';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author these batches';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const SOURCES = {
  alternatives: 'scripts/question-audit/korean-accepted-alternatives.mjs',
  goodbye: 'scripts/question-audit/korean-goodbye-fixes.mjs',
  composition: 'scripts/question-audit/korean-goodbye-composition.mjs',
  pairs: 'lib/confusable-pairs.ts',
};
const shas = {};
for (const [name, path] of Object.entries(SOURCES)) shas[name] = sha(await readFile(path));
if (shas.alternatives !== 'f7129b3aa171ea25d206bd339906b84a7968f91e3116d1b84abb7745616654b6') throw Error('Alternatives source moved');
if (shas.goodbye !== '555f89d0eec2229bb09a34ec8073d0045e235f900e2e048e68ebeda709b623c7') throw Error('Goodbye source moved');

/** Reproduce the shipped composition from source, in the build's order. */
const set = await createPatchSet();
koreanGoodbyeFixes(beforeGoodbye(set));
koreanAcceptedAlternatives(beforeAlternatives(set));
const get = lessonRefs(set.snapshot, 'ko');
const hints = e => ({ exerciseHints: { exerciseType: e.type, skillType: e.skill_type, targetGrammar: e.target_grammar, targetWord: e.target_word, language: 'ko' } });
const patchFor = id => set.patches().find(p => p.id === id);

const e0002 = get(2).exercise;
const merged = patchFor(e0002.id).after.accepted_answers;
const MERGED = ['안녕히 계세요', '잘 가요', '잘 있어요'];
if (JSON.stringify(merged) !== JSON.stringify(MERGED)) throw Error(`Composition emits ${JSON.stringify(merged)}, not the reviewed union`);
/** The suppressed producer carried a dictionary citation; the union does not. */
const goodbyeOnly = await (async () => { const s = await createPatchSet(); koreanGoodbyeFixes(s); return s.patches().find(p => p.id === e0002.id); })();
const sourcesLost = (goodbyeOnly.sources ?? []).filter(x => !(patchFor(e0002.id).sources ?? []).includes(x));

/** The seven pairs the six dependent approvals rest on. */
const SEVEN = [['더 나쁜', '더 나은'], ['더 빠른', '더 나은'], ['놀았어요', '보았어요'], ['일했어요', '을 했어요'], ['아픈', '아픔'], ['나는', '하는'], ['잘 가요', '잘 자요']];
const missing = SEVEN.filter(([a, b]) => !isConfusablePair(a, b, 'ko'));
if (missing.length) throw Error(`Dependency NOT met, pairs absent: ${JSON.stringify(missing)}`);

/** Every stored Korean answer, against the CURRENT pair list including the two added after review. */
let checked = 0; const broken = [];
for (let n = 1; n <= 2312; n++) {
  const r = get(n);
  const eff = { ...r.exercise, ...(patchFor(r.exercise.id)?.after ?? {}) };
  const acc = eff.accepted_answers ?? [];
  for (const a of [eff.correct_answer, ...acc]) {
    if (typeof a !== 'string' || !a.trim()) continue;
    checked++;
    if (gradeAnswer(a, eff.correct_answer, acc, hints(eff)).feedback !== 'Correct!') broken.push(`${r.ref} ${JSON.stringify(a)}`);
  }
}
if (broken.length) throw Error(`A shipped pair broke a stored Korean answer:\n${broken.join('\n')}`);

/** Per-row: additions still exact, readmissions still refused. */
const DEPENDENT = [
  { ref: 'ko-E0002', n: 2, pairs: ['잘 가요/잘 자요'], blocked: ['잘 자요'] },
  { ref: 'ko-E0520', n: 520, pairs: ['아픈/아픔'], blocked: ['아픈'] },
  { ref: 'ko-E0780', n: 780, pairs: ['나는/하는'], blocked: ['나는'] },
  { ref: 'ko-E0886', n: 886, pairs: ['놀았어요/보았어요'], blocked: ['놀았어요'] },
  { ref: 'ko-E0888', n: 888, pairs: ['일했어요/을 했어요'], blocked: ['일했어요'] },
  { ref: 'ko-E1006', n: 1006, pairs: ['더 나쁜/더 나은', '더 빠른/더 나은'], blocked: ['더 나쁜', '더 빠른'] },
];
const verified = [];
for (const d of DEPENDENT) {
  const { exercise: e, ref } = get(d.n);
  const acc = patchFor(e.id).after.accepted_answers;
  const additions = acc.filter(a => !(e.accepted_answers ?? []).includes(a));
  const bad = additions.filter(a => gradeAnswer(a, e.correct_answer, acc, hints(e)).feedback !== 'Correct!');
  if (bad.length) throw Error(`${ref}: addition no longer exactly Correct!: ${JSON.stringify(bad)}`);
  const leaked = d.blocked.filter(b => gradeAnswer(b, e.correct_answer, acc, hints(e)).isCorrect);
  if (leaked.length) throw Error(`${ref}: readmission is back: ${JSON.stringify(leaked)}`);
  verified.push({ ref, accepted_after: acc, additions, pairs: d.pairs, still_refused: d.blocked });
}

/** The remaining six fields, unchanged since the delta review; carried through so
 *  the wired path holds the whole set rather than half of it. */
const CARRIED = [
  ['ko-E0743', 743, 'approve_as_correction', '"To cleanse" dropped, "Wash" kept; "To clean" is refused outright. Dropping was the only remedy consistent with the row\'s own `contrast` refusal.'],
  ['ko-E0820', 820, 'approve_as_correction', 'The citation form 인내심이 있다 dropped; the three survivors are all adnominal and match the key\'s form class. Nothing new entered.'],
  ['ko-E1420', 1420, 'approve_as_correction', 'Two leading spaces stripped. normalize() already discarded them, so no grade changes.'],
  ['ko-E1560', 1560, 'approve_as_correction', 'With the space stripped the row authors 사이에 outright, which is right: the prompt is "하는_____ (While)" and 하는 사이에 renders "while". The guard flagged it only because 사이에 also keys ko-E1616, which reads "그 _____ (Meanwhile)" — the two assemble to different phrases, which the guard cannot see because it compares bare keys without prompt context. Authoring the string is currently the only way to record that judgement, so the check is silenced on this row permanently.'],
  ['ko-E1938', 1938, 'approve_as_correction', 'One leading space stripped. No grade changes.'],
  ['ko-E2274', 2274, 'reject_unnecessary_change', 'The plain-style 주무신다 is withdrawn and the row proposes no change, which is right: the lesson is Honorifics & Speech Levels and its own explanation says the plain form is disrespectful.'],
];

const fields = [];
for (const d of DEPENDENT) {
  const { exercise: e, ref } = get(d.n);
  const v = verified.find(x => x.ref === ref);
  const isMerge = ref === 'ko-E0002';
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
    before: e.accepted_answers ?? [], after: v.accepted_after,
    decision: 'approve_as_correction',
    rationale: isMerge
      ? `Approves the merged value ["안녕히 계세요","잘 가요","잘 있어요"] as an exact value. 안녕히 계세요 renders the bare gloss "Goodbye" spoken to the one staying, and 잘 가요 and 잘 있어요 are the ordinary informal farewells for the same prompt, which fixes neither speaker role. Reproduced from source by applying korean-goodbye-composition.mjs to both producers in the build's order, not copied from the draft: the wrapper asserts each payload and emits exactly this union. All three grade exactly "Correct!", and 잘 자요 ("Good night", the key of ko-E0038 and ko-E0057) is refused, which it is not without the 잘 가요/잘 자요 pair. This supersedes the earlier approve_with_dependency line and the separate approval of ["안녕히 계세요"] alone, both of which described parts of this value rather than the value itself.`
      : `The dependency recorded on the earlier approve_with_dependency line is met: ${d.pairs.join(' and ')} ${d.pairs.length > 1 ? 'are' : 'is'} live in lib/confusable-pairs.ts. Re-verified against the current pair list, which also carries two entries added after the review: every addition on this row grades exactly "Correct!", and ${d.blocked.map(b => JSON.stringify(b)).join(' and ')} ${d.blocked.length > 1 ? 'are' : 'is'} refused. Upgraded to an exact-value approval.`,
    dependency_met: `lib/confusable-pairs.ts ${shas.pairs.slice(0, 12)} carries ${d.pairs.join(' and ')}`,
    supersedes: `${base}/followup-field-decisions.jsonl (approve_with_dependency, same field)`,
    source_sha256: shas.alternatives,
    ...(isMerge ? { composition_sha256: shas.composition, goodbye_sha256: shas.goodbye,
      sources: goodbyeOnly.sources ?? [],
      note: sourcesLost.length ? `The emitted patch carries no sources: the composition wrapper suppresses the goodbye producer's write and with it the 표준국어대사전 citation it supplied (${sourcesLost.join('; ')}). The citation is restated here so the provenance is not lost, and the wrapper should pass it through.` : undefined } : {}),
  });
}
for (const [ref, n, decision, rationale] of CARRIED) {
  const { exercise: e } = get(n);
  const patch = patchFor(e.id);
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: e.id, field: 'accepted_answers',
    before: e.accepted_answers ?? [], after: patch?.after?.accepted_answers ?? e.accepted_answers ?? [],
    decision, rationale, source_sha256: shas.alternatives,
  });
}

const archive = `${base}/reviewed-composition-${shas.composition.slice(0, 12)}.json`;
const body = JSON.stringify({
  scope: 'closing record for the two ledger items: the ko-E0002 merged value, and the confusable-pair dependency on six rows',
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, source_sha256: shas,
  merge: {
    wrapper: SOURCES.composition,
    emitted: merged,
    reproduced_from_source: true,
    method: 'koreanGoodbyeFixes(beforeGoodbye(set)) then koreanAcceptedAlternatives(beforeAlternatives(set)), the build\'s own order',
    wrapper_behaviour_verified: 'asserts each producer payload and throws on revision; suppresses the goodbye write and widens the alternatives write to the union',
    provenance_regression: sourcesLost.length ? { lost_sources: sourcesLost, effect: 'the merged patch ships with an empty sources array', remedy: 'pass the goodbye producer\'s sources through in beforeAlternatives' } : null,
  },
  dependency: {
    required: 'the seven Korean pairs live in lib/confusable-pairs.ts',
    met: true,
    pairs_live: SEVEN.map(p => p.join('/')),
    pairs_added_after_review: ['en: to fire/to hire', 'ja: 背が高い/背が低い'],
    why_a_whole_course_recheck: 'an English pair is consulted for every language through the grader\'s second isConfusablePair lookup, so a pair added for another course can reach Korean rows',
    korean_answers_rechecked: checked, broken: 0,
    korean_rows_storing_the_english_pair_members: ['ko-E1234', 'ko-E1265', 'ko-E1279', 'ko-E1291', 'ko-E1302'],
    per_row: verified,
  },
  fields,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (err) { if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err; }
await writeFile(`${base}/followup-field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({
  merged: merged, dependency_met: true, korean_answers_rechecked: checked, broken: 0,
  fields: fields.length, decisions: fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {}),
  sources_lost_by_the_wrapper: sourcesLost,
}));
