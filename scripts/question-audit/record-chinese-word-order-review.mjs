// Preserve the independently read frozen bank, not approval of later revisions.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { chineseWordOrder, chineseWordOrderFixes } from './chinese-word-order-fixes.mjs';
import { reviews, reviewedSourceSha } from '../../docs/audits/question-verification/remediation/zh-word-order-root-review/review-data.mjs';
import { gradeAnswer } from '../../lib/grading.ts';
const base = 'docs/audits/question-verification/remediation/zh-word-order-root-review';
const sha = text => createHash('sha256').update(text).digest('hex');
if (sha(await readFile('scripts/question-audit/chinese-word-order-fixes.mjs')) !== reviewedSourceSha) throw new Error('Unreviewed source change');
if (reviews.length !== 126 || new Set(reviews.map(r => r.ref)).size !== 126 || !eq(reviews.map(r => r.ref), chineseWordOrder.map(r => r[0]))) throw new Error('Incomplete individual review');
const set = await createPatchSet(); chineseWordOrderFixes(set);
const get = lessonRefs(set.snapshot, 'zh'), patches = new Map(set.patches().map(p => [p.id, p]));
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${reviewedSourceSha.slice(0, 12)}.json`;
const archivedText = JSON.stringify({ source_sha256: reviewedSourceSha, snapshot_sha256: SNAPSHOT_SHA, rows: chineseWordOrder, patches: set.patches() }, null, 2) + '\n';
try { await writeFile(archive, archivedText, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== archivedText) throw e; }
const fields = [], runtime = [], rows = [];
for (const review of reviews) {
  const { exercise, course, unit, lesson, ref } = get(review.ref);
  const patch = patches.get(exercise.id), after = { ...exercise, ...patch.after };
  const hints = { exerciseHints: { exerciseType: exercise.type, skillType: exercise.skill_type, language: 'zh' } };
  const tiles = after.metadata.tiles;
  for (const segmented of review.additions) {
    const parts = segmented.split('|'), answer = parts.join('');
    if (!eq([...parts].sort(), [...tiles].sort()) || parts[0] !== tiles[0] || parts.at(-1) !== tiles.at(-1)) throw new Error(`Invalid tiles/anchors ${ref}`);
    const before = gradeAnswer(answer, after.correct_answer, after.accepted_answers, hints).isCorrect;
    const next = gradeAnswer(answer, after.correct_answer, [...after.accepted_answers, answer], hints).isCorrect;
    if (before || !next) throw new Error(`No rejection-to-acceptance ${ref}`);
    runtime.push({ ref, answer, segmented, accepted_before: false, accepted_after: true, inventory_and_anchors: 'pass' });
  }
  const shared = { reviewer: 'root, independent of author audit_french', reviewed_on: '2026-09-13', ref, table: 'exercises', id: exercise.id,
    level: course.cefr_level, unit: unit.title, lesson: lesson.title, evidence: archive, evidence_sha256: sha(archivedText), source_sha256: reviewedSourceSha,
    snapshot_sha256: SNAPSHOT_SHA, rationale: review.note };
  for (const field of Object.keys(patch.after)) {
    let decision = review.canonical === 'approved' ? 'approve_as_correction' : 'needs_adjudication';
    const extra = {};
    if (field === 'accepted_answers' && review.additions.length) {
      decision = 'revise'; extra.recommended_after = [...after.accepted_answers, ...review.additions.map(a => a.split('|').join(''))];
    }
    if (review.recommended_segmented) {
      extra.recommended_replacement = { english: review.recommended_english, segmented: review.recommended_segmented };
    }
    fields.push({ ...shared, field, before: exercise[field], after: after[field], decision, ...extra });
  }
  rows.push({ ...shared, canonical_status: review.canonical, proposed_orders: review.additions.length,
    limitations: 'Not an exhaustive enumeration of all marked topic/focus orders; not certification of unchanged lesson taxonomy or related lexical rows.' });
}
for (const [name, data] of [['field-decisions', fields], ['row-reviews', rows], ['runtime-results', runtime]]) await writeFile(`${base}/${name}.jsonl`, data.map(x => JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify({ reviewed_rows: 126, canonical_approved: 124, pending: [866, 2167], additional_orders: runtime.length, integrated: false }));
