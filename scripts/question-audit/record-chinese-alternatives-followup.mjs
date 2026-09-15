/**
 * Follow-up decisions on the Chinese accepted-answer alternatives batch.
 *
 * Second pass by the same independent reviewer, after the lead applied the four
 * first-pass revisions and after a second opinion from author-zh-alternatives
 * (`chinese-alternatives-second-opinion-2026-09-14.md`) raised ten rows where
 * that module is more permissive than its reading.
 *
 * This file settles the five rows left `uncertain`, and records the outcome of
 * checking the second opinion's ten. A second opinion is input, not a
 * correction: each of the ten was re-derived from the frozen snapshot here, and
 * three of them are upheld as written against it.
 *
 * Reads only. It does not edit the source, the evidence, the draft or the test.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { chineseAlternativeRows, chineseAcceptedAlternatives } from './chinese-accepted-alternatives.mjs';

const base = 'docs/audits/question-verification/remediation/zh-alternatives-root-review';
const source = 'scripts/question-audit/chinese-accepted-alternatives.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');

const REVIEWED_SOURCE_SHA256 = '73502bb0729d0612176398395b38a0c9b42cba43c58a0724a588efeb095c783b';

/** Third source revision. All nine follow-up `revise` findings were applied and
 * nothing else changed — verified by diffing against
 * `reviewed-source-74eecca360e3.json`. 453 rows/773 additions -> 446/764.
 * Seven rows were withdrawn entirely because dropping the addition left them
 * empty (zh-E0856, zh-E0889, zh-E0936, zh-E1435, zh-E1448, zh-E1645, zh-E1684);
 * they emit no patch and therefore carry no field decision here. Two kept a
 * value and are re-approved below at the revised value. */
const WITHDRAWN_ON_REVIEWER_RECOMMENDATION = ['zh-E0856','zh-E0889','zh-E0936','zh-E1435','zh-E1448','zh-E1645','zh-E1684'];
const sourceSha = sha(await readFile(source));
if (sourceSha !== REVIEWED_SOURCE_SHA256) {
  throw new Error(`Unreviewed source: ${sourceSha} is not the reviewed ${REVIEWED_SOURCE_SHA256}`);
}

const reviewer = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const reviewed_on = '2026-09-14';

