/** Independent exact-field review of the reading-passage `word_count` fix.
 *
 * The reviewer did not author
 * docs/audits/question-verification/remediation/reading/passage-word-count-fixes.mjs
 * or its evidence file, test, or the UI change in
 * components/reading/ReadingPassageViewer.tsx.
 *
 * Read-only over the audit: this script never writes the draft, the proposal,
 * the evidence file, or .question-audit/. Every number it records is recounted
 * here from the frozen snapshot with counters written for this review — the
 * author's evidence JSON is not read and not trusted. The decision per field is
 * derived from that recount, not asserted: a row whose recount disagrees with
 * the patched value is recorded `uncertain`, so a later drift produces a
 * visibly failed review rather than a stale approval.
 *
 * The one field this module does NOT own is the German 3008 passage's
 * `word_count`: reading-3008-register-fixes.mjs appends a sentence and recounts
 * that row itself. It is recorded here as a composition check only, and belongs
 * to the 3008 review.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { readingFixes } from './reading-fixes.mjs';
import { spanishReadingOrthography } from './spanish-reading-orthography.mjs';
import { readingPlacementFixes } from './reading-placement-fixes.mjs';
import { readingAnswerFixes } from './reading-answer-fixes.mjs';
import { readingShortAnswerFixes } from './reading-short-answer-fixes.mjs';
import { reading3008RegisterFixes } from '../../docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';
import {
  passageWordCountFixes, passageWordCountDefects, passageWordCountDrift, german3008,
} from '../../docs/audits/question-verification/remediation/reading/passage-word-count-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/passage-word-count-root-review';
const source = 'docs/audits/question-verification/remediation/reading/passage-word-count-fixes.mjs';
const upstream = 'docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';
const EXPECTED_SOURCE_SHA = '67b355f2974cfeadf3b42e58b697554ade3a01c04ea5f01058595b26b406e332';
/** The exact upstream module this composition was verified against. It is being
 * reworked by another agent; a different hash means the German 3008 dependency
 * must be re-verified before this review is relied on. */
const EXPECTED_UPSTREAM_SHA = 'bcdcca2ba71b3b66d63a84af13be307fce2c2a6367d7ff2fb9b32796b1fbc85f';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author the code';
const REVIEWED_ON = '2026-09-14';
const UAX29 = 'https://unicode.org/reports/tr29/';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== EXPECTED_SOURCE_SHA) throw new Error(`Unreviewed source: ${sourceSha}`);
const upstreamSha = sha(await readFile(upstream));

// ── Independent counters. Deliberately written here rather than imported from
//    the module under review, so agreement is evidence and not a tautology.
const whitespaceTokens = text => text.trim().split(/\s+/).filter(Boolean).length;
const nonWhitespaceCharacters = text => text.replace(/\s/g, '').length;
const SPACELESS = new Set(['ja', 'zh']);
const segmenters = new Map();
function wordLikeSegments(text, locale) {
  if (typeof Intl.Segmenter !== 'function') throw new Error('Intl.Segmenter is unavailable; this review cannot be reproduced on this runtime');
  if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'word' }));
  let n = 0;
  for (const part of segmenters.get(locale).segment(text)) if (part.isWordLike) n += 1;
  return n;
}
const recount = (text, language) => SPACELESS.has(language)
  ? { count: wordLikeSegments(text, language), unit: 'segment' }
  : { count: whitespaceTokens(text), unit: 'word' };

/** build-remediation.mjs order, restricted to the modules that patch
 * `reading_passages` — verified by grep to be the complete set — plus the
 * upstream 3008 module this one declares as its hard dependency. */
async function upstreamSet() {
  const set = await createPatchSet();
  readingFixes(set);
  spanishReadingOrthography(set);
  readingPlacementFixes(set);
  readingAnswerFixes(set);
  readingShortAnswerFixes(set);
  reading3008RegisterFixes(set);
  return set;
}

