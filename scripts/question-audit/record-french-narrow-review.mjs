// Exact evidence for root's completed independent review of the frozen299 rows.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { frenchLessonFixes, frenchAlternativeAdditions } from './french-lesson-fixes.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/fr-root-review';
const sha = v => createHash('sha256').update(v).digest('hex');
const sourceSha = sha(await readFile('scripts/question-audit/french-lesson-fixes.mjs'));
if (sourceSha !== 'e748241a49f4cfc4b7ff8ff71243a6e2f10a0192bd7ea05a3ec4d776cfd6f585') throw new Error('Unreviewed source change');
const set = await createPatchSet(); frenchLessonFixes(set);
const get = lessonRefs(set.snapshot, 'fr');
const contexts = new Map(Array.from({ length: 2312 }, (_, i) => get(i + 1)).map(x => [x.exercise.id, x]));
const patches = set.patches(), runtime = [];
if (patches.length !== 299 || frenchAlternativeAdditions.length !== 238) throw new Error('Unexpected frozen batch');
const archiveText = JSON.stringify({ source_sha256: sourceSha, snapshot_sha256: SNAPSHOT_SHA, patches,
  originals: patches.map(p => ({ table: p.table, id: p.id, original: set.snapshot[p.table].find(x => x.id === p.id),
    ...(contexts.has(p.id) ? { ref: contexts.get(p.id).ref, unit: contexts.get(p.id).unit.title, lesson: contexts.get(p.id).lesson.title } : {}) })) }, null, 2) + '\n';
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-e748241a49f4.json`;
try { await writeFile(archive, archiveText, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== archiveText) throw e; }
for (const [n, answers] of frenchAlternativeAdditions) {
  const { exercise: before, ref } = get(n);
  const after = { ...before, ...patches.find(p => p.id === before.id).after };
  const hints = { exerciseHints: { exerciseType: before.type, skillType: before.skill_type, language: 'fr', targetGrammar: before.target_grammar } };
  for (const answer of answers) {
    if (gradeAnswer(answer, before.correct_answer, before.accepted_answers, hints).isCorrect ||
      !gradeAnswer(answer, after.correct_answer, after.accepted_answers, hints).isCorrect) throw new Error(`Missing verified repair ${ref}/${answer}`);
    runtime.push({ ref, answer, accepted_before: false, accepted_after: true });
  }
}
const fields = patches.flatMap(p => Object.keys(p.after).map(field => ({
  reviewer: 'root, independent of author audit_spanish', reviewed_on: '2026-09-13', table: p.table, id: p.id,
  ref: contexts.get(p.id)?.ref ?? p.id, field, before: p.before[field], after: p.after[field], decision: 'approve_as_correction',
  evidence: archive, evidence_sha256: sha(archiveText), source_sha256: sourceSha, snapshot_sha256: SNAPSHOT_SHA,
  rationale: `Root read the exact original prompt, alternatives, metadata, hint, explanation and unit/lesson context, then each new value. Narrow disposition upheld: ${p.reasons.join(' ')}`,
  limitations: 'Exact changed-field approval only. Topic/progression groups, sole-tile replacements, all future paraphrases, open-production semantic grading and audio quality are not certified by this decision.',
})));
if (fields.length !== 323 || runtime.length !== 322) throw new Error('Incomplete review');
for (const [file, data] of [['field-decisions.jsonl', fields], ['runtime-results.jsonl', runtime]]) {
  const output = data.map(x => JSON.stringify(x)).join('\n') + '\n';
  if (process.argv.includes('--verify')) {
    if (await readFile(`${base}/${file}`, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else await writeFile(`${base}/${file}`, output);
}
console.log(JSON.stringify({ reviewed_rows: 299, approved_changed_fields: 323, valid_answer_repairs: 322 }));
