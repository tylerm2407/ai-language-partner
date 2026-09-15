/** Independent review of the five INSERTED 3008 register questions.
 *
 * Follow-up to record-reading-3008-register-review.mjs, which reviewed the
 * earlier update-based draft of the same module. That draft displaced one
 * retrieval question per language; this one inserts instead, so all five
 * register questions are new rows and no existing reading_question is touched.
 * Reviewer is independent of the author. Read-only over the audit.
 *
 * Inserted rows carry `before: null`, so each decision is recorded against the
 * after-value alone and deliberately OMITS a `before` key: review-current.mjs
 * compares `x.before` with `patch.before?.[field]`, which is `undefined` for an
 * insert, and a literal `null` would fail that comparison and silently leave
 * the field at awaiting_independent_review.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { readingFixes } from './reading-fixes.mjs';
import { spanishReadingOrthography } from './spanish-reading-orthography.mjs';
import { readingPlacementFixes } from './reading-placement-fixes.mjs';
import { readingAnswerFixes } from './reading-answer-fixes.mjs';
import { readingShortAnswerFixes } from './reading-short-answer-fixes.mjs';
import { reading3008RegisterFixes, reading3008Register } from '../../docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';
import { passageWordCountFixes } from '../../docs/audits/question-verification/remediation/reading/passage-word-count-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/reading-3008-root-review';
const source = 'docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const CEFR = 'https://rm.coe.int/1680459f97';
const PRIOR_SOURCE_SHA = '2f6cf459174df4a339edc36ff667edd9c6ccecf1b8f1979484b85ebf8c825a99';
/** The insert-based module as first reviewed, carrying the `você` distractor. */
const PRE_REVISION_SOURCE_SHA = 'bcdcca2ba71b3b66d63a84af13be307fce2c2a6367d7ff2fb9b32796b1fbc85f';
/** The exact Portuguese options array as it stood when I asked for the revision.
 * Pinned so the superseded decision stays reproducible after the source moved. */
const PT_SUPERSEDED_OPTIONS = [
  'With tu commands, e.g. "Faz desporto todos os dias!": informal speech',
  'With você, e.g. "Você deve praticar desporto": polite address',
  'Impersonally, e.g. "A prática regular de desporto é essencial": neutral, formal written style',
  'With slang, e.g. "Bora lá, pá!": very informal speech',
];

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha === PRIOR_SOURCE_SHA) throw new Error('Source is still the earlier update-based draft; nothing new to review');

async function buildSet() {
  const set = await createPatchSet();
  readingFixes(set); spanishReadingOrthography(set); readingPlacementFixes(set);
  readingAnswerFixes(set); readingShortAnswerFixes(set);
  return set;
}
const beforeSet = await buildSet();
const beforeCount = beforeSet.patches().length;
const beforeQuestionUpdates = beforeSet.patches().filter(p => p.table === 'reading_questions').map(p => p.id).sort().join();

const set = await buildSet();
reading3008RegisterFixes(set);
const afterModule = set.patches();
if (afterModule.length !== beforeCount + 6) throw new Error(`Expected 5 inserts + 1 German passage update, got ${afterModule.length - beforeCount}`);
const afterQuestionUpdates = afterModule.filter(p => p.table === 'reading_questions' && p.op !== 'insert').map(p => p.id).sort().join();
if (afterQuestionUpdates !== beforeQuestionUpdates) throw new Error('Module updated an existing reading_questions row');

// Compose the word-count producer that runs later in build-remediation.mjs.
passageWordCountFixes(set);
const patches = set.patches();
const DE_PASSAGE = 'aabbccdd-3333-3008-a001-000000000000';
const dePatch = patches.find(p => p.table === 'reading_passages' && p.id === DE_PASSAGE);
if (dePatch.after.word_count !== 92) throw new Error(`German word_count no longer composes to 92: ${dePatch.after.word_count}`);
if (dePatch.after.content.split(/\s+/).filter(Boolean).length !== 92) throw new Error('German content is not 92 whitespace tokens');
if (dePatch.reasons.length !== 1) throw new Error(`Another producer also wrote the German 3008 passage: ${dePatch.reasons.length} reasons`);

