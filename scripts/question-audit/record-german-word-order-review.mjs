// Record the actual independent root review, with immutable input evidence.
// Deno run --sloppy-imports --allow-read --allow-write=docs/audits/question-verification SCRIPT
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { germanWordOrder, germanWordOrderFixes } from './german-word-order-fixes.mjs';
import { reviews, reviewedSourceSha } from '../../docs/audits/question-verification/remediation/de-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/de-word-order-root-review';
const sha = text => createHash('sha256').update(text).digest('hex');
const source = await readFile('scripts/question-audit/german-word-order-fixes.mjs', 'utf8');
if (sha(source) !== reviewedSourceSha) throw new Error('Source changed; do not extend the initial review to revised values');
if (reviews.length !== 106 || new Set(reviews.map(x => x.ref)).size !== 106 || !isDeepStrictEqual(reviews.map(x => x.ref), germanWordOrder.map(x => x[0]))) throw new Error('Incomplete or mismatched manual decisions');
const set = await createPatchSet();
germanWordOrderFixes(set);
const get = lessonRefs(set.snapshot, 'de');
const patches = new Map(set.patches().map(p => [p.id, p]));
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${reviewedSourceSha.slice(0, 12)}.json`;
const archivedText = JSON.stringify({ source_sha256: reviewedSourceSha, snapshot_sha256: SNAPSHOT_SHA, rows: germanWordOrder, patches: set.patches() }, null, 2) + '\n';
try { await writeFile(archive, archivedText, { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST' || await readFile(archive, 'utf8') !== archivedText) throw error; }
const fields = [], rows = [], runtime = [];
for (const review of reviews) {
  const { exercise, course, unit, lesson, ref } = get(review.ref);
  const patch = patches.get(exercise.id);
  const after = { ...exercise, ...patch.after };
  const hints = { exerciseHints: { exerciseType: exercise.type, skillType: exercise.skill_type, language: 'de' } };
  const tiles = after.metadata.tiles, anchors = tiles.length >= 8 ? 2 : 1;
  for (const alternative of review.additions) {
    const parts = alternative.split(/\s+/);
    if (!isDeepStrictEqual([...parts].sort(), [...tiles].sort()) || !isDeepStrictEqual(parts.slice(0, anchors), tiles.slice(0, anchors)) || !isDeepStrictEqual(parts.slice(-anchors), tiles.slice(-anchors))) throw new Error(`Unconstructible/anchor-breaking recommendation: ${ref}`);
    const beforeResult = gradeAnswer(alternative, after.correct_answer, after.accepted_answers, hints).isCorrect;
    const afterResult = gradeAnswer(alternative, after.correct_answer, [...after.accepted_answers, ...review.additions], hints).isCorrect;
    if (!afterResult) throw new Error(`Recommendation still rejected: ${ref}`);
    runtime.push({ ref, answer: alternative, accepted_before: beforeResult, accepted_after: afterResult, inventory_and_anchors: 'pass' });
  }
  const shared = { reviewer: 'root, independent of author audit_french', reviewed_on: '2026-09-13', ref, id: exercise.id, table: 'exercises', level: course.cefr_level, unit: unit.title, lesson: lesson.title,
    evidence: archive, evidence_sha256: sha(archivedText), source_sha256: reviewedSourceSha, snapshot_sha256: SNAPSHOT_SHA, rationale: review.note };
  for (const field of ['prompt', 'correct_answer', 'accepted_answers', 'metadata']) {
    const value = after[field];
    let decision = review.canonical === 'approved' ? 'approve_as_correction' : 'needs_adjudication';
    const extra = {};
    if (field === 'accepted_answers' && review.additions.length) {
      decision = 'revise';
      extra.recommended_after = [...new Set([...after.accepted_answers, ...review.additions])];
      extra.dependency = 'Author must adjudicate/apply the individually proposed orders; the exact revised list then needs follow-up verification.';
    }
    fields.push({ ...shared, field, before: exercise[field], after: value, changed: !isDeepStrictEqual(exercise[field], value), decision, ...extra });
  }
  rows.push({ ...shared, canonical_status: review.canonical, new_orders: review.additions.length,
    limitations: 'Review does not exhaust every marked German information-structure permutation. Progression is a contextual linguistic judgment, not a CEFR measurement from sentence length.' });
}
for (const [name, data] of [['field-decisions', fields], ['row-reviews', rows], ['runtime-results', runtime]]) await writeFile(`${base}/${name}.jsonl`, data.map(x => JSON.stringify(x)).join('\n') + '\n');
const summary = { reviewed_rows: rows.length, by_level: rows.reduce((a, x) => ({ ...a, [x.level]: (a[x.level] ?? 0) + 1 }), {}), canonical_approved: rows.filter(x => x.canonical_status === 'approved').length,
  canonical_pending: rows.filter(x => x.canonical_status !== 'approved').map(x => x.ref), recommendations: runtime.length, actual_rejections: runtime.filter(x => !x.accepted_before).length, proposed_repair_passes: runtime.filter(x => x.accepted_after).length,
  recommendation_rows: reviews.filter(x => x.additions.length).length, source_sha256: reviewedSourceSha, evidence_sha256: sha(archivedText), integrated: false };
await writeFile(`${base}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
