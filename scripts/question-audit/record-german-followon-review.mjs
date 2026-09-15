// Root independently read all36 full original records and every proposed value.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { deFollowonChoices, deFollowonChoiceCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-followon-choices.mjs';
import { deA1GreetingsFood, deA1GreetingsFoodCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-a1-greetings-food-candidates.mjs';
import { deA1TransportShopping, deA1TransportShoppingCandidates } from '../../docs/audits/question-verification/remediation/de-it-zh/de-a1-transport-shopping-candidates.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const parent = 'docs/audits/question-verification/remediation', base = `${parent}/de-followon-root-review`;
const sha = x => createHash('sha256').update(x).digest('hex');
const sources = [
  ['de-followon-choices', 'e4a0a781b5c2d50a78536b9735f30e3751e3ec0787db46cc634bcdbe26fd9835'],
  ['de-a1-greetings-food-candidates', '7474db0f709d68295d14a3e724dee3a618a3c91ef3407b5aa8b3b52ee85a5d69'],
  ['de-a1-transport-shopping-candidates', 'db7ad2827f12f1fe9fc2d56439f2f1b6b4f4672d7b7276d37a95a16876a234a3'],
];
for (const [file, hash] of sources) if (sha(await readFile(`${parent}/de-it-zh/${file}.mjs`)) !== hash) throw new Error(`Unreviewed ${file}`);
const set = await createPatchSet();
deFollowonChoiceCandidates(set); deA1GreetingsFoodCandidates(set); deA1TransportShoppingCandidates(set);
const get = lessonRefs(set.snapshot, 'de');
const reviewed = new Map([
  ...deFollowonChoices.map(r => [r.ref, r.reason]),
  ...[...deA1GreetingsFood, ...deA1TransportShopping].map(r => [r[0], r[3]]),
]);
if (reviewed.size !== 36 || set.patches().length !== 36) throw new Error('Incomplete fixed batch');
const full = [...reviewed].map(([n, reason]) => {
  const { exercise, ref, course, unit, lesson } = get(n);
  return { ref, id: exercise.id, level: course.cefr_level, unit: unit.title, lesson: lesson.title, exercise, reason,
    patch: set.patches().find(p => p.id === exercise.id) };
});
await mkdir(base, { recursive: true });
const archiveText = JSON.stringify({ source_hashes: sources, snapshot_sha256: SNAPSHOT_SHA, rows: full }, null, 2) + '\n';
const archive = `${base}/reviewed-batch.json`;
try { await writeFile(archive, archiveText, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== archiveText) throw e; }
const fields = [], runtime = [];
for (const row of full) {
  const before = row.exercise, after = { ...before, ...row.patch.after };
  const hints = { exerciseHints: { exerciseType: before.type, skillType: before.skill_type, language: 'de' } };
  if (row.patch.after.accepted_answers) for (const answer of after.accepted_answers.filter(a => !before.accepted_answers.includes(a))) {
    const oldGrade = gradeAnswer(answer, before.correct_answer, before.accepted_answers, hints).isCorrect;
    const newGrade = gradeAnswer(answer, after.correct_answer, after.accepted_answers, hints).isCorrect;
    if (oldGrade || !newGrade) throw new Error(`Missing rejection-to-acceptance ${row.ref}`);
    runtime.push({ ref: row.ref, answer, accepted_before: false, accepted_after: true });
  }
  if (row.patch.after.options) {
    const passing = after.options.filter(a => gradeAnswer(a, after.correct_answer, after.accepted_answers, hints).isCorrect);
    if (passing.length !== 1 || passing[0] !== after.correct_answer || new Set(after.options).size !== after.options.length) throw new Error(`Invalid choices ${row.ref}`);
  }
  for (const field of Object.keys(row.patch.after)) fields.push({ reviewer: 'root, independent of author audit_french', reviewed_on: '2026-09-13',
    table: 'exercises', id: row.id, ref: row.ref, field, before: before[field], after: after[field], decision: 'approve_as_correction',
    evidence: archive, evidence_sha256: sha(archiveText), snapshot_sha256: SNAPSHOT_SHA,
    rationale: `Root independently checked the full prompt, all options/answers, metadata and exact context and agrees with this narrow disposition: ${row.reason}`,
    limitation: 'Only changed fields are approved. Remaining topic/progression and unenumerated alternatives are not closed by this lexical repair.' });
}
if (runtime.length !== 45 || fields.length !== 39) throw new Error('Unexpected review counts');
for (const [file, data] of [['field-decisions.jsonl', fields], ['runtime-results.jsonl', runtime]]) {
  const output = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${base}/${file}`, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else await writeFile(`${base}/${file}`, output);
}
console.log(JSON.stringify({ reviewed_rows: 36, approved_fields: fields.length, valid_answers_repaired: runtime.length }));