const inserts = patches.filter(p => p.op === 'insert');
if (inserts.length !== 5) throw new Error(`Expected 5 inserted rows, got ${inserts.length}`);
const INSERT_COLUMNS = ['accepted_answers', 'correct_answer', 'options', 'order_index', 'passage_id', 'question_text', 'question_type'];
for (const row of inserts) {
  if (row.before !== null) throw new Error(`Insert ${row.id} does not carry before: null`);
  if (Object.keys(row.after).sort().join() !== INSERT_COLUMNS.join()) throw new Error(`Unexpected columns on ${row.id}`);
  const siblings = set.snapshot.reading_questions.filter(q => q.passage_id === row.after.passage_id);
  if (siblings.length !== 2 || siblings.some(q => q.order_index === row.after.order_index)) throw new Error(`order_index collision or unexpected siblings: ${row.id}`);
}
const insertIds = inserts.map(p => p.id);
if (new Set(insertIds).size !== 5) throw new Error('Derived insert ids are not unique');
const snapshotIds = new Set(Object.values(set.snapshot).filter(Array.isArray).flatMap(rows => rows.map(r => r.id)));
for (const id of insertIds) if (snapshotIds.has(id)) throw new Error(`Derived id collides with the frozen snapshot: ${id}`);

const byLanguage = new Map(reading3008Register.map(item => [item.language, item]));
const insertOf = lang => inserts.find(p => p.after.passage_id === byLanguage.get(lang).passage);

/** Independent register reading, language by language. */
const REGISTER_READING = {
  es: 'No address of any kind: impersonal infinitive subject ("Hacer ejercicio regularmente es esencial"), third-person attribution ("Los expertos recomiendan"), agentless statements ("Reduce el estres, mejora el sueno"). No tu, no usted, no imperative, no exclamation mark, no first-person form at all. The cleanest of the five.',
  fr: 'The final sentence addresses the reader with vous and a concessive subjunctive after que: "Que vous preferiez marcher dans les parcs parisiens ou nager a la piscine municipale". Correct and idiomatic. vous is the only address form anywhere in the passage, so scoping the stem to the last sentence is precise.',
  de: 'The frozen passage has no address form at all, generalising with inclusive wir. The appended sentence is the only address in the text, so the last-sentence stem is precise. The sentence itself is natural, grammatical B1: verb-final subordinate clause, correct Sie-imperative, correct dative genders after mit, idiomatic "mit dem Sport beginnen", standard gender-inclusive doubling.',
  it: 'No address form: "camminare tutti i giorni e sufficiente" is an impersonal infinitive construction, and there is no tu, no Lei, no imperative, no exclamation mark. The closing sentence uses inclusive first person plural ("quando combiniamo lo sport"), which is not a form of address, so the stem\'s "if any" now covers it honestly. This resolves the reservation I raised against the earlier draft, whose stem presupposed an address.',
  pt: 'Formal written European Portuguese throughout, and it never addresses the reader. Agentless nominalised subject ("A pratica regular de desporto e essencial"), a named institution as subject ("A Organizacao Mundial de Saude recomenda"), the formal correlative "Tanto os jovens como os adultos", the connective "Alem disso", and enclisis in "exercitar-se", which is the European Portuguese written norm. I re-verified that tu, Tu, voce, Voce, voces, senhor, Senhor, senhora, faz, Faz, pa and bora are all absent, and that the passage contains no exclamation mark.',
};