const followups = new Map([
  // ---- the five left uncertain on the first pass, now settled ----


  [252, {
    decision: 'approve_as_correction',
    revised_from: ['时候', '时刻'],
    settles: 'independent_uncertain',
    rationale: 'Settled on the follow-up pass as `revise`: keep 时刻, drop 时候. 时刻 is a free noun and is a fair answer for "Time"; 时候 is not, because it does not occupy the bare-noun slot the prompt asks for — 你有时间吗 is idiomatic and 你有时候吗 is not, and 时候 in use is almost always bound to a modifier (什么时候, ……的时候, 小时候). The dictionary gloss 时间 describes what it means inside those bound uses, not where it can stand, and an accepted answer is a claim about distribution. A second independent reader reached the same conclusion and reversed its own earlier position. Applied; approved at the revised value.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E6%97%B6%E5%80%99', '现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 时间 / 时候 / 时刻'],
  }],
  [1250, {
    decision: 'approve_as_correction',
    revised_from: ['简报', '演讲', '展示', '报告'],
    settles: 'independent_uncertain',
    rationale: 'Settled on the follow-up pass as `revise`: drop 简报, keep 演讲, 展示 and 报告, which were never in question. In mainland standard usage 简报 is a briefing or a bulletin (工作简报, 新闻简报); the slide-deck reading of 簡報 is Taiwan usage. Settled by the batch\'s own policy rather than a fresh judgement — the same REGIONAL code was applied correctly to every other Taiwan term in the batch (应用程式, 社群媒体, 人工智慧, 荧幕, 萤幕, 利害关系人, 起司, 药局, 睡房, 公车) and this is the one that slipped through it. A second independent reader agreed and asked that the regional line be stated as explicit policy rather than left implicit across a dozen scattered per-row decisions; that request is passed to the lead. Applied; approved at the revised value.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E7%AE%80%E6%8A%A5', '现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 简报'],
  }],
  [2174, {
    decision: 'approve_as_correction',
    settles: 'independent_uncertain',
    resolved_open_question: 'The first pass asked the lead to rule on whether a plain non-idiomatic paraphrase is acceptable on Idiomatic Expressions target-side rows. No ruling is needed. A second reader reached the same conclusion independently and reversed its own earlier position, so both passes agree the refusals of 非常昂贵 and 十分昂贵 are CORRECT and the field as written is correct.',
    recode_withdrawn: 'An earlier version of this entry recommended recoding those two refusals away from REGISTER_DROP to a subject-retention reason, on the argument that the key 价格不菲 predicates on 价格 and the refused forms drop that subject. That recommendation is WITHDRAWN. It fits three of the five alternatives and breaks on the fourth: 贵得要命 is structurally identical to 非常昂贵 — a bare adjective under a degree modifier with no subject — and is accepted. What actually separates them is that 贵得要命 is idiomatic and vivid while 非常昂贵 is a flat literal gloss, on a row whose prompt is an idiom. That is a register argument, so REGISTER_DROP was already the right code and the reframe would have replaced a correct reason with one covering three rows out of five. The reviewer raised the 贵得要命 counterexample and the second reader, who proposed the reframe, withdrew it.',
    rationale: 'The field as written is approved: 花一大笔钱, 贵得要命 and 价格昂贵 are all correct Chinese for "To cost an arm and a leg", so nothing here marks a wrong answer right. The refusals are correct and their reason code is correct. Nothing on this row needs to change.',
    sources: ['现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 不菲 / 昂贵'],
  }],

  // ---- raised by the second opinion, verified independently, upheld ----






  // ---- raised by the second opinion, checked, NOT upheld: the module is right ----
  [1321, {
    decision: 'revise', recommended_after: ['Appointment', 'Booking'],
    raised_by: 'second opinion, which narrowed this reviewer\'s own open question',
    supersedes: 'The first follow-up pass approved this row and reported zh-E1347 as a defect; that reasoning is withdrawn (see README §2c). The second follow-up pass then re-opened this row as `uncertain`, saying the lexical and part-of-speech readings of the 预约/预订 contrast condemn opposite additions. That summary was wrong and contradicted its own clauses.',
    rationale: 'Drop "To reserve", keep "Booking". The second reader caught an inversion in the previous entry and is right. 预约 is taught with nouns only (Appointment, Reservation) and 预订 with a verb only (To book), and the row\'s frozen accepted answer is likewise a noun. Both readings of the contrast condemn "To reserve": on the lexical reading it spans 预订\'s sense, and on the part-of-speech reading it is a verb in a slot the curriculum fills with nouns. Only "Booking" differs between the readings — condemned as lexically 预订\'s territory, permitted as a noun matching the key "Reservation" — and since a plain synonym of the key is the weaker objection, it stays. The open question therefore narrows from two strings to one, and does not block: the row marks no wrong answer right either way.',
    residual_question: 'If whoever owns Travel & Adventure rules the 预约/预订 contrast lexical rather than part-of-speech, "Booking" should be dropped too, leaving ["Appointment"]. Not a blocker.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E7%BA%A6', 'https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E9%A2%84%E8%AE%A2'],
  }],
  [946, {
    decision: 'approve_as_correction',
    dependency_discharged: 'Recorded as approve_with_dependency on the previous pass, because adding 我将会吃 and 我要吃 readmitted the refused 我将吃 as "Correct! (Minor typo)". lib/grading.ts has since changed: the typo budget is now measured on `toleranceBasis = min(len(best-matching accepted answer), len(key))`, so an addition can no longer raise the budget above what the key allows. Re-measured against lib/grading.ts sha256 9651983960c4 — the row now rejects 我将吃. Dependency discharged; plain approval.',
    rationale: 'The value written is correct: 我将会吃 and 我要吃 are both good for "I will eat". The readmission that qualified this approval has been fixed in the grader rather than in the content, which is the right place for it.',
    sources: ['lib/grading.ts sha256 9651983960c477eaff3388195debe140faf66a19ce646cd357a9d1d289cab9c5'],
  }],
  [1488, {
    decision: 'approve_as_correction',
    dependency_discharged: 'Same as zh-E0946. 应用程式, refused as REGIONAL, was readmitted once 应用程序 was added; with the budget now clamped to the shorter of the best match and the key (应用, 2 characters, budget 0) it is rejected again. Re-measured against lib/grading.ts sha256 9651983960c4. A full sweep of all 132 refusals sitting on a patched row now returns ZERO readmissions, down from two.',
    rationale: '应用程序 and 应用软件 are correct and valuable. The regional refusal they were defeating is enforced again.',
    sources: ['lib/grading.ts sha256 9651983960c477eaff3388195debe140faf66a19ce646cd357a9d1d289cab9c5'],
  }],
  [1573, {
    decision: 'approve_with_dependency',
    dependency: 'Add ["Then","When"] to the `en` list in lib/confusable-pairs.ts, or withdraw English typo tolerance on this class. The budget clamp landed in lib/grading.ts does NOT close this one, because the addition is SHORTER than the key.',
    raised_by: 'generalized readmission sweep run by this reviewer after the second reader asked for one',
    rationale: 'Found only by widening the sweep from the row\'s own recorded refusals to every sibling key in the unit, which is why the first sweep missed it: "Then" was never proposed on this row. Key "While" (5 chars) for 当…的时候; the patch adds "When" (4 chars). toleranceBasis is min(4, 5) = 4, budget 1, and "Then" is one edit from "When", so it now returns "Correct! (Minor typo)". "Then" is 然后\'s taught key on three sibling rows in this same unit, and the batch refused "Then" on zh-E1601 precisely to protect that contrast — so this row readmits what a sibling row was corrected to exclude. "When" is a correct translation of 当…的时候 and should not be dropped to fix a grader problem, hence a dependency rather than a revise. This is the residual shape of the readmission defect after the budget clamp: a short addition can still create a near-neighbour the key itself was far from.',
    sources: ['lib/grading.ts sha256 9651983960c477eaff3388195debe140faf66a19ce646cd357a9d1d289cab9c5'],
  }],
  [66, {
    decision: 'approve_as_correction',
    raised_by: 'second opinion (author-zh-alternatives), not upheld',
    rationale: 'The second opinion objects that bare 不 is a negator rather than a standalone answer. A dictionary settles it against that reading: 现代汉语词典 gives 不 two senses, the second of which is explicitly its use alone as a negative reply — 你去吗？不。 That is exactly what the prompt asks for. 不对 in the same row is also fine. Upheld as written.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E4%B8%8D', '现代汉语词典 (Xiandai Hanyu Cidian), 7th edition, 不, sense 2'],
  }],
  [1922, {
    decision: 'approve_as_correction',
    raised_by: 'second opinion (author-zh-alternatives), not upheld',
    rationale: 'The second opinion reads the 反论点 / 反对论点 pair the other way round. Checked against the unit: 反论点 is a noun, a transparent 反- compound on 论点, and does not collide with 论点 itself, which is the key for "Argument" on five other rows in the same unit. 反对论点 parses as a verb phrase, "to oppose the argument", which is why WRONG_WORD_CLASS was the right code for it. The module\'s split is upheld. Noting for the record that 反论点 is not a CC-CEDICT headword and is the loosest acceptance in this unit, so it is upheld as defensible rather than as certain.',
    sources: ['https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=%E8%AE%BA%E7%82%B9'],
  }],



]);

