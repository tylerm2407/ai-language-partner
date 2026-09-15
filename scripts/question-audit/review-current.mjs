/** Attach prior independent decisions only to the exact values they reviewed.
 * This is evidence bookkeeping, not another content review. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = 'docs/audits/question-verification/remediation';
const sha = text => createHash('sha256').update(text).digest('hex');
const draftText = await readFile(`${base}/draft-patches.json`, 'utf8');
const draft = JSON.parse(draftText);
const originalText = await readFile(`${base}/reviewed-draft-4af708bccf87.json`, 'utf8');
if (sha(originalText) !== '4af708bccf879b758e4d2b445760a33ebe25829b014935df25afdab735a807f7') throw new Error('Historical reviewed draft changed');
const historicalPath = `${base}/nonlesson-review/field-decisions.jsonl`;
const extraPath = `${base}/nonlesson-review/additional-proposals-review.json`;
const oldDecisions = (await readFile(historicalPath, 'utf8')).trim().split('\n').map(line => ({ ...JSON.parse(line), evidence: historicalPath }));
const extra = JSON.parse(await readFile(extraPath, 'utf8'));
const decisions = [...oldDecisions, ...extra.field_decisions.map(x => ({ ...x, evidence: extraPath }))];
const ruCorrigendumPath = `${base}/nonlesson-review/ru-recipe-scope-corrigendum.json`;
const ruCorrigendum = JSON.parse(await readFile(ruCorrigendumPath, 'utf8'));
const originalRu = JSON.parse(originalText).patches.find(p => p.table === ruCorrigendum.table && p.id === ruCorrigendum.id);
if (sha(JSON.stringify(ruCorrigendum.after)) !== ruCorrigendum.after_sha256) throw new Error('Russian scope corrigendum hash changed');
decisions.push({ ...ruCorrigendum, before: originalRu.before[ruCorrigendum.field], decision: ruCorrigendum.narrowed_replacement_decision, evidence: ruCorrigendumPath });
const rootNarrowPath = `${base}/root-narrow-review/field-decisions.jsonl`;
for (const evidencePath of [rootNarrowPath, `${base}/es-root-review/field-decisions.jsonl`, `${base}/es-root-review/alternative-followup-field-decisions.jsonl`,
  `${base}/de-word-order-root-review/field-decisions.jsonl`, `${base}/de-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/ja-ko-root-review/field-decisions.jsonl`,
  `${base}/it-word-order-root-review/field-decisions.jsonl`, `${base}/it-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/de-followon-root-review/field-decisions.jsonl`,
  `${base}/de-followon-root-review/station-followup-field-decisions.jsonl`,
  `${base}/zh-word-order-root-review/field-decisions.jsonl`, `${base}/zh-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/fr-root-review/field-decisions.jsonl`,
  `${base}/pt-root-review/field-decisions.jsonl`,
  `${base}/ko-word-order-root-review/field-decisions.jsonl`, `${base}/ko-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/superlative-root-review/field-decisions.jsonl`, `${base}/superlative-root-review/followup-field-decisions.jsonl`,
  `${base}/food-tradition-root-review/field-decisions.jsonl`, `${base}/food-tradition-root-review/followup-field-decisions.jsonl`,
  `${base}/ru-root-review/field-decisions.jsonl`, `${base}/ru-root-review/followup-field-decisions.jsonl`,
  `${base}/fr-word-order-root-review/field-decisions.jsonl`,
  `${base}/pt-word-order-root-review/field-decisions.jsonl`,
  `${base}/ongoing-past-root-review/field-decisions.jsonl`, `${base}/ongoing-past-root-review/followup-field-decisions.jsonl`,
  `${base}/real-condition-root-review/field-decisions.jsonl`, `${base}/real-condition-root-review/followup-field-decisions.jsonl`,
  `${base}/es-ja-ko-age-root-review/field-decisions.jsonl`, `${base}/es-ja-ko-age-root-review/followup-field-decisions.jsonl`,
  `${base}/es-ja-ko-superlative-root-review/field-decisions.jsonl`, `${base}/es-ja-ko-superlative-root-review/followup-field-decisions.jsonl`,
  `${base}/ru-word-order-root-review/field-decisions.jsonl`, `${base}/ru-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/hypothetical-condition-root-review/field-decisions.jsonl`, `${base}/hypothetical-condition-root-review/followup-field-decisions.jsonl`,
  `${base}/es-ja-ko-progressive-root-review/field-decisions.jsonl`, `${base}/es-ja-ko-progressive-root-review/followup-field-decisions.jsonl`,
  `${base}/simple-text-root-review/field-decisions.jsonl`,
  `${base}/meal-order-root-review/field-decisions.jsonl`,
  `${base}/fr-controlled-root-review/field-decisions.jsonl`,
  `${base}/pt-controlled-root-review/field-decisions.jsonl`,
  `${base}/pt-targeted-root-review/field-decisions.jsonl`,
  `${base}/fallacy-root-review/field-decisions.jsonl`,
  `${base}/fr-targeted-root-review/field-decisions.jsonl`,
  `${base}/directions-ticket-root-review/field-decisions.jsonl`,
  `${base}/residual-context-root-review/field-decisions.jsonl`,
  `${base}/named-skill-context-root-review/field-decisions.jsonl`,
  `${base}/es-ja-ko-residual-root-review/field-decisions.jsonl`,
  `${base}/isolated-topic-root-review/field-decisions.jsonl`,
  `${base}/a2-age-root-review/field-decisions.jsonl`, `${base}/a2-age-root-review/followup-field-decisions.jsonl`,
  `${base}/ja-word-order-root-review/field-decisions.jsonl`, `${base}/ja-word-order-root-review/followup-field-decisions.jsonl`,
  `${base}/de-zh-followon-root-review/field-decisions.jsonl`,
  `${base}/fr-topic-root-review/field-decisions.jsonl`, `${base}/fr-topic-root-review/followup-field-decisions.jsonl`,
  `${base}/es-additional-root-review/field-decisions.jsonl`, `${base}/es-additional-root-review/followup-field-decisions.jsonl`,
  `${base}/age-birthday-root-review/field-decisions.jsonl`, `${base}/age-birthday-root-review/followup-field-decisions.jsonl`,
  `${base}/de-it-zh-hobby-music-root-review/field-decisions.jsonl`,
  `${base}/es-ja-ko-exact-topic-additional-root-review/field-decisions.jsonl`,
  `${base}/es-ja-ko-exact-topic-additional-root-review/followup-field-decisions.jsonl`,
  `${base}/es-ja-ko-exact-topic-root-review/field-decisions.jsonl`, `${base}/es-ja-ko-exact-topic-root-review/followup-field-decisions.jsonl`,
  `${base}/ru-controlled-root-review/field-decisions.jsonl`,
  `${base}/ru-targeted-root-review/field-decisions.jsonl`,
  `${base}/held-boundary-root-review/field-decisions.jsonl`, `${base}/held-boundary-root-review/followup-field-decisions.jsonl`,
  `${base}/phrasal-verb-root-review/field-decisions.jsonl`, `${base}/phrasal-verb-root-review/followup-field-decisions.jsonl`,
  `${base}/passage-word-count-root-review/field-decisions.jsonl`,
  `${base}/reading-3008-root-review/field-decisions.jsonl`, `${base}/reading-3008-root-review/followup-field-decisions.jsonl`,
  `${base}/de-alternatives-root-review/field-decisions.jsonl`, `${base}/de-alternatives-root-review/followup-field-decisions.jsonl`,
  `${base}/it-alternatives-root-review/field-decisions.jsonl`, `${base}/it-alternatives-root-review/followup-field-decisions.jsonl`,
  `${base}/it-option-collision-root-review/field-decisions.jsonl`,
  `${base}/zh-alternatives-root-review/field-decisions.jsonl`, `${base}/zh-alternatives-root-review/followup-field-decisions.jsonl`,
  `${base}/ko-goodbye-root-review/field-decisions.jsonl`,
  `${base}/ko-alternatives-root-review/field-decisions.jsonl`, `${base}/ko-alternatives-root-review/followup-field-decisions.jsonl`,
  `${base}/es-alternatives-root-review/field-decisions.jsonl`, `${base}/es-alternatives-root-review/followup-field-decisions.jsonl`,
  `${base}/it-cross-row-root-review/field-decisions.jsonl`, `${base}/it-cross-row-root-review/followup-field-decisions.jsonl`,
  `${base}/ja-alternatives-root-review/field-decisions.jsonl`, `${base}/ja-alternatives-root-review/followup-field-decisions.jsonl`,
  ...['checkpoint', 'writing', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'].map(x => `${base}/nonlesson-review/followup-${x}-decisions.jsonl`),
]) {
  try {
    decisions.push(...(await readFile(evidencePath, 'utf8')).trim().split('\n').filter(Boolean).map(line => ({ ...JSON.parse(line), evidence: evidencePath })));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const fields = [];
// An inserted row carries `before: null` — it has no prior values and no prior
// decisions, so every one of its fields lands on `awaiting_independent_review`,
// which is the correct status for authored-but-unreviewed content.
for (const patch of draft.patches) for (const [field, value] of Object.entries(patch.after)) {
  const prior = decisions.filter(x => x.table === patch.table && x.id === patch.id && x.field === field);
  const exactMatches = prior.filter(x => isDeepStrictEqual(x.before, patch.before?.[field]) && isDeepStrictEqual(x.after, value));
  // Follow-up approval may resolve a historical dependency on identical values.
  const exact = exactMatches.findLast(x => x.decision === 'approve_as_correction') ?? exactMatches.at(-1);
  let status = prior.length ? 'changed_since_independent_review' : 'awaiting_independent_review';
  let decision = exact;
  if (exact?.decision === 'approve_as_correction') status = 'exact_value_independently_approved';
  else if (exact?.decision === 'approve_with_dependency') status = 'exact_value_approved_pending_dependency';
  else if (exact) status = `independent_${exact.decision}`;
  if (!exact) {
    const requested = prior.find(x => x.decision === 'revise' && isDeepStrictEqual(x.before, patch.before?.[field]) && isDeepStrictEqual(x.recommended_after, value));
    if (requested) {
      status = 'reviewer_requested_revision_applied_pending_verification';
      decision = requested;
    }
    const recommended = prior.find(x => x.decision === 'revise' && x.recommended_nested_change?.path === 'starters[1]');
    if (recommended) {
      const revised = structuredClone(recommended.after);
      if (revised.starters[1] !== recommended.recommended_nested_change.from) throw new Error('Mismatched reviewer recommendation');
      revised.starters[1] = recommended.recommended_nested_change.to;
      if (isDeepStrictEqual(revised, value)) {
        status = 'reviewer_requested_revision_applied_pending_verification';
        decision = recommended;
      }
    }
  }
  fields.push({ table: patch.table, id: patch.id, field, after_sha256: sha(JSON.stringify(value)), status,
    evidence: decision?.evidence ?? null, prior_decision: decision?.decision ?? null,
    dependency: decision?.dependency ?? null });
}
const report = {
  draft_sha256: sha(draftText), snapshot_sha256: draft.snapshot_sha256,
  meaning: 'A field approval covers only the exact changed value. It is not approval of the entire question, its other fields, or pending dependencies. New/modified wording needs review.',
  patch_rows: draft.patches.length, changed_fields: fields.length,
  counts: fields.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {}), fields,
};
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--verify')) {
  if (await readFile(`${base}/current-review-status.json`, 'utf8') !== output) throw new Error('Current-review evidence is stale');
} else await writeFile(`${base}/current-review-status.json`, output);
console.log(JSON.stringify({ patch_rows: report.patch_rows, changed_fields: report.changed_fields, counts: report.counts }));