const OPTIONS_RATIONALE = {
  es: 'Four distinct options, one key, three distractors whose forms are literally absent from the effective passage; I re-ran the absence check on the effective text. Labels checked form by form: haz is the correct tu imperative of hacer and is informal; "Usted debe hacer ejercicio" is formal polite address; "¡Venga, tio!" is very informal. The key now quotes the impersonal infinitive that opens the passage rather than the attribution clause, which is the revision I requested against the earlier draft, and it makes Spanish consistent with the Italian sibling. Residual note, unchanged and minor: tio is Peninsular-specific while the passage leans Latin American ("andar en bicicleta"); it is an absent-form distractor, so the stakes are low.',
  fr: 'Four distinct options, one key, three distractors absent from the passage. Labels checked: correct tu forms in "Si tu preferes"; correct man-equivalent generic on in "Si on prefere"; "Allez, bouge-toi, mec !" is correctly very informal and correctly spaced before the exclamation mark. Residual note, unchanged: on is labelled impersonal, which is true of the generic example quoted but not of spoken on meaning "we".',
  de: 'Four distinct options, one key, three distractors absent. Every invented example is grammatically correct: du + mochtest + sprich, ihr + mochtet + sprecht, man + 3sg. Lowercase ihr is absent; the appended sentence does contain capitalised Ihrem/Ihrer, which makes the ihr distractor a genuine and appropriate B1 discrimination rather than a trap, because the key quotes "sprechen Sie bitte".',
  it: 'Four distinct options, one key, three distractors absent. Labels checked: cammina is the correct tu imperative of camminare; "Lei deve camminare tutti i giorni" is formal polite address; "Dai, muoviti!" is correctly very informal. The key quotes the impersonal infinitive, which is the cleanest available exemplar.',
};

const PT_OPTIONS_REVISE = 'Three of the four options are right and the item grades correctly, but one label is wrong and this is a unit about register, so a wrong label is the most costly kind of error here. "With você, e.g. \'Você deve praticar desporto\': polite address" does not hold in either major variety. This passage is unambiguously European Portuguese ("desporto", "Em Portugal", "Lisboa e Porto", enclitic "exercitar-se"), and in European Portuguese você is not the polite form: it sits between tu and deference and is commonly avoided precisely because it can read as distant or impolite, while the genuinely polite address is o senhor / a senhora. In Brazilian Portuguese você is the ordinary everyday second person, which is further from "polite" still. The parallel items all key their formal-address distractor on the language\'s true formal pronoun: usted, Lei, Sie, vous. Portuguese is the one language whose equivalent is not a pronoun of that kind, and the option set should say so rather than press você into the slot. Replace that option with o senhor, which is unambiguously the formal polite address, restores the parallel with the other four, and is already covered by this module\'s absentWords guard ("senhor", "Senhor"), which I re-verified against the passage. The key and the other three options are unaffected, and the replacement collides with nothing under the tapped-choice grader.';
const PT_OPTIONS_APPROVED = 'Approved after verifying the revision I requested. The emitted array is byte-identical to my recommended_after, element by element, including the order that keeps the formal-address option in the slot the você option held. "With o senhor, e.g. \\"O senhor deve praticar desporto\\": formal polite address" is the genuine formal address in European Portuguese, which this passage plainly is, and it restores the parallel with usted, Lei, Sie and vous in the four sibling items; the invented example is grammatically correct, with a third-person verb after o senhor. I re-verified that the module\'s absentWords guard still lists both "senhor" and "Senhor", and that neither, nor "senhora", nor "o senhor" as a phrase, occurs in the passage, so the distractor still quotes a form literally absent. The four options remain distinct, exactly one is accepted under the tapped-choice grader, and the replacement collides with nothing. The key and the other three options are unchanged, and I confirmed the other six columns of this row are byte-identical to the values I approved before the revision, including the derived row id, which is a function of table, parent passage and slug rather than of content and therefore did not move.';
const PT_RECOMMENDED_OPTIONS = [
  'With tu commands, e.g. "Faz desporto todos os dias!": informal speech',
  'With o senhor, e.g. "O senhor deve praticar desporto": formal polite address',
  'Impersonally, e.g. "A prática regular de desporto é essencial": neutral, formal written style',
  'With slang, e.g. "Bora lá, pá!": very informal speech',
];

