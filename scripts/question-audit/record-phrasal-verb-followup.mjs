/**
 * Follow-up review of the five Phrasal Verbs fields revised after
 * phrasal-verb-root-review (2026-09-14).
 *
 * Covers skill_type on all three E2201 rows and the JA/KO option sets. The
 * original 15-field record in field-decisions.jsonl is not rewritten. A drift
 * check re-derives all three rows and fails if anything outside the revised
 * fields moved.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as eq } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { phrasalVerbFixes, phrasalVerbRepairs } from './es-ja-ko-phrasal-verb-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/phrasal-verb-root-review';
const source = 'scripts/question-audit/es-ja-ko-phrasal-verb-fixes.mjs';
const PRIOR_SOURCE_SHA = 'fa6ebe22fc38750fe05ad40ccd268fffe434bc38bbdeae14134c7cd488e22e01';
const NEW_SOURCE_SHA = 'e2aa22a677efa8efb2f20bace17dc73d60d3536c16c0d486f11884ec2a04e8cd';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
if (sourceSha !== NEW_SOURCE_SHA) throw Error(`Unreviewed source: ${sourceSha}`);

const set = await createPatchSet();
phrasalVerbFixes(set);

const idmap = new Map();
for (const p of phrasalVerbRepairs) {
  const c = lessonRefs(set.snapshot, p.language)(p.n);
  idmap.set(c.exercise.id, { ref: c.ref, full: c });
}

const prior = new Map(
  JSON.parse(await readFile(`${base}/reviewed-source-${PRIOR_SOURCE_SHA.slice(0, 12)}.json`, 'utf8')).rows.map(r => [r.ref, r.after])
);
const REVISED = new Set(['es-E2201.skill_type', 'ja-E2201.skill_type', 'ko-E2201.skill_type', 'ja-E2201.options', 'ko-E2201.options']);
const patches = set.patches();
if (patches.length !== 3) throw Error(`Expected three rows, got ${patches.length}`);
const drift = [];
for (const patch of patches) {
  const { ref } = idmap.get(patch.id);
  const before = prior.get(ref);
  for (const field of new Set([...Object.keys(before), ...Object.keys(patch.after)])) {
    if (!eq(before[field], patch.after[field]) && !REVISED.has(`${ref}.${field}`)) drift.push(`${ref}.${field}`);
  }
}
if (drift.length) throw Error(`Fields moved outside the revised set: ${drift.join(', ')}`);

const SKILL_TYPE_RATIONALE =
  'Applied exactly as recommended. skill_type is now equal to the frozen "vocabulary", so the field is no longer emitted as a patch and the novel "mixed" value is gone from the batch. The lexical signal that classifyError in lib/grading.ts derives from skillType === "vocabulary" is preserved, so a wrong tap still yields a lexical error category — which is the right category for a verb-sense decision. The author additionally confirmed that concurrent edits to lib/grading.ts sit only inside gradeAnswer and so do not touch classifyError, which closes the one way this reasoning could have gone stale.';

const OPTIONS_RATIONALE = lang =>
  `Approved on its merits; this is NOT my recommended string and the author's objection to mine is correct, so I withdraw my version rather than revert to it. My set left the time phrase in the key alone, which lets a learner match the English "until next week" and pick the key on one A1 word without reading any verb. That is a cheaper shortcut than the collocation one I removed, which at least required B2 intuition about three verbs, so my strings traded a harder shortcut for an easier one and were strictly worse. Every option in the new set carries both the time phrase and the meeting token, verified programmatically, so surface matching now discriminates nothing. It is better than parity: the options marked "until"/"by" (${lang.until}) are all distractors, so a naive match on "until next week" is actively misleading rather than helpful. Each distractor now carries its own licensed complement: ${lang.licensed} Verified with the real gradeAnswer that the four options are unique and exactly one grades correct, with the key at its original index. Two residuals are recorded and neither is a defect: the key remains the only option where the date is a destination argument (${lang.destination}), but that cue IS the postponement sense being tested rather than a way around it; and ${lang.endure} leaves the endured thing implicit, which is grammatical and idiomatic though slightly contextless read standalone.`;

const DECISIONS = [
  { ref: 'es-E2201', field: 'skill_type', decision: 'approve_as_correction', rationale: SKILL_TYPE_RATIONALE,
    sources: ['supabase/migrations/035_schema_reconciliation.sql:157-159 exercises_skill_type_check', 'lib/grading.ts classifyError lexicalSignal'] },
  { ref: 'ja-E2201', field: 'skill_type', decision: 'approve_as_correction', rationale: SKILL_TYPE_RATIONALE,
    sources: ['supabase/migrations/035_schema_reconciliation.sql:157-159 exercises_skill_type_check', 'lib/grading.ts classifyError lexicalSignal'] },
  { ref: 'ko-E2201', field: 'skill_type', decision: 'approve_as_correction', rationale: SKILL_TYPE_RATIONALE,
    sources: ['supabase/migrations/035_schema_reconciliation.sql:157-159 exercises_skill_type_check', 'lib/grading.ts classifyError lexicalSignal'] },
  {
    ref: 'ja-E2201', field: 'options', decision: 'approve_as_correction',
    rationale: OPTIONS_RATIONALE({
      until: 'まで on the 我慢 option and までに on the 片付ける option',
      licensed: '来週の会議 is an ordinary noun modifier and 中止する takes 会議を; 〜まで我慢する is a standard duration collocation; and 来週までに correctly uses the deadline particle まで+に with 会議室を片付ける. The まで / までに contrast between those last two is handled correctly.',
      destination: '来週に with 延期する',
      endure: 'the 我慢 option',
    }),
    sources: ['https://dictionary.goo.ne.jp/word/%E5%BB%B6%E6%9C%9F/', 'https://dictionary.goo.ne.jp/word/%E6%88%91%E6%85%A2/'],
  },
  {
    ref: 'ko-E2201', field: 'options', decision: 'approve_as_correction',
    rationale: OPTIONS_RATIONALE({
      until: '까지 on the 참다 option and on the 치우다 option',
      licensed: '다음 주 회의 is an ordinary noun-noun modifier and 취소하다 takes 회의를; 〜까지 참다 is a standard duration collocation; and 다음 주까지 is the deadline reading with 회의실을 치우다. Haeyoche is consistent across all four options.',
      destination: '다음 주로 with 미루다',
      endure: 'the 참다 option',
    }),
    sources: ['https://stdict.korean.go.kr/search/searchView.do?word_no=452266', 'https://stdict.korean.go.kr/search/searchView.do?word_no=505243'],
  },
];

const rows = DECISIONS.map(d => {
  const entry = [...idmap.entries()].find(([, v]) => v.ref === d.ref);
  if (!entry) throw Error(`Unknown ref ${d.ref}`);
  const [id, { full }] = entry;
  const patch = patches.find(p => p.id === id);
  const frozen = set.row('exercises', id)[d.field];
  const emitted = Object.hasOwn(patch.after, d.field);
  return {
    ...d, table: 'exercises', id, language: full.course.target_language, lesson: full.lesson.title,
    reviewed_previously_as: prior.get(d.ref)[d.field],
    now_emitted: emitted,
    after: emitted ? patch.after[d.field] : frozen,
    frozen_value: frozen,
  };
});

const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, follow_up_to: `reviewed-source-${PRIOR_SOURCE_SHA.slice(0, 12)}.json`,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  source, source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
  scope: 'Only the fields revised after the original review. All other approved fields re-derived and confirmed byte-identical.',
  rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
const evidenceSha = sha(body);

// `before` must be what the emitted patch actually replaces, so the ledger can
// match a decision to a patch on the exact (before, after) pair. That is the
// FROZEN row value, not the author's intermediate proposal — for these rows the
// frozen value is the superseded idiom option set. Where this review withdrew a
// field back to its frozen value no patch is emitted at all, so there is nothing
// to replace and the prior proposal stays as `before` to keep the line
// self-describing. The intermediate proposal is preserved either way in
// `superseded_proposal`, so the trail from the original `revise` through to this
// approval stays legible.
const lines = rows.map(r => {
  const before = r.now_emitted ? r.frozen_value : r.reviewed_previously_as;
  return JSON.stringify({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref: r.ref, table: r.table, id: r.id, field: r.field,
    before, after: r.after,
    ...(eq(before, r.reviewed_previously_as) ? {} : { superseded_proposal: r.reviewed_previously_as }),
    decision: r.decision, rationale: r.rationale,
    source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
    evidence: archive, evidence_sha256: evidenceSha, sources: r.sources, now_emitted: r.now_emitted,
  });
});
await writeFile(`${base}/followup-field-decisions.jsonl`, lines.join('\n') + '\n');

console.log(JSON.stringify({
  rows_rederived: patches.length, drift_outside_revised_fields: drift.length,
  followup_fields: lines.length,
  tally: rows.reduce((a, r) => ({ ...a, [r.decision]: (a[r.decision] ?? 0) + 1 }), {}),
  not_approved: rows.filter(r => r.decision !== 'approve_as_correction').map(r => `${r.ref}.${r.field}`),
}));
