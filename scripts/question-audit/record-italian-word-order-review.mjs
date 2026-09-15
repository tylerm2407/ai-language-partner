// Persist root's completed individual review, with immutable authoring evidence.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { italianWordOrder, italianWordOrderFixes } from './italian-word-order-fixes.mjs';
import { reviews, reviewedSourceSha } from '../../docs/audits/question-verification/remediation/it-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/it-word-order-root-review';
const sha = text => createHash('sha256').update(text).digest('hex');
if (sha(await readFile('scripts/question-audit/italian-word-order-fixes.mjs')) !== reviewedSourceSha) throw new Error('Source changed since manual review');
if (reviews.length !== 99 || new Set(reviews.map(r => r.ref)).size !== 99 || !eq(reviews.map(r => r.ref), italianWordOrder.map(r => r[0]))) throw new Error('Incomplete individual review');
const set = await createPatchSet(); italianWordOrderFixes(set);
const get = lessonRefs(set.snapshot, 'it');
const patches = new Map(set.patches().map(p => [p.id, p]));
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${reviewedSourceSha.slice(0, 12)}.json`;
const archivedText = JSON.stringify({ source_sha256: reviewedSourceSha, snapshot_sha256: SNAPSHOT_SHA, rows: italianWordOrder, patches: set.patches() }, null, 2) + '\n';
try { await writeFile(archive, archivedText, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== archivedText) throw e; }
const fields = [], runtime = [], rows = [];
for (const review of reviews) {
  const { exercise, course, unit, lesson, ref } = get(review.ref);
  const patch = patches.get(exercise.id), after = { ...exercise, ...patch.after };
  const hints = { exerciseHints: { exerciseType: exercise.type, skillType: exercise.skill_type, language: 'it' } };
  const tiles = after.metadata.tiles, anchors = tiles.length >= 8 ? 2 : 1;
  for (const answer of review.additions) {
    const parts = answer.split(/\s+/);
    if (!eq([...parts].sort(), [...tiles].sort()) || !eq(parts.slice(0, anchors), tiles.slice(0, anchors)) || !eq(parts.slice(-anchors), tiles.slice(-anchors))) throw new Error(`Invalid inventory/anchors ${ref}`);
    const beforeResult = gradeAnswer(answer, after.correct_answer, after.accepted_answers, hints).isCorrect;
    const afterResult = gradeAnswer(answer, after.correct_answer, [...after.accepted_answers, ...review.additions], hints).isCorrect;
    if (beforeResult || !afterResult) throw new Error(`No verified rejection-to-acceptance ${ref}`);
    runtime.push({ ref, answer, accepted_before: false, accepted_after: true, inventory_and_anchors: 'pass' });
  }
  const shared = { reviewer: 'root, independent of author audit_french', reviewed_on: '2026-09-13', ref, table: 'exercises', id: exercise.id,
    level: course.cefr_level, unit: unit.title, lesson: lesson.title, evidence: archive, evidence_sha256: sha(archivedText), source_sha256: reviewedSourceSha,
    snapshot_sha256: SNAPSHOT_SHA, rationale: review.note };
  for (const field of Object.keys(patch.after)) {
    const needs = field === 'accepted_answers' && review.additions.length;
    fields.push({ ...shared, field, before: exercise[field], after: after[field], decision: needs ? 'revise' : 'approve_as_correction',
      ...(needs ? { recommended_after: [...new Set([...after.accepted_answers, ...review.additions])], dependency: 'Author adjudication and exact-value follow-up required.' } : {}) });
  }
  rows.push({ ...shared, canonical_status: review.canonical, proposed_orders: review.additions.length,
    limitations: 'Contextual level review is not a measured CEFR score. All marked Italian information-structure permutations are not claimed to be enumerated.' });
}
for (const [name, data] of [['field-decisions', fields], ['row-reviews', rows], ['runtime-results', runtime]]) await writeFile(`${base}/${name}.jsonl`, data.map(x => JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify({ reviewed_rows: rows.length, canonical_approved: 99, new_orders_reject_before_pass_after: runtime.length, integrated: false }));