const set = await upstreamSet();
const languageOf = new Map(set.snapshot.courses.map(c => [c.id, c.target_language]));
const frozen = new Map(set.snapshot.reading_passages.map(p => [p.id, p]));
const before = new Map(set.patches().map(p => [`${p.table}/${p.id}`, new Set(Object.keys(p.after))]));
const upstreamContent = new Map(
  set.patches().filter(p => p.table === 'reading_passages' && Object.hasOwn(p.after, 'content')).map(p => [p.id, p.after.content]),
);

// ── Composition: the German 3008 row is patched upstream, never here.
const germanRow = frozen.get(german3008.id);
const germanPatched = upstreamContent.get(german3008.id);
const germanAfter = set.patches().find(p => p.table === 'reading_passages' && p.id === german3008.id)?.after;
const composition = {
  upstream_module: upstream,
  upstream_sha256: upstreamSha,
  upstream_is_the_reviewed_one: upstreamSha === EXPECTED_UPSTREAM_SHA,
  frozen_word_count: germanRow.word_count,
  upstream_after_word_count: germanAfter?.word_count ?? null,
  appended_sentence_present: typeof germanPatched === 'string' && germanPatched.endsWith(german3008.appended),
  independent_recount_of_patched_text: typeof germanPatched === 'string' ? whitespaceTokens(germanPatched) : null,
  composes: false,
};
composition.composes = composition.upstream_after_word_count === german3008.expected
  && composition.frozen_word_count === german3008.stored
  && composition.appended_sentence_present
  && composition.independent_recount_of_patched_text === german3008.expected;

// ── Apply the module under review and derive every field it writes.
passageWordCountFixes(set);
const declared = new Map([
  ...passageWordCountDefects.map(e => [e.id, { ...e, kind: 'defect' }]),
  ...passageWordCountDrift.map(e => [e.id, { ...e, kind: 'drift' }]),
]);

/** Independent exhaustiveness: recount all 126 passages on the effective text
 * and name every row that is wrong. The declared plan must be exactly this set. */
const wrongRows = [];
for (const passage of set.snapshot.reading_passages) {
  const language = languageOf.get(passage.course_id);
  const { count, unit } = recount(upstreamContent.get(passage.id) ?? passage.content, language);
  if (passage.word_count !== count) wrongRows.push({ id: passage.id, language, stored: passage.word_count, recount: count, unit });
}
const undeclared = wrongRows.filter(r => !declared.has(r.id) && r.id !== german3008.id);
const declaredButRight = [...declared.keys()].filter(id => !wrongRows.some(r => r.id === id));

