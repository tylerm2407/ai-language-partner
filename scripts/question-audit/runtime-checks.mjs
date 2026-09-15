// Read-only local diagnostics against the frozen shared-content snapshot.
// No provider calls, database changes, or fabricated semantic evaluations.
// deno run --allow-read --allow-write=docs/audits/question-verification --unstable-sloppy-imports scripts/question-audit/runtime-checks.mjs
import { gradeAnswer } from '../../lib/grading.ts';
import { isCorrect as checkpointCorrect } from '../../supabase/functions/checkpoint/checkpoint-core.ts';
import { reading as checkpointSolutions } from '../../docs/audits/question-verification/pass1/checkpoint/expectations.mjs';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

const snapshot = JSON.parse(await Deno.readTextFile('.question-audit/snapshot-8c7f381c78d8.json'));
/**
 * The `<lang>-R####` references below are POSITIONAL: the nth reading question
 * of that language, ordered by id. That ordering is fixed to the FROZEN corpus,
 * captured here before any patch is applied, because an inserted row would
 * otherwise renumber every reference after it and silently re-point an authored
 * expectation at a different question. Inserted rows are deliberately not
 * addressable this way — these indices were authored against the frozen corpus.
 * Inserted reading questions are covered instead by
 * `scripts/question-audit/remediation-runtime.test.mjs` and by
 * `corpus-runtime-checks.mjs`, which grades every row including new ones.
 */
