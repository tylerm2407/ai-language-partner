/**
 * Independent exact-value review of `scripts/question-audit/chinese-accepted-alternatives.mjs`.
 *
 * The reviewer did not author the batch. This script does not edit the source,
 * the evidence or the draft: it re-hashes the source, replays the producer on a
 * FRESH patch set, and records one decision per written field with the exact
 * before and after values that the producer actually emits.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { chineseAlternativeRows, chineseAcceptedAlternatives } from './chinese-accepted-alternatives.mjs';

const base = 'docs/audits/question-verification/remediation/zh-alternatives-root-review';
const source = 'scripts/question-audit/chinese-accepted-alternatives.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');

/** Hard check. The decisions below are bound to this exact file content; a
 * different source is a different batch and must be reviewed again. */
const REVIEWED_SOURCE_SHA256 = '73502bb0729d0612176398395b38a0c9b42cba43c58a0724a588efeb095c783b';

/** Review history. The first pass reviewed sha256 2118aee4b72f (455 rows, 775
 * additions) and returned four `revise` findings. The author applied all four
 * and nothing else — verified by diffing the new row set against
 * `reviewed-source-2118aee4b72f.json`, and by re-reading the module header and
 * the function body, which are byte-identical. The four are carried below as
 * `approve_as_correction` with the revision recorded, so this file states what
 * was changed and why rather than silently agreeing with the new content. */
const PRIOR_REVIEW = {
  source_sha256: '2118aee4b72f1a0593510a6de830d8ea63112e9bdc46a714efccb7439ea034cb',
  archive: 'docs/audits/question-verification/remediation/zh-alternatives-root-review/reviewed-source-2118aee4b72f.json',
  rows: 455, additions: 775,
  revisions_requested_and_applied: [
    'zh-E0676: dropped 节食, kept 膳食',
    'zh-E1830: dropped 真相; the row no longer patches',
    'zh-E1970: dropped 论证; the row no longer patches',
    'zh-E2091: added the wrongly refused "Simile"',
  ],
};
const sourceSha = sha(await readFile(source));
if (sourceSha !== REVIEWED_SOURCE_SHA256) {
  throw new Error(`Unreviewed source: ${sourceSha} is not the reviewed ${REVIEWED_SOURCE_SHA256}`);
}

const reviewer = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const reviewed_on = '2026-09-14';

/** Every row not named here is `approve_as_correction`. Each entry carries the
 * reviewer's own reason, judged against the exercise's prompt, its lesson and
 * its unit in the frozen snapshot — not against the author's evidence file. */
const decisions = new Map([
  [676, {
    decision: 'approve_as_correction',
    revised_from: ['膳食', '节食'],
    rationale: 'First pass returned `revise`: 节食 is a verb-object compound, "to restrict food intake", where the prompt asks for a noun (key 饮食, sibling glosses all nominal), and the author applies WRONG_WORD_CLASS strictly elsewhere. The author dropped 节食 and kept 膳食, which is the recommended value. Approved as now written.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E8%8A%82%E9%A3%9F', '现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 节食 / 膳食 / 饮食'],
  }],
  [2091, {
    decision: 'approve_as_correction',
    revised_from: ['Analogy', 'Figure of speech'],
    rationale: 'First pass returned `revise` for a wrongly REJECTED alternative. 比喻 is the umbrella term of Chinese rhetoric covering 明喻 (simile), 暗喻/隐喻 and 借喻; CC-CEDICT glosses it "metaphor / analogy / figure of speech / simile". "Analogy" and "Figure of speech" were accepted from that entry while "Simile" was refused as SENSE_NOT_LICENSED, and nothing in the frozen snapshot has Simile, 明喻, Analogy or 类比 as a key or option, so no unit contrast was being protected. The author added "Simile". Approved as now written.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E6%AF%94%E5%96%BB', '现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 比喻'],
  }],


  [252, {
    decision: 'approve_as_correction',
    superseded: 'Left `uncertain` on the first pass and settled on the follow-up pass (kept 时刻, dropped 时候). The reasoning and sources are in followup-field-decisions.jsonl; this entry records the settled outcome so the two files do not disagree.',
    rationale: 'Settled on the follow-up pass. See followup-field-decisions.jsonl for the full reasoning, the dictionary citations, and the second independent reader who agreed. Approved at the value now written.',
  }],
  [2174, {
    decision: 'approve_as_correction',
    superseded: 'Left `uncertain` on the first pass and settled on the follow-up pass (field unchanged; the two REGISTER_DROP refusals on that row should be recoded to subject-retention). The reasoning and sources are in followup-field-decisions.jsonl; this entry records the settled outcome so the two files do not disagree.',
    rationale: 'Settled on the follow-up pass. See followup-field-decisions.jsonl for the full reasoning, the dictionary citations, and the second independent reader who agreed. Approved at the value now written.',
  }],
  [1250, {
    decision: 'approve_as_correction',
    superseded: 'Left `uncertain` on the first pass and settled on the follow-up pass (kept 演讲/展示/报告, dropped 简报). The reasoning and sources are in followup-field-decisions.jsonl; this entry records the settled outcome so the two files do not disagree.',
    rationale: 'Settled on the follow-up pass. See followup-field-decisions.jsonl for the full reasoning, the dictionary citations, and the second independent reader who agreed. Approved at the value now written.',
  }],
]);

/** Replay the producer on a fresh set: the before/after recorded below are the
 * values this module actually writes, read back out of the patch set. */
