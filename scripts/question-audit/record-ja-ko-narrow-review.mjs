// Evidence recorder for root's completed review of the frozen JA/KO proposals.
// It is not a new review and must not approve changes to these immutable files.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = 'docs/audits/question-verification/remediation';
const output = `${base}/ja-ko-root-review`;
const batches = [
  ['ja', 49, '1b00b161afdfaf50628ddb04f0c303cdb0376d9735ad6226abd2af7040fc3cf3'],
  ['ja_shared', 2, 'd9e2f03240cb1bf3445bd03dcca4a747f0f586c29936d1ab708c6be88c4cb0a9'],
  ['ko', 55, '87db1c132ea03e03e914ae4903ca8a36ffed3a8999a855e922a26bc540db3640'],
];
const withdrawnJapanese = new Set(['ja-E2148', 'ja-E2161', 'ja-E2174', 'ja-E2187', 'ja-E2197', 'ja-E2198']);
const priceCard = 'aabbccdd-6666-4005-c004-b20000000000';
const priceSources = ['https://kotobank.jp/word/目が飛び出る-642672', 'https://kotobank.jp/word/目玉が飛び出る-643907', 'https://kotobank.jp/word/目の玉が飛び出る-644212'];
const notes = {
  'ja-E2230': 'The stated travel plan supports なら advice; removing a false universal temporal restriction does not change the valid key.',
  'ja-E2248': 'English rained on is possible; corrected explanation retains the Japanese affected-person interpretation.',
  'ja-E2260': '遊ばせた is a causative; intransitive causee に is possible in appropriate constructions, so a universal を rule was false.',
  'ja-E2266': 'The coach/run causative retains all roles and intended meaning; causee marking and permission/coercion are qualified rather than mechanical.',
  'ja-E2278': 'The teacher-viewing perspective is now visible; respectful ご覧になる/見られる and comma-free alternatives fit it. Humble forms are not first-person-only.',
  'ja-E2280': 'The source explicitly promised acceptance of お送りします but rejected it. New polite humble sentences preserve documents and tomorrow.',
  'ja-E2292': 'Direct intention is now explicit; all added punctuation variants preserve existing accepted plan meanings. Original hearsay about oneself is not universally impossible.',
  'ja-E2301': 'Polite ます addresses the listener without itself elevating the subject; the subject-honorific distinction replaces an incorrect claim of no respect at all.',
  'ja-E2306': 'Teacher-honoring perspective is visible and both respectful verb forms remain; humble use for an in-group person is not falsely prohibited.',
  'ko-E2235': '아프다고 corrects the malformed reported adjective. Required 수진 씨가 and -다고 했어요 are visible in metadata.instruction, so nonconforming endings/spacing are not valid alternatives to this constrained task.',
  'ko-E2247': 'The lexical passive 들리다 is correct. The official historical analysis uses -이- and notes synchronic differences; the new wording only rejects the false ordinary ㄷ change before consonant -리-, not all historical irregularity.',
  'ko-E2250': 'The source is a valid active sentence with reversed roles. Visible context asks for the intended passive rather than declaring the active universally ungrammatical.',
  'ko-E2263': 'The actual displayed transformation instruction explicitly requires -았/었더라면; removing -았다면 alternatives enforces that constraint, not a general ban on them.',
  'ko-E2264': 'Explicit unreal-past context now distinguishes the desired counterfactual from a possible open condition/past inference. Both new conditional variants preserve the requested past.',
  'ko-E2271': 'The prompt now asks for the teacher and both honorific markers; respectful speech about a friend is no longer universally prohibited.',
  'ko-E2306': 'Root requested and verified a cue saying use polite speech, not preserve one speech level. Both 말하셨어요 and 말하셨습니다 honor grandmother and preserve the quoted command.',
  'ko-E2148': '눈이 휘둥그레질 정도로 비싸다 completes the fixed prefix and supplies the intended expense meaning. Other original cards/exercises already include 정도로 비싸다; their different valid 튀어나올 wording is preserved.',
};
const fields = [], rows = [];
await mkdir(output, { recursive: true });
for (const [batch, count, expectedSha] of batches) {
  const path = `${base}/es-ja-ko/initial-${batch}-proposals.jsonl`;
  const text = await readFile(path, 'utf8');
  if (createHash('sha256').update(text).digest('hex') !== expectedSha) throw new Error(`Unreviewed evidence change: ${path}`);
  const proposals = text.trim().split('\n').map(JSON.parse);
  if (proposals.length !== count) throw new Error('Reviewed row count changed');
  for (const p of proposals) {
    const declined = batch === 'ja' && (withdrawnJapanese.has(p.ref) || p.id === priceCard);
    const reason = declined
      ? 'Do not replace this attested idiom merely to make it more explicit. Shogakukan dictionaries record its high-price sense and connect the eye/eyeball variants. The initial NINJAL taxonomy citation does not establish the proposed mandatory price predicate. Author independently agreed and withdrew the seven-row bundle.'
      : notes[p.ref] ?? 'Root independently read this exact before/after value with full original prompt, options, accepted answers, hints, explanations and lesson context. The narrow change repairs the identified linguistic/answer defect without approving unrelated unchanged content.';
    const evidence = { reviewer: 'root, independent of author audit_german', reviewed_on: '2026-09-13', table: p.table, id: p.id, ref: p.ref,
      evidence: path, evidence_sha256: expectedSha, source_file_sha256: p.source_file_sha256, rationale: reason,
      sources: declined ? priceSources : p.sources,
      original_author_reason: p.reasons };
    for (const [field, after] of Object.entries(p.changed_fields)) {
      if (isDeepStrictEqual(p.original_row[field], after)) throw new Error('Not a changed field');
      fields.push({ ...evidence, field, before: p.original_row[field], after,
        decision: declined ? 'reject_unnecessary_change' : 'approve_as_correction' });
    }
    rows.push({ ...evidence, decision: declined ? 'withdraw_unconfirmed_rewrite' : 'approve_exact_narrow_changes',
      limits: 'Not approval of every unchanged answer, topic/progression concern or source example. Open-production grading, other known issue groups and unauditioned audio remain separate.' });
  }
}
if (rows.filter(x => x.decision === 'withdraw_unconfirmed_rewrite').length !== 7 || rows.filter(x => x.decision === 'approve_exact_narrow_changes').length !== 99) throw new Error('Decision counts changed');
for (const [name, data] of [['field-decisions', fields], ['row-decisions', rows]]) {
  const text = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${output}/${name}.jsonl`, 'utf8') !== text) throw new Error('Saved review changed');
  } else await writeFile(`${output}/${name}.jsonl`, text);
}
console.log(JSON.stringify({ reviewed_rows: rows.length, approved_rows: 99, declined_rewrites: 7, changed_fields: fields.length, integrated: false }));