const frozenReadingQuestionIds = snapshot.reading_questions.map(q => q.id);
const useDraft = Deno.args.includes('--draft');
let draftHash = null;
if (useDraft) {
  const text = await Deno.readTextFile('docs/audits/question-verification/remediation/draft-patches.json');
  const draft = JSON.parse(text);
  if (draft.snapshot_sha256 !== '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f') throw new Error('Wrong draft snapshot');
  draftHash = createHash('sha256').update(text).digest('hex');
  for (const patch of draft.patches) {
    // An insert has no prior row and carries `before: null`. Append it so the
    // checks below see it exactly as they see a frozen row.
    if (patch.op === 'insert') {
      const table = snapshot[patch.table];
      if (!table) throw new Error(`Out-of-scope table: ${patch.table}`);
      if (table.some(row => row.id === patch.id)) throw new Error(`Insert collides with an existing row: ${patch.table}/${patch.id}`);
      table.push({ id: patch.id, ...patch.after });
      continue;
    }
    const target = snapshot[patch.table]?.find(row => row.id === patch.id);
    if (!target || !Object.entries(patch.before).every(([field, value]) => isDeepStrictEqual(target[field], value))) throw new Error(`Draft/source mismatch: ${patch.table}/${patch.id}`);
    Object.assign(target, patch.after);
  }
}
const courses = new Map(snapshot.courses.map(x => [x.id, x]));
const units = new Map(snapshot.units.map(x => [x.id, x]));
const lessons = new Map(snapshot.lessons.map(x => [x.id, x]));
const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
const results = [];
const tests = {
  es: { 3: ['Solar', 'Wind'], 7: ['Seven days'], 13: ['Cyberbullying'], 33: ['Empathy'] },
  fr: { 2: ['JR'], 6: ['It strengthens the heart and helps control weight.'], 8: ['15%'], 10: ['CNIL'], 15: ['Sagrada Família'], 28: ['Vietnamese and Mexican'] },
  de: { 1: ['2045'], 2: ['Some pupils have no computer at home.'], 14: ['A customer service employee'], 23: ['Cycling and swimming'] },
  it: { 1: ['Brera'], 11: ['Third floor'], 13: ['40%'], 16: ['Privacy and transparency'] },
  pt: { 4: ['150 minutes'], 5: ['Privacy'], 7: ['Lisbon and Porto'], 27: ['Stronger muscles, better circulation, and less stress'] },
  ja: { 3: ['Misinformation'], 15: ['Smartphone voice recognition'], 19: ['49%'], 22: ['1–2 minutes'], 28: ['The brain can change physically through experience.'] },
  ko: { 1: ['They had more grey matter.'], 18: ['Sagrada Família'], 25: ['1–2 hours'], 26: ['A stronger heart'] },
  zh: { 9: ['Douyin'], 15: ['慕课网和学而思'], 18: ['Neuroplasticity'], 26: ['Alibaba and Tencent'] },
  ru: { 9: ['Three times a week'], 13: ['Vladimir Mayakovsky'], 14: ['Paella'], 19: ['Park Güell'], 29: ['More energy and less stress'] },
};
for (const [language, cases] of Object.entries(tests)) {
  const frozen = new Set(frozenReadingQuestionIds);
  const rows = snapshot.reading_questions.filter(q => {
    if (!frozen.has(q.id)) return false;
    const passage = passages.get(q.passage_id);
    return courses.get(passage.course_id).target_language === language;
  }).sort((a, b) => a.id.localeCompare(b.id));
  for (const [index, answers] of Object.entries(cases)) {
    const row = rows[Number(index) - 1];
    for (const answer of answers) results.push({ kind: 'reading_valid_answer', ref: `${language}-R${index.padStart(4, '0')}`, id: row.id, answer, expected: true, actual: gradeAnswer(answer, row.correct_answer, row.accepted_answers).isCorrect });
  }
}
const checkpoints = snapshot.checkpoint_items.filter(x => x.strand !== 'speaking').sort((a, b) => a.id.localeCompare(b.id));
for (const [index, answers] of Object.entries(checkpointSolutions)) {
  const row = checkpoints[Number(index) - 1];
  for (const answer of answers) {
    let expected = true, expectationNote = null;
    if (useDraft && Number(index) === 33 && ['livres', 'chats', 'frères'].includes(answer)) {
      if (row.prompt !== 'Fill in the gap with the French word for “children”: Combien d’___ avez-vous ?') throw new Error('Re-adjudicate the changed checkpoint cue');
      expected = false;
      expectationNote = 'Valid for the original unrestricted de gap, but not for the independently approved new explicit children cue. Preserve the old baseline; this is a new-task rejection check.';
    }
    if (useDraft && Number(index) === 24 && answer.startsWith('par l’intermédiaire')) {
      expected = null;
      expectationNote = 'Unresolved: the phrase is idiomatic, but its final elision precedes a literal space before un in this gap frame. Neither a confirmed valid-answer failure nor a confirmed invalid response; retained visibly for adjudication.';
    }
    results.push({ kind: expected === false ? 'checkpoint_new_cue_rejection' : 'checkpoint_valid_answer', ref: `fr-C${index.padStart(4, '0')}`, id: row.id, answer, expected, expectation_note: expectationNote, actual: checkpointCorrect(answer, row) });
  }
}
const choiceMismatches = [];
for (const ex of snapshot.exercises) {
  if (!['multiple_choice', 'listening_choice'].includes(ex.type)) continue;
  const lesson = lessons.get(ex.lesson_id);
  const unit = units.get(lesson.unit_id);
  const course = courses.get(unit.course_id);
  const accepted = [ex.correct_answer, ...(ex.accepted_answers ?? [])].map(x => x.toLowerCase());
  for (const option of ex.options ?? []) {
    if (accepted.includes(option.toLowerCase())) continue;
    const actual = gradeAnswer(option, ex.correct_answer, ex.accepted_answers, { exerciseHints: { exerciseType: ex.type, skillType: ex.skill_type, targetGrammar: ex.target_grammar, targetWord: ex.target_word, language: course.target_language } });
    if (actual.isCorrect) choiceMismatches.push({ id: ex.id, language: course.target_language, option, key: ex.correct_answer, note: 'Non-key authored option accepted via fuzzy/accent grading; needs semantic adjudication before calling it a wrong distractor.' });
  }
}
const report = { snapshot: '8c7f381c78d8', data_mode: useDraft ? 'patched_frozen_copy' : 'baseline_snapshot', draft_sha256: draftHash, provider_calls: 0, results, choice_non_key_accepted: choiceMismatches };
// Preserve the original pre-fix baseline when checking later changes.
const outputPath = Deno.args.find(arg => !arg.startsWith('--')) ?? `docs/audits/question-verification/runtime-${useDraft ? 'draft' : 'current'}.json`;
if (outputPath.endsWith('/runtime-baseline.json')) throw new Error('The frozen baseline must not be overwritten.');
await Deno.writeTextFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ answer_tests: results.length, failed_valid_answers: results.filter(x => x.expected === true && x.actual === false).length, failed_rejection_checks: results.filter(x => x.expected === false && x.actual === true).length, unresolved_candidates: results.filter(x => x.expected === null).length, choice_non_key_accepted: choiceMismatches.length, examples: choiceMismatches.slice(0, 12) }));