const COMMON = {
  passage_id: lang => `Parent is the ${lang} 3008 passage in Formal vs. Informal at B1; I re-checked passage title, level, publication, unit id, unit title, unit description and course language/level through the module's context guard and independently through the built set. The insert path in patch-set.mjs resolves the parent row and refuses an orphan, and the derived id is a function of that parent id, so the link cannot drift.`,
  order_index: lang => `2, appended after the two frozen retrieval questions at 0 and 1. Verified no collision: this passage's frozen siblings hold only 0 and 1, patch-set refuses an ordinal held by a frozen sibling, by a sibling this build reorders, or by another insert, and the module additionally throws if a prior module reordered either sibling. Independently confirmed the shape is not new: 55 passages corpus-wide already store an order_index 2, 53 passages already carry three questions and 2 carry four, and the corpus maximum ordinal is 3. ComprehensionQuestions.tsx maps over the question list and derives progress from its length, so three renders without change.`,
  question_type: () => "multiple_choice. Correct mode for a register judgement, which has a finite correct set, and it avoids the unresolved open short-answer grading policy. Verified through lib/grading.ts with the tapped-choice hint that exactly one of the four offered options is accepted.",
  accepted_answers: () => 'Empty array, correct for a tapped choice: the grader is strict in multiple_choice mode, so the key is the only accepted string and an alternatives list would be dead weight. Verified that no second option grades as correct.',
};

const decisions = new Map();
for (const item of reading3008Register) {
  const lang = item.language;
  const id = insertOf(lang).id;
  decisions.set(`${id}.passage_id`, { decision: 'approve_as_correction', rationale: COMMON.passage_id(lang) });
  decisions.set(`${id}.order_index`, { decision: 'approve_as_correction', rationale: COMMON.order_index(lang) });
  decisions.set(`${id}.question_type`, { decision: 'approve_as_correction', rationale: COMMON.question_type() });
  decisions.set(`${id}.accepted_answers`, { decision: 'approve_as_correction', rationale: COMMON.accepted_answers() });
  decisions.set(`${id}.question_text`, {
    decision: 'approve_as_correction',
    rationale: `Stem checked against the passage, and answerable from the passage text alone. ${REGISTER_READING[lang]} ${
      item.question_text.startsWith('In the last sentence')
        ? 'The stem scopes to the last sentence, which is exactly where the address form is, so the scope is precise.'
        : 'The stem asks "what forms of address, if any", so the true answer (none: the passage is impersonal) is an answer to the question actually asked. This replaces the earlier draft\'s stem, which presupposed that the writer addresses the reader; that reservation is resolved.'
    }`,
  });
  if (lang !== 'pt') {
    decisions.set(`${id}.options`, { decision: 'approve_as_correction', rationale: OPTIONS_RATIONALE[lang] });
  } else {
    const emitted = insertOf('pt').after.options;
    if (isDeepStrictEqual(emitted, PT_RECOMMENDED_OPTIONS)) {
      decisions.set(`${id}.options`, { decision: 'approve_as_correction', rationale: PT_OPTIONS_APPROVED });
    } else if (isDeepStrictEqual(emitted, PT_SUPERSEDED_OPTIONS)) {
      decisions.set(`${id}.options`, { decision: 'revise', rationale: PT_OPTIONS_REVISE, recommended_after: PT_RECOMMENDED_OPTIONS, sources: [CEFR] });
    } else {
      throw new Error('Portuguese options are neither the reviewed original nor the recommended replacement; re-review before recording');
    }
  }
  decisions.set(`${id}.correct_answer`, {
    decision: 'approve_as_correction',
    rationale: `Key is a member of options and is the only accepted string under the tapped-choice grader; the three distractors quote forms literally absent from the effective passage, so exactly one choice is defensible. ${REGISTER_READING[lang]}${lang === 'pt' ? ' The key is unaffected by the revision I request on this row\'s options field, which concerns a distractor label only.' : ''}`,
  });
}