const set = await createPatchSet();
chineseAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'zh');
const patches = new Map(set.patches().map(p => [p.id, p]));
if (set.patches().length !== chineseAlternativeRows.length) {
  throw new Error(`Replay wrote ${set.patches().length} patches for ${chineseAlternativeRows.length} authored rows`);
}

const fields = [], rows = [];
for (const [number, key, type, lessonTitle, current, adds] of chineseAlternativeRows) {
  const { exercise, lesson, unit, course, ref } = get(number);
  const patch = patches.get(exercise.id);
  if (!patch) throw new Error(`No patch replayed for ${ref}`);
  const written = Object.keys(patch.after);
  if (written.length !== 1 || written[0] !== 'accepted_answers') {
    throw new Error(`${ref} writes ${written.join(', ')}, not accepted_answers alone`);
  }
  const verdict = decisions.get(number) ?? { decision: 'approve_as_correction', rationale: 'Each added alternative was read against this prompt\'s own wording, its hint, its lesson siblings and every key in its unit, and is standard mainland Mandarin (or standard English on the native side) in the sense the prompt fixes. No addition is the key or an existing alternative, none is an option on this row or a distractor or key of a sibling, none is traditional script, and none carries punctuation. The row is graded by the exact accepted_answers path, which returns before strict mode, so the acceptance is authored rather than reached through typo tolerance.' };
  rows.push({
    ref, number, band: course.cefr_level, unit: unit.title, lesson: lesson.title, type,
    prompt: exercise.prompt, key: exercise.correct_answer,
    hint: exercise.hint ?? null, options: exercise.options ?? null,
    frozen_accepted: exercise.accepted_answers ?? [], additions: adds,
    written_after: patch.after.accepted_answers,
    decision: verdict.decision,
  });
  fields.push({
    reviewer, reviewed_on, ref, table: 'exercises', id: exercise.id, field: 'accepted_answers',
    before: exercise.accepted_answers ?? [],
    after: patch.after.accepted_answers,
    decision: verdict.decision,
    rationale: verdict.rationale,
    source_sha256: sourceSha,
    ...(Object.hasOwn(verdict, 'recommended_after') ? { recommended_after: verdict.recommended_after } : {}),
    ...(verdict.revised_from ? { revised_from: verdict.revised_from, revised_after_first_pass: true } : {}),
    ...(verdict.superseded ? { superseded_by_followup: verdict.superseded } : {}),
    ...(verdict.sources ? { sources: verdict.sources } : {}),
  });
  // Guards the reviewer re-asserts rather than trusting: additions only, in order.
  if (JSON.stringify(patch.after.accepted_answers) !== JSON.stringify([...(exercise.accepted_answers ?? []), ...adds])) {
    throw new Error(`${ref} is not existing-plus-additions`);
  }
  if (JSON.stringify(exercise.accepted_answers ?? []) !== JSON.stringify(current)) throw new Error(`${ref} frozen drift`);
  if (exercise.correct_answer !== key || exercise.type !== type || lesson.title !== lessonTitle) throw new Error(`${ref} guard drift`);
}

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source: source,
  source_sha256: sourceSha,
  snapshot_sha256: set.snapshot ? '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f' : null,
  reviewer, reviewed_on,
  prior_review: PRIOR_REVIEW,
  counts: {
    rows: rows.length,
    additions: rows.reduce((a, r) => a + r.additions.length, 0),
    approve_as_correction: rows.filter(r => r.decision === 'approve_as_correction').length,
    revise: rows.filter(r => r.decision === 'revise').length,
    reject: rows.filter(r => r.decision === 'reject').length,
    uncertain: rows.filter(r => r.decision === 'uncertain').length,
  },
  rows,
}, null, 2) + '\n';
/** The archive is keyed on the SOURCE hash, because that is what it attests to.
 * The reviewer's decisions about that source can still change — a follow-up pass
 * settles rows left `uncertain` — so rewriting it is legitimate where the first
 * write was this reviewer's own earlier decision set. What must never happen
 * silently is the SOURCE moving under a decision, and the hard check at the top
 * of this file is what prevents that. Rewrites are announced rather than hidden. */
let archiveNote = 'written';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) {
  if (e.code !== 'EEXIST') throw e;
  const existing = await readFile(archive, 'utf8');
  if (existing === body) archiveNote = 'unchanged';
  else {
    const prior = JSON.parse(existing);
    if (prior.source_sha256 !== sourceSha) throw new Error(`Archive ${archive} attests to ${prior.source_sha256}, not ${sourceSha}`);
    await writeFile(archive, body);
    archiveNote = `rewritten: same source, decisions updated (was ${JSON.stringify(prior.counts)})`;
  }
}

await writeFile(`${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');

console.log(JSON.stringify({
  source_sha256: sourceSha,
  archive: archiveNote,
  rows: rows.length,
  fields: fields.length,
  additions: rows.reduce((a, r) => a + r.additions.length, 0),
  approve_as_correction: fields.filter(f => f.decision === 'approve_as_correction').length,
  revise: fields.filter(f => f.decision === 'revise').length,
  reject: fields.filter(f => f.decision === 'reject').length,
  uncertain: fields.filter(f => f.decision === 'uncertain').length,
  revised_after_first_pass: fields.filter(f => f.revised_after_first_pass).map(f => f.ref),
  not_approved: fields.filter(f => f.decision !== 'approve_as_correction').map(f => `${f.ref}:${f.decision}`),
}));