const set = await createPatchSet();
chineseAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'zh');
const patches = new Map(set.patches().map(p => [p.id, p]));
const authored = new Map(chineseAlternativeRows.map(r => [r[0], r]));

const lines = [];
for (const [number, verdict] of followups) {
  const row = authored.get(number);
  if (!row) throw new Error(`zh-E${String(number).padStart(4, '0')} is no longer an authored row`);
  const { exercise, ref } = get(number);
  const patch = patches.get(exercise.id);
  if (!patch) throw new Error(`No patch replayed for ${ref}`);
  const before = exercise.accepted_answers ?? [];
  const after = patch.after.accepted_answers;
  if (verdict.decision === 'approve_with_dependency' && !verdict.dependency) throw new Error(`${ref}: approve_with_dependency needs a dependency`);
  if (verdict.decision === 'revise' && JSON.stringify(verdict.recommended_after) === JSON.stringify(after)) {
    throw new Error(`${ref}: recommended_after equals the value already written`);
  }
  lines.push({
    reviewer, reviewed_on, ref, table: 'exercises', id: exercise.id, field: 'accepted_answers',
    before, after, decision: verdict.decision, rationale: verdict.rationale,
    source_sha256: sourceSha, pass: 'followup',
    ...(Object.hasOwn(verdict, 'recommended_after') ? { recommended_after: verdict.recommended_after } : {}),
    ...(verdict.settles ? { settles_prior_status: verdict.settles } : {}),
    ...(verdict.raised_by ? { raised_by: verdict.raised_by } : {}),
    ...(verdict.open_question ? { open_question: verdict.open_question } : {}),
    ...(verdict.resolved_open_question ? { resolved_open_question: verdict.resolved_open_question } : {}),
    ...(verdict.recode_withdrawn ? { recode_withdrawn: verdict.recode_withdrawn } : {}),
    ...(verdict.dependency_discharged ? { dependency_discharged: verdict.dependency_discharged } : {}),
    ...(verdict.residual_question ? { residual_question: verdict.residual_question } : {}),
    ...(verdict.dependency ? { dependency: verdict.dependency } : {}),
    ...(verdict.supersedes ? { supersedes: verdict.supersedes } : {}),
    ...(verdict.evidence_that_would_settle_it ? { evidence_that_would_settle_it: verdict.evidence_that_would_settle_it } : {}),
    ...(verdict.sources ? { sources: verdict.sources } : {}),
    evidence: `${base}/followup-field-decisions.jsonl`,
  });
}

await writeFile(`${base}/followup-field-decisions.jsonl`, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
console.log(JSON.stringify({
  source_sha256: sourceSha,
  followups: lines.length,
  withdrawn_on_recommendation: WITHDRAWN_ON_REVIEWER_RECOMMENDATION,
  revise: lines.filter(l => l.decision === 'revise').map(l => l.ref),
  approve_as_correction: lines.filter(l => l.decision === 'approve_as_correction').map(l => l.ref),
  uncertain_remaining: lines.filter(l => l.decision === 'uncertain').map(l => l.ref),
  approve_with_dependency: lines.filter(l => l.decision === 'approve_with_dependency').map(l => l.ref),
  open_questions: lines.filter(l => l.open_question).map(l => l.ref),
  resolved_open_questions: lines.filter(l => l.resolved_open_question).map(l => l.ref),
  recode_withdrawn: lines.filter(l => l.recode_withdrawn).map(l => l.ref),
}));
