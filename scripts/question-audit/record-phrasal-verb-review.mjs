/**
 * Independent review of the three-row Phrasal Verbs E2201 candidate.
 *
 * The whole lesson was reread in all three languages before deciding: it holds
 * idioms and proverbs only, and none of its 14 non-speaking rows asks for an
 * English verb+particle sense decision, so a candidate of this shape is
 * warranted. A record script is bookkeeping, not a review.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { phrasalVerbFixes, phrasalVerbRepairs } from './es-ja-ko-phrasal-verb-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/phrasal-verb-root-review';
const source = 'scripts/question-audit/es-ja-ko-phrasal-verb-fixes.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
if (sourceSha !== 'fa6ebe22fc38750fe05ad40ccd268fffe434bc38bbdeae14134c7cd488e22e01') throw Error('Unreviewed source');

const set = await createPatchSet();
phrasalVerbFixes(set);

const SLOT_JUSTIFICATION =
  'Independently confirmed on the frozen snapshot. All three Phrasal Verbs lessons (B2, unit "Idiomatic Expressions", lesson order 4) contain idiom and proverb glosses only, with no English verb+particle sense decision anywhere. E2201 is the right slot to reuse: its superseded gloss Better late than never is still tested by the untouched E2211 listening_type and E2212 listening_choice pair in every language, so no content is lost. The lesson title continues to overstate its contents; one row does not make the lesson a phrasal-verb lesson, and that remains open.';

const ROW_NOTES = new Map([
  ['es-E2201', 'Key verified: aplazar is the standard rendering of put off as postpone, and aplazar ... hasta is attested. The three distractors render the other put-senses correctly (cancelar = call off, aguantar = put up with, guardar = put away) and none of them renders put off, so exactly one option is correct. Register: tendremos que directly renders we will have to and is natural at B2. Four long near-identical tap options are well precedented in this curriculum (170 frozen multiple_choice rows carry an option of 25 characters or more, and 13 frozen sets share a common prefix of 10 or more characters across all four options), so option length is not treated as a defect here.'],
  ['ja-E2201', 'Key verified: kaigi wo raishu ni enki suru is natural and the ni particle is correct for the new date. The explanation correctly offers saki-nobashi ni suru as an equally natural alternative and correctly disclaims English verb-plus-particle morphology. Register is consistent formal -nakereba narimasen throughout. See the separate decision on the option set.'],
  ['ko-E2201', 'Key verified: hoeuireul daeum juro mirueoya haeyo is natural and the -ro particle is correct for the new date. The explanation correctly offers yeongihada as an alternative and correctly disclaims English verb-plus-particle morphology. Haeyoche is used consistently across all four options; haeyoche is slightly informal for a workplace line where hamnida would also fit, but it is defensible at B2 and the sense decision does not depend on it. See the separate decision on the option set.'],
]);

const ILL_FORMED = lang => ({
  decision: 'revise',
  rationale:
    `The key is correct and the intended senses are right, but the shared time phrase makes three of the four options ill-formed rather than merely wrong in meaning. Each distractor keeps the key's slot frame, which the distractor verbs do not license: ${lang.examples} A learner can therefore eliminate all three on collocation grounds without knowing what put off means, so the row credits target-language grammar instead of the verb+particle sense it claims to test. That matters because these rows feed measured proficiency. Recommend giving each distractor its own well-formed complement so the choice turns on meaning; the key is unchanged and exactly one option stays correct. This is an improvable weakness, not a wrong answer: the row never mis-grades a learner who does know the senses.`,
  recommended_after: lang.recommended,
  sources: lang.sources,
});

const FIELD_OVERRIDES = new Map([
  ['ja-E2201.options', ILL_FORMED({
    examples: 'chushi suru does not take a "ni" date complement in this sense, gaman suru does not take kaigi wo with raishu ni at all, and katazukeru does not take a meeting as its object.',
    recommended: [
      '会議を来週に延期しなければなりません。',
      '会議を中止しなければなりません。',
      '会議が終わるまで我慢しなければなりません。',
      '会議室を片付けなければなりません。',
    ],
    sources: ['https://dictionary.goo.ne.jp/word/%E5%BB%B6%E6%9C%9F/', 'https://dictionary.goo.ne.jp/word/%E7%89%87%E4%BB%98%E3%81%91%E3%82%8B/'],
  })],
  ['ko-E2201.options', ILL_FORMED({
    examples: 'chwisohada does not take a -ro destination, chamda does not take hoeuireul with daeum juro, and chiuda does not take a meeting as its object.',
    recommended: [
      '회의를 취소해야 해요.',
      '회의가 끝날 때까지 참아야 해요.',
      '회의를 다음 주로 미뤄야 해요.',
      '회의실을 치워야 해요.',
    ],
    sources: ['https://stdict.korean.go.kr/search/searchView.do?word_no=452266', 'https://stdict.korean.go.kr/search/searchView.do?word_no=505243'],
  })],
]);

const SKILL_TYPE_NOTE = {
  decision: 'revise',
  recommended_after: 'vocabulary',
  rationale:
    'Valid but pedagogically worse than the frozen value. "mixed" is permitted by exercises_skill_type_check (migrations 017 and 035 allow vocabulary, grammar, mixed), but it appears on none of the 23,976 frozen exercises, whose skill_type is only vocabulary or grammar, so this batch would introduce the value to the curriculum. It also changes learner-visible behaviour: lib/grading.ts classifyError treats skillType === "vocabulary" as a lexical signal, so a wrong tap on this row currently yields a lexical error category and would yield no category under "mixed". The task is a verb-sense decision, which is exactly a lexical one. Recommend leaving skill_type at vocabulary; nothing else in the row depends on the change.',
  sources: [
    'supabase/migrations/035_schema_reconciliation.sql:157-159 exercises_skill_type_check',
    'lib/grading.ts classifyError lexicalSignal',
  ],
};
for (const ref of ['es-E2201', 'ja-E2201', 'ko-E2201']) FIELD_OVERRIDES.set(`${ref}.skill_type`, SKILL_TYPE_NOTE);

const idmap = new Map();
for (const p of phrasalVerbRepairs) {
  const c = lessonRefs(set.snapshot, p.language)(p.n);
  idmap.set(c.exercise.id, { ref: c.ref, lang: p.language, full: c, oldKey: p.oldKey });
}

const rows = [], fields = [];
for (const patch of set.patches()) {
  const meta = idmap.get(patch.id);
  if (!meta) throw Error(`Unexpected patch outside the reviewed batch: ${patch.id}`);
  const { ref, full, oldKey } = meta;
  const rowNote = ROW_NOTES.get(ref);
  if (!rowNote) throw Error(`No independent rationale recorded for ${ref}`);
  rows.push({
    ref, table: 'exercises', id: patch.id, language: meta.lang,
    cefr_level: full.course.cefr_level,
    unit: { title: full.unit.title, description: full.unit.description, order_index: full.unit.order_index },
    lesson: { id: full.lesson.id, title: full.lesson.title, description: full.lesson.description, order_index: full.lesson.order_index },
    frozen_type: full.exercise.type,
    superseded_gloss: oldKey,
    slot_justification: SLOT_JUSTIFICATION,
    replacement_rationale: rowNote,
    before: patch.before,
    after: patch.after,
  });
  for (const [field, after] of Object.entries(patch.after)) {
    const override = FIELD_OVERRIDES.get(`${ref}.${field}`);
    fields.push({
      reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: patch.id, field,
      before: patch.before[field], after,
      decision: override?.decision ?? 'approve_as_correction',
      rationale: override?.rationale ?? `${SLOT_JUSTIFICATION} ${rowNote}`,
      source_sha256: sourceSha,
      ...(override?.recommended_after !== undefined ? { recommended_after: override.recommended_after } : {}),
      ...(override?.sources ? { sources: override.sources } : {}),
    });
  }
}
if (rows.length !== 3) throw Error(`Expected three reviewed rows, got ${rows.length}`);

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  source, source_sha256: sourceSha, slot_justification: SLOT_JUSTIFICATION, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
const evidenceSha = sha(body);
await writeFile(`${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n');

const tally = fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {});
console.log(JSON.stringify({
  rows: rows.length, fields: fields.length, tally,
  not_approved: fields.filter(f => f.decision !== 'approve_as_correction').map(f => `${f.ref}.${f.field} (${f.decision})`),
}));