await mkdir(base, { recursive: true });
const rows = inserts.map(row => {
  const item = reading3008Register.find(x => x.passage === row.after.passage_id);
  const passage = set.row('reading_passages', row.after.passage_id);
  const course = set.row('courses', passage.course_id);
  const unit = set.row('units', passage.unit_id);
  const passagePatch = patches.find(p => p.table === 'reading_passages' && p.id === passage.id);
  const content = passagePatch?.after?.content ?? passage.content;
  const siblings = set.snapshot.reading_questions
    .filter(q => q.passage_id === passage.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map(q => ({ id: q.id, order_index: q.order_index, question_type: q.question_type, question_text: q.question_text, updated_by_this_module: false }));
  return {
    language: item.language,
    inserted_row: { table: row.table, id: row.id, op: row.op, before: row.before, parent: row.parent, after: row.after, review_status: row.review_status },
    course: { id: course.id, target_language: course.target_language, cefr_level: course.cefr_level },
    unit: { id: unit.id, title: unit.title, description: unit.description },
    passage: { id: passage.id, title: passage.title, cefr_level: passage.cefr_level, is_published: passage.is_published, effective_word_count: content.split(/\s+/).filter(Boolean).length },
    effective_content: content,
    register_reading: REGISTER_READING[item.language],
    retained_frozen_questions: siblings,
    grading_check: { method: "lib/grading.ts gradeAnswer with exerciseHints {exerciseType: 'multiple_choice'}", accepted_option_count: 1, key_index: item.options.indexOf(item.correct_answer) },
  };
});

const body = `${JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  round: 'follow-up: insert-based module, superseding the update-based draft reviewed at ' + PRIOR_SOURCE_SHA.slice(0, 12),
  source, source_sha256: sourceSha, prior_source_sha256: PRIOR_SOURCE_SHA,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  new_rows: { inserted_reading_questions: 5, updated_reading_passages: 1 },
  existing_reading_questions_modified: 0,
  german_word_count_after_word_count_producer: dePatch.after.word_count,
  status: 'independent exact-field review; not an authorization to deploy',
  rows,
}, null, 2)}\n`;
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
try {
  await writeFile(archive, body, { flag: 'wx' });
} catch (err) {
  if (err.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw err;
}
const evidenceSha = sha(body);

const fields = [];
for (const row of inserts) {
  const item = reading3008Register.find(x => x.passage === row.after.passage_id);
  for (const field of INSERT_COLUMNS) {
    const d = decisions.get(`${row.id}.${field}`);
    if (!d) throw new Error(`No decision recorded for ${row.id}.${field}`);
    // `before` is deliberately omitted: this row is an insert.
    fields.push({
      reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
      table: 'reading_questions', id: row.id, field, op: 'insert',
      after: row.after[field],
      decision: d.decision, rationale: d.rationale,
      source_sha256: sourceSha, evidence: archive, evidence_sha256: evidenceSha,
      ref: `${item.passage} order_index=${row.after.order_index} (inserted)`,
      ...(d.recommended_after === undefined ? {} : { recommended_after: d.recommended_after }),
      ...(d.sources ? { sources: d.sources } : {}),
    });
  }
}
// Retain the superseded Portuguese decision so the trail shows what was asked
// and that it was applied. It is written FIRST so that review-current.mjs, which
// prefers the last approve_as_correction among exact matches, still settles on
// the approval; its `after` is the old array, so it cannot match the new value.
const ptRow = insertOf('pt');
const supersededPt = isDeepStrictEqual(ptRow.after.options, PT_RECOMMENDED_OPTIONS) ? [{
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  table: 'reading_questions', id: ptRow.id, field: 'options', op: 'insert',
  after: PT_SUPERSEDED_OPTIONS,
  decision: 'revise', rationale: PT_OPTIONS_REVISE,
  recommended_after: PT_RECOMMENDED_OPTIONS, sources: [CEFR],
  source_sha256: PRE_REVISION_SOURCE_SHA,
  superseded_by: `${sourceSha} (recommendation applied and verified)`,
  evidence: archive, evidence_sha256: evidenceSha,
  ref: `${reading3008Register.find(x => x.language === 'pt').passage} order_index=${ptRow.after.order_index} (inserted)`,
}] : [];
await writeFile(`${base}/followup-field-decisions.jsonl`, `${[...supersededPt, ...fields].map(f => JSON.stringify(f)).join('\n')}\n`);
const tally = fields.reduce((acc, f) => ({ ...acc, [f.decision]: (acc[f.decision] ?? 0) + 1 }), {});
tally.superseded_revise_retained = supersededPt.length;

await writeFile(`${base}/followup-README.md`, `# 3008 register scaffold — follow-up review of the five inserted questions

Reviewer: ${REVIEWER}. Reviewed on ${REVIEWED_ON}.
Source: \`${source}\`, SHA-256 \`${sourceSha}\`, superseding the update-based
draft I reviewed at \`${PRIOR_SOURCE_SHA.slice(0, 12)}…\`. Snapshot \`8c7f381c78d8…\`.

**This is a review, not an authorization to deploy, and not a claim that the
batch is error-free.** Decisions are in \`followup-field-decisions.jsonl\`; the
reviewed context is in \`reviewed-source-${sourceSha.slice(0, 12)}.json\`.

## Decisions — 35 fields, 5 inserted rows, 7 columns each

| Decision | Fields |
|---|---|
| approve_as_correction | ${tally.approve_as_correction ?? 0} |
| revise | ${tally.revise ?? 0} |
| reject | ${tally.reject ?? 0} |
| uncertain | ${tally.uncertain ?? 0} |

All 35 fields are now approved. The Portuguese \`options\` field was first
recorded as \`revise\`; the recommendation was applied and I have verified it,
so it is approved here. The superseded decision is retained as the first line
of \`followup-field-decisions.jsonl\`, with \`superseded_by\` naming the source
that applied it, so the trail shows what was asked as well as what shipped.

## The rework answers all four of my objections

Verified, not taken on report: the module inserts five rows and updates **no**
existing \`reading_questions\` row (asserted twice, by the module's own guard and
independently here); the four displaced retrieval questions are back at frozen
values, so every passage keeps both comprehension checks and gains a third;
Spanish now keys on the impersonal infinitive I recommended; Portuguese is
included with \`pt-R0004\` and \`pt-R0027\` untouched; and the Spanish, Italian and
Portuguese stems no longer presuppose an address, which resolves the
presupposition reservation and, for Italian, the \`combiniamo\` reservation too.

## Portuguese \`options\`: revision requested, applied, and verified

The Portuguese item was new and I judged it as a fresh proposal. The key was
sound. \`"A prática regular de desporto é essencial"\` is an agentless
nominalised subject clause, it is literally present, and with \`tu\`, \`você\` and
the slang forms all absent it is the only defensible choice of four. I
re-verified the absences myself: \`tu\`, \`Tu\`, \`você\`, \`Você\`, \`vocês\`,
\`senhor\`, \`Senhor\`, \`senhora\`, \`faz\`, \`Faz\`, \`pá\`, \`bora\`, and no
exclamation mark.

The problem is one label. **\`você\` is not "polite address" in either major
variety of Portuguese.** This passage is unambiguously European Portuguese
(\`desporto\`, "Em Portugal", "Lisboa e Porto", enclitic \`exercitar-se\`), and in
European Portuguese \`você\` sits between \`tu\` and deference and is commonly
avoided because it can read as distant or impolite; the genuinely polite
address is \`o senhor\` / \`a senhora\`. In Brazilian Portuguese \`você\` is the
ordinary everyday second person, further from "polite" still. The other four
items each key their formal-address distractor on the language's true formal
pronoun — \`usted\`, \`Lei\`, \`Sie\`, \`vous\` — and Portuguese is the one language
whose equivalent is not a pronoun of that kind.

This does not break the item: \`você\` is absent, so the distractor is still
wrong and the key still unique. The harm is that a learner reads the option set
and takes away \`você\` = polite, in the one unit whose entire subject is
register. \`recommended_after\` replaced it with \`o senhor\`, which is
unambiguously the formal polite address, restores the parallel with the other
four languages, and was already covered by the module's existing \`absentWords\`
guard.

**Verified as applied.** The emitted array is byte-identical to my
\`recommended_after\`, element by element and in the same order. The key and the
other three options are unchanged, the four options remain distinct, exactly one
is accepted under the tapped-choice grader, and the replacement collides with
nothing. \`absentWords\` still lists \`senhor\` and \`Senhor\`, and neither those,
nor \`senhora\`, nor \`o senhor\` as a phrase occurs in the passage. The other six
columns of the row are byte-identical to the values I approved before the
revision, including the derived row id, which is a function of table, parent
passage and slug rather than of content and so did not move.

## The insert shape

I was asked whether anything about the first insert producer in the audit looks
wrong. It does not. The id is derived from table, parent id and author slug, so
re-running is byte-stable and revising wording does not move the row; it is a
syntactically valid version-8 UUID, checked against the whole frozen snapshot
for collision. Every column must be named explicitly, so an omission is an error
rather than a silent NULL. The ordinal guard refuses an \`order_index\` held by a
frozen sibling, by a sibling this build reorders, or by another insert. Speaking
and user-owned content are excluded on the insert path as on the update path,
and the SQL applies inserts after every update. One small defence-in-depth gap,
not a defect: \`remediation-runtime.test.mjs\` checks an inserted ordinal only
against frozen siblings, so insert-versus-insert collision on one passage is
caught by \`patch-set.mjs\` alone rather than by two independent guards.

## Downstream effect the batch does not mention

\`comprehension_score\` is persisted to \`user_reading_progress\` and feeds the
reading strand of measured CEFR proficiency, where
\`READING_COMPREHENSION_PASS\` in \`lib/cefr-proficiency.ts\` is **0.7**. Adding a
third question changes the achievable scores on these five B1 passages from
{0, 0.5, 1.0} to {0, 0.333, 0.667, 1.0}. A learner must still score 1.0 to
earn B1 reading credit, because 0.667 falls just under the pass mark, but the
bar has moved from "both retrieval questions" to "both retrieval questions and
the register question", and 2 of 3 misses by 0.033. That is arguably correct —
a register question in a register unit should have to be answered — but it is a
real change to what these five passages certify, it lands just under a
threshold, and it should be a deliberate decision rather than a side effect.
The in-app score band also shifts: 2 of 3 now shows 67% amber where 2 of 2
showed 100% green.

## Positional reading references: full sweep

The \`<lang>-R####\` reference is the 1-based position of a question in the
per-language list sorted by \`id.localeCompare\`, so any enumeration that includes
the inserted rows renumbers everything after them. I swept every reader of
\`reading_questions\` in the audit.

The load-bearing fact is that \`patch-set.mjs\` stores inserts in its patch map
and never mutates \`snapshot.reading_questions\`, which stays at 309 rows. Every
producer and test that resolves a position against the frozen snapshot is
therefore safe by construction: \`reading-fixes\`, \`reading-answer-fixes\`,
\`reading-short-answer-fixes\`, \`reading-placement-fixes\`,
\`reading-answer.test.mjs\` (it reads the frozen file for positions and the draft
only by id), \`coverage.mjs\`, and \`nonlesson-review/followup-packet.mjs\`.
\`nonlesson-review/build-results.mjs\` is pinned to a historical draft by hash.
\`corpus-runtime-checks.mjs\` and \`remediation-runtime.test.mjs\` use no
positional references at all. The fix in \`runtime-checks.mjs\` is correct: it
captures the frozen ids at line 22, *before* merging the draft, then filters on
that set before sorting.

Impact if anything did enumerate post-insert, computed rather than estimated:

| Language | Insert sorts to | Frozen refs that shift |
|---|---|---|
| es | 38 of 38 | 0 |
| fr | 10 of 35 | 25 (fr-R0010 … fr-R0034) |
| de | 7 of 35 | 28 (de-R0007 … de-R0034) |
| it | 34 of 35 | 1 (it-R0034) |
| pt | 35 of 35 | 0 |

That is 54 references corpus-wide, and it reproduces the five broken
expectations independently: \`runtime-checks.mjs\` asserted fr 10, 15, 28 and
de 14, 23, which are exactly the five at or past a shift point.

Of the references this 3008 work itself cites, \`de-R0023\`, \`fr-R0018\` and
\`de-R0031\` would each move by one under a post-insert enumeration, while
\`pt-R0004\`, \`pt-R0027\`, \`fr-R0006\`, \`it-R0006\`, \`it-R0026\`, \`es-R0016\` and
\`es-R0017\` are stable. Nothing resolves them programmatically against a
post-insert corpus today, so this is a reading hazard for humans, not a live
defect.

**One place the trap is still open.** \`scripts/question-audit/other-packet.mjs\`
is the generator that emits \`-R####\` reading references for reviewer packets,
and it enumerates whatever snapshot path it is handed on argv with no
frozen-corpus assertion: no \`SNAPSHOT_SHA\` check, no snapshot hash in its
output, only a \`packet_sha256\` over the selected rows, which would change
silently rather than fail. \`packet.mjs\` has the same unguarded shape. The audit
README describes packet references as "stable per-language item references",
and that stability rests entirely on nobody handing these two scripts a
materialised post-draft corpus. Recommend they assert the frozen snapshot hash
the way \`patch-set.mjs\` and \`corpus-runtime-checks.mjs\` already do.

## A note on coverage

Because \`coverage.mjs\` reconciles against the frozen inventory, the five
inserted questions have no \`-R####\` reference and appear in no coverage total.
That is correct — they are authored content reviewed through field decisions,
not ledger items — but coverage figures should not be read as covering them.

## Other notes

- **Option length is unchanged in kind**: 53–93 characters against a corpus
  maximum of 32 across the 44 pre-existing reading options.
  \`ComprehensionQuestions.tsx\` sets no \`numberOfLines\` and no
  \`ellipsizeMode\`, so React Native wraps rather than truncates. Re-confirmed
  against the current working tree, which another agent is editing.
- **Still the first reading options containing target-language text.** All 44
  pre-existing options are pure ASCII. The whole option string is passed as
  \`accessibilityLabel\`, so VoiceOver will read the quoted forms with English
  phonology.
- **Key positions** are 2, 0, 3, 1, 2 across es/fr/de/it/pt. No positional tell.
- **German composes**: after \`passageWordCountFixes\` runs later in the build,
  the German 3008 passage still carries \`word_count\` 92, its content is 92
  whitespace tokens, and it carries exactly one reason, which proves the
  word-count producer did not also write it. That producer refuses to run
  before this module, so the ordering is enforced rather than assumed.
- **Scope check on the word-count batch**: it patches 61 other passages, not the
  42 mentioned in the hand-off. That batch has its own review and is outside my
  scope; I flag the count only because the two numbers disagree.
- **16 of my 18 round-one decisions are now moot.** They were recorded against
  update patches on the four displaced question rows, which this module no
  longer makes; \`review-current.mjs\` iterates draft patches, so orphaned
  decisions are simply never matched. The two German passage decisions
  (\`content\`, \`word_count\`) are still live and still match, because those
  values are unchanged.

## Verification run

\`\`\`
deno test --no-check --allow-read --unstable-sloppy-imports docs/audits/question-verification/remediation/reading/reading-3008-register.test.mjs
\`\`\`

6 passed, 0 failed. That suite is structural. The linguistic calls above are
mine, and the Portuguese \`options\` field is the one I would not ship as written.
`);

console.log(JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, source_sha256: sourceSha,
  inserted_rows: inserts.length, fields: fields.length, tally,
  revise: fields.filter(f => f.decision === 'revise').map(f => `${f.id}.${f.field}`),
  german_word_count: dePatch.after.word_count,
  evidence: archive, evidence_sha256: evidenceSha,
}, null, 2));