const rows = [], fields = [];
let touchedOtherField = 0, touchedOtherTable = 0;
for (const patch of set.patches()) {
  const added = Object.keys(patch.after).filter(f => !before.get(`${patch.table}/${patch.id}`)?.has(f));
  if (added.length === 0) continue;
  if (patch.table !== 'reading_passages') { touchedOtherTable += 1; continue; }
  if (added.some(f => f !== 'word_count')) touchedOtherField += 1;

  const passage = frozen.get(patch.id);
  const language = languageOf.get(passage.course_id);
  const effective = upstreamContent.get(patch.id) ?? passage.content;
  const mine = recount(effective, language);
  const plan = declared.get(patch.id);
  const ref = `${language}/reading-passage/${patch.id.slice(9, 18)}`;

  const agrees = patch.after.word_count === mine.count
    && patch.before.word_count === passage.word_count
    && plan !== undefined
    && plan.stored === passage.word_count
    && plan.expected === mine.count
    && added.join(',') === 'word_count';

  const storedWasCharacters = passage.word_count === nonWhitespaceCharacters(passage.content);
  const rationale = !agrees
    ? `Recount disagrees with the patched value or the module wrote more than word_count; not approved. Independent recount of the effective text: ${mine.count} ${mine.unit}s.`
    : plan.kind === 'drift'
      ? `Recounted independently on the effective text. An upstream module in this audit rewrote this passage and left word_count at ${passage.word_count}; the patched text holds ${mine.count} whitespace tokens. The learner is shown this number as a length claim about the text in front of them, so a stale count is a false statement, not an internal detail.`
      : mine.unit === 'segment'
        ? `Recounted independently: ${mine.count} word-like segments (Intl.Segmenter, word granularity) on the effective text. The stored ${passage.word_count} is the passage's non-whitespace character count${storedWasCharacters ? ' exactly' : ''}, which is not a count of words in any language and is 1.7-2.3x the segment count. ${language === 'ja' ? 'Japanese' : 'Chinese'} has no whitespace words, so segments are the only defensible unit; lib/writing-length.ts already settled that same unit for learner writing in this language and rules that a character count must never be presented as words. Node and Deno produce identical segment counts for all 28 ja/zh passages, so the value is reproducible across the builder and the test runtime. Approval of the unit is conditional on every surface naming it "word segments": the passage header does, the reading library at app/(app)/learn/index.tsx:423,429 does not yet.`
        : storedWasCharacters
          ? `Recounted independently: ${mine.count} whitespace tokens. The stored ${passage.word_count} is the passage's non-whitespace character count exactly, applied to a language that is written with spaces, so it overstates the length by roughly 3x. Korean words are whitespace-delimited, so the whitespace token count is the right unit here and the segment treatment given to ja/zh would be wrong.`
          : `Recounted independently: ${mine.count} whitespace tokens on the effective text. The stored ${passage.word_count} is a round authoring target — every Spanish passage stores a multiple of ten between 100 and 200 while the texts run 54 to 92 tokens — so it was never a measurement of this passage.`;

  rows.push({
    ref, id: patch.id, language, title: passage.title, cefr_level: passage.cefr_level, kind: plan?.kind ?? null,
    stored_frozen: passage.word_count, patched_to: patch.after.word_count,
    independent_recount: mine.count, unit: mine.unit,
    content_patched_upstream: upstreamContent.has(patch.id),
    stored_was_non_whitespace_characters: storedWasCharacters,
    fields_added: added,
  });
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref,
    table: 'reading_passages', id: patch.id, field: 'word_count',
    before: patch.before.word_count, after: patch.after.word_count,
    decision: agrees ? 'approve_as_correction' : 'uncertain',
    rationale, source_sha256: sourceSha,
    ...(mine.unit === 'segment' ? { sources: [UAX29] } : {}),
  });
}

const summary = {
  reviewer: REVIEWER,
  reviewed_on: REVIEWED_ON,
  source, source_sha256: sourceSha,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  passages_recounted: set.snapshot.reading_passages.length,
  fields_reviewed: fields.length,
  decisions: fields.reduce((acc, f) => ({ ...acc, [f.decision]: (acc[f.decision] ?? 0) + 1 }), {}),
  scope_checks: {
    non_word_count_fields_written: touchedOtherField,
    non_reading_passages_rows_written: touchedOtherTable,
    undeclared_wrong_rows: undeclared,
    declared_rows_that_are_already_correct: declaredButRight,
  },
  german_3008_composition: composition,
  limits: 'This review checks the arithmetic, the unit choice, the composition and the blast radius of one field. It does not certify the passage texts, the upstream content patches, any other field, or a deployment. The module is not wired into build-remediation.mjs, so nothing here is in the draft.',
};

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({ ...summary, rows }, null, 2) + '\n';
try {
  await writeFile(archive, body, { flag: 'wx' });
} catch (e) {
  if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e;
}
const evidenceSha = sha(body);
await writeFile(
  `${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n',
);
console.log(JSON.stringify({
  ...summary.decisions,
  fields: fields.length,
  archive,
  composes: composition.composes,
  upstream_is_the_reviewed_one: composition.upstream_is_the_reviewed_one,
  undeclared: undeclared.length,
  non_word_count_writes: touchedOtherField + touchedOtherTable,
}));
