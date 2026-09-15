/** Independent exact-field review of the 3008 register scaffold.
 *
 * Reviewer is independent of the author of
 * docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs.
 * Read-only over the audit: this script never writes the draft, the proposal,
 * or .question-audit/. It rebuilds the reading modules in build order, derives
 * the exact before/after of every field the proposal changes, and records one
 * decision per field plus an independent Portuguese disposition.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { readingFixes } from './reading-fixes.mjs';
import { spanishReadingOrthography } from './spanish-reading-orthography.mjs';
import { readingPlacementFixes } from './reading-placement-fixes.mjs';
import { readingAnswerFixes } from './reading-answer-fixes.mjs';
import { readingShortAnswerFixes } from './reading-short-answer-fixes.mjs';
import {
  reading3008Register,
  reading3008PortugueseBlocked,
  reading3008RegisterFixes,
  deRegisterSentence,
} from '../../docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/reading-3008-root-review';
const source = 'docs/audits/question-verification/remediation/reading/reading-3008-register-fixes.mjs';
const EXPECTED_SOURCE_SHA = '2f6cf459174df4a339edc36ff667edd9c6ccecf1b8f1979484b85ebf8c825a99';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const CEFR = 'https://rm.coe.int/1680459f97';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== EXPECTED_SOURCE_SHA) throw new Error(`Unreviewed source: ${sourceSha}`);

/** Same order as build-remediation.mjs, up to and including readingShortAnswerFixes. */
async function earlierReadingSet() {
  const set = await createPatchSet();
  readingFixes(set); spanishReadingOrthography(set); readingPlacementFixes(set);
  readingAnswerFixes(set); readingShortAnswerFixes(set);
  return set;
}
const baselineSet = await earlierReadingSet();
const baseline = baselineSet.patches();
const set = await earlierReadingSet();
reading3008RegisterFixes(set);
const patches = set.patches();
if (patches.length !== baseline.length + 5) throw new Error(`Expected exactly 5 new rows, got ${patches.length - baseline.length}`);

const patchOf = (table, id) => patches.find(p => p.table === table && p.id === id);
const basePatchOf = (table, id) => baseline.find(p => p.table === table && p.id === id);
const countWords = text => text.split(/\s+/).filter(Boolean).length;
const effective = passageId =>
  basePatchOf('reading_passages', passageId)?.after?.content ?? set.row('reading_passages', passageId).content;

/** What I checked myself, per language, rather than taking from the proposal. */
const REGISTER_READING = {
  es: 'No second-person address of any kind: impersonal infinitive subject ("Hacer ejercicio regularmente es esencial"), third-person attribution ("Los expertos recomiendan"), and agentless statements ("Reduce el estres, mejora el sueno"). No tu, no usted, no imperative, no exclamation mark, no first-person form at all. Cleanest of the five: "impersonal, neutral-formal written advice" is exact.',
  fr: 'The final sentence addresses the reader with vous and the concessive subjunctive after que: "Que vous preferiez marcher dans les parcs parisiens ou nager a la piscine municipale, l\'important est de bouger regulierement". The construction is correct and idiomatic. vous is the only address form in the passage, so scoping the stem to the last sentence is precise. Strictly, written generic vous is simultaneously polite-singular and plural; "polite, formal register" is the reading this unit teaches and is defensible.',
  de: 'The frozen passage has no address form at all: it generalises with inclusive wir ("Wenn wir regelmassig trainieren, werden wir starker") and with agentless statements. The appended sentence is the only address in the text, so the last-sentence stem is precise. Appended sentence checked independently: subordinate clause verb-final ("Wenn Sie mit dem Sport beginnen mochten"), correct Sie-imperative main clause ("sprechen Sie bitte"), correct dative after mit with correct genders ("Ihrem Arzt oder Ihrer Arztin"), idiomatic "mit dem Sport beginnen", gender-inclusive doubling that is standard in current German health advice. Natural, grammatical B1.',
  it: 'No address form: "Non e necessario essere atleti professionisti per stare bene: camminare tutti i giorni e sufficiente" is an impersonal infinitive construction, and there is no tu, no Lei, no imperative, no exclamation mark. The final sentence does use an inclusive first-person plural ("quando combiniamo lo sport con una buona alimentazione"), which no option names; the key remains the only defensible choice of the four, but the passage voice is not purely impersonal throughout.',
};

/** Distractor-by-distractor label check, done against the grammar rather than the proposal. */
const DISTRACTOR_CHECK = {
  es: [
    '"Con tu commands, ¡Haz ejercicio!" = informal: haz is the correct tu imperative of hacer; label correct; form absent from the passage.',
    '"Usted debe hacer ejercicio" = formal polite address: correct; absent.',
    'KEY: impersonal = neutral, formal written style: accurate for this passage.',
    '"¡Venga, tio!" = very informal: correct, though tio is Peninsular-specific while the passage leans Latin American ("andar en bicicleta"); low stakes for an absent-form distractor.',
  ],
  fr: [
    'KEY: vous = polite, formal register: correct for written generic address.',
    '"Si tu preferes marcher ... ou nager ..." = informal: correct tu forms; absent.',
    '"Si on prefere marcher ..." = impersonal, neutral: correct for the generic-on reading quoted; note that spoken on ("we") is itself informal, so the label holds for this example rather than for on in general.',
    '"Allez, bouge-toi, mec !" = very informal: correct, including the French space before the exclamation mark; absent.',
  ],
  de: [
    '"Wenn du ... beginnen mochtest, sprich ..." = informal: correct du forms; absent.',
    '"Wenn ihr ... beginnen mochtet, sprecht ..." = informal plural: correct ihr forms; lowercase ihr is absent. The appended sentence does contain capitalised Ihrem/Ihrer (formal possessive), which makes this distractor a genuine and appropriate B1 discrimination rather than a trap, because the key quotes "sprechen Sie bitte".',
    '"Wenn man ... beginnen mochte, spricht man ..." = impersonal, neutral: correct man + 3sg agreement; absent.',
    'KEY: Sie + bitte = formal, polite register: correct.',
  ],
  it: [
    '"Cammina tutti i giorni!" = informal: cammina is the correct tu imperative of camminare; absent.',
    'KEY: impersonal infinitive = neutral, formal written style: accurate for the quoted clause.',
    '"Lei deve camminare tutti i giorni" = formal polite address: correct; absent.',
    '"Dai, muoviti!" = very informal: correct colloquial imperative; absent.',
  ],
};

const KEPT_SIBLING_NOTE = {
  es: 'Kept sibling aabbccdd-1111-3008-a001-0b0000000001 (order 0) is a four-option multiple choice on the thirty-minutes fact and is untouched. The passage keeps one comprehension check.',
  fr: 'Kept sibling 428b5d74-ee1b-40ce-8cd1-1f8ffc85575a (order 0) is the two-physical-benefits short answer carrying the reviewed fr-R0006 patch (seven accepted answers) and is untouched. The passage keeps one comprehension check.',
  de: 'Kept sibling 902e1fa1-4565-47fa-98b5-2c1675234e69 (order 1) is the two-popular-sports short answer carrying the reviewed de-R0023 patch (eleven accepted answers) and is untouched. The passage keeps one comprehension check.',
  it: 'Kept sibling 1f530806-f9bf-439f-b85f-b5f31a5103d1 (order 0) is the two-sports short answer and is untouched. It carries NO upstream patch: its key is the full sentence "Running and cycling are two sports mentioned as popular in Italy." with accepted_answers []. It is now the only comprehension check on this passage, so the unresolved open-grading policy bites harder here than on the other three.',
};

/** The Spanish key's exemplar is the one field pair I would change before shipping. */
const ES_RECOMMENDED_KEY = 'Impersonally, e.g. "Hacer ejercicio regularmente es esencial": neutral, formal written style';
const ES_RECOMMENDED_OPTIONS = [
  'With tú commands, e.g. "¡Haz ejercicio!": informal speech',
  'With usted, e.g. "Usted debe hacer ejercicio": formal polite address',
  ES_RECOMMENDED_KEY,
  'With slang, e.g. "¡Venga, tío!": very informal speech',
];
const ES_REVISE_RATIONALE = 'Approve the item, revise the exemplar. The label "neutral, formal written style" is accurate and no distractor competes, so the key is answerable with exactly one defensible choice. But "Los expertos recomiendan" is an ordinary third-person subject clause: it illustrates attribution to authority, not grammatical impersonality, so it teaches the weaker half of the evidence. "Hacer ejercicio regularmente es esencial" is an impersonal infinitive construction with no agent and no address, it is the passage\'s opening clause, and it is already in this module\'s `present` guard, so the change needs no new guard. The Italian sibling already keys on the impersonal infinitive ("camminare tutti i giorni e sufficiente"); this makes Spanish consistent with it.';

const decisions = new Map();
const decide = (id, field, decision, rationale, extra = {}) =>
  decisions.set(`${id}.${field}`, { decision, rationale, ...extra });

const QUESTION_FIELD_RATIONALE = {
  question_type: lang => `short_answer -> multiple_choice. Verified independently through lib/grading.ts with the tapped-choice hint {exerciseType: 'multiple_choice'}: exactly one of the four offered options is accepted, the displaced key is rejected, and accepted_answers stays []. Closed grading is the right mode here, because a register judgement has a finite correct set and the open short-answer grading policy is still unresolved in this audit. ${KEPT_SIBLING_NOTE[lang]}`,
  question_text: lang => `Stem checked against the passage. ${REGISTER_READING[lang]}`,
  options: lang => `Four options, all distinct, one key, three distractors whose forms are literally absent from the effective (upstream-patched) passage; I re-ran the absence check on the effective text rather than the frozen text. Label accuracy checked form by form: ${DISTRACTOR_CHECK[lang].join(' ')} Key sits at index ${reading3008Register.find(x => x.language === lang).options.indexOf(reading3008Register.find(x => x.language === lang).correct_answer)}; across the four languages the key falls at index 2, 0, 3 and 1, so there is no positional tell. readingQuestionOptions returns stored options in order and does not shuffle, so that ordering is what a learner sees.`,
  correct_answer: lang => `Key is a member of options and is the only accepted string under the tapped-choice grader. ${REGISTER_READING[lang]}`,
};

for (const item of reading3008Register) {
  const lang = item.language;
  for (const field of ['question_type', 'question_text', 'options', 'correct_answer']) {
    if (lang === 'es' && (field === 'options' || field === 'correct_answer')) {
      decide(item.replace.id, field, 'revise', ES_REVISE_RATIONALE, {
        recommended_after: field === 'options' ? ES_RECOMMENDED_OPTIONS : ES_RECOMMENDED_KEY,
        sources: [CEFR],
      });
    } else {
      decide(item.replace.id, field, 'approve_as_correction', QUESTION_FIELD_RATIONALE[field](lang));
    }
  }
}

const dePassage = reading3008Register.find(x => x.language === 'de').passage;
const deEffective = `${effective(dePassage)} ${deRegisterSentence}`;
decide(dePassage, 'content', 'approve_as_correction',
  `One sentence appended, nothing else in the text altered; I diffed the effective before/after and the only difference is the trailing sentence. ${REGISTER_READING.de} The append is justified: this is the only one of the five passages with no address form at all, so without it the unit's core German marker would be absent and no honest Sie question could be keyed. One correction to the handoff's wording: it says "no figure or new health claim is introduced", but "sprechen Sie bitte zuerst mit Ihrem Arzt oder Ihrer Ärztin" is a new piece of advice, not merely a restatement. It introduces no number and it is the conservative, safe direction of advice, so I do not treat it as a defect; the claim is simply overstated. Residual note: the passage now mixes an inclusive-wir body with a Sie closing. That mixture is idiomatic in German health advice and the question scopes to the last sentence, so it does not make the item ambiguous.`);
decide(dePassage, 'word_count', 'approve_as_correction',
  `75 -> 92, correct. I inferred the rule rather than taking it: across all 126 passages, stored word_count equals the whitespace-token count exactly for de, fr, it, pt and ru (14/14 each) and never for es, ja, ko or zh (0/14 each). German therefore follows a plain whitespace-token count, the frozen 75 matches it exactly, the appended sentence is 17 tokens, and 75 + 17 = 92, which also equals a direct recount of the new content. Separately worth reporting to the lead but outside this batch: the es/ja/ko/zh word_count values are unreliable (for example this unit's Spanish sibling stores 100 against an actual 55 tokens, and the Spanish B1/B2 rows all carry round numbers that look like authoring targets).`);

/** Independent Portuguese check, not taken from the proposal. */
const ptPassage = set.row('reading_passages', reading3008PortugueseBlocked.passage);
const ptUnit = set.row('units', ptPassage.unit_id);
const ptFeatures = [
  { quote: 'A prática regular de desporto é essencial para manter uma boa saúde.', why: 'Nominalisation ("a prática regular de desporto") in subject position rather than a verbal clause, plus an evaluative copula. Characteristic of formal written exposition.' },
  { quote: 'A Organização Mundial de Saúde recomenda pelo menos 150 minutos de exercício moderado por semana.', why: 'Named institutional authority as sentence subject. Citation of an institution is a formal-register move; no informal text does this.' },
  { quote: 'Tanto os jovens como os adultos devem praticar desporto regularmente.', why: 'The correlative "Tanto ... como ..." is a formal/literary connector, and the deontic "devem" takes a generic third-person subject instead of any address form.' },
  { quote: 'Além disso, a atividade física reduz o stress e aumenta a sensação de bem-estar.', why: 'Formal discourse connective "Além disso" rather than a coordinating "e também".' },
  { quote: 'existem muitos centros de fitness e parques onde as pessoas podem exercitar-se', why: 'Enclitic pronoun placement ("exercitar-se") is the European Portuguese written norm; informal usage would front the clitic ("se exercitar").' },
];
for (const f of ptFeatures) if (!ptPassage.content.includes(f.quote)) throw new Error(`Portuguese quote not in passage: ${f.quote}`);
const ptAbsent = ['tu', 'você', 'vocês', 'senhor', 'pá', 'bora'];
for (const w of ptAbsent) {
  if (new RegExp(`(?<![\\p{L}'’])${w}(?![\\p{L}])`, 'iu').test(ptPassage.content)) throw new Error(`Portuguese form unexpectedly present: ${w}`);
}
if (ptPassage.content.includes('!')) throw new Error('Portuguese passage unexpectedly contains an exclamation mark');

const ptVerdict = {
  disposition_proposed_by_author: 'blocked_no_change',
  reviewer_verdict: 'keep_with_evidence_does_NOT_close_pt-R0004_or_pt-R0027',
  register_features_verified: ptFeatures,
  forms_verified_absent: ptAbsent,
  remedy_required: true,
  recommended_path: 'add reading_questions INSERT support to scripts/question-audit/patch-set.mjs',
};

await mkdir(base, { recursive: true });

const rows = [
  ...reading3008Register.map(item => {
    const qPatch = patchOf('reading_questions', item.replace.id);
    const pPatch = patchOf('reading_passages', item.passage);
    const original = set.snapshot.reading_questions.find(q => q.id === item.replace.id);
    const kept = set.snapshot.reading_questions.find(q => q.id === item.keep.id);
    const content = item.content ? deEffective : effective(item.passage);
    const passage = set.row('reading_passages', item.passage);
    const unit = set.row('units', passage.unit_id);
    const course = set.row('courses', passage.course_id);
    return {
      language: item.language,
      passage: { id: item.passage, title: passage.title, cefr_level: passage.cefr_level, is_published: passage.is_published, stored_word_count: passage.word_count, effective_word_count: countWords(content) },
      course: { id: course.id, title: course.title, target_language: course.target_language, cefr_level: course.cefr_level },
      unit: { id: unit.id, title: unit.title, description: unit.description },
      effective_content: content,
      register_reading: REGISTER_READING[item.language],
      distractor_label_check: DISTRACTOR_CHECK[item.language],
      kept_sibling: { id: kept.id, order_index: kept.order_index, question_type: kept.question_type, question_text: kept.question_text, upstream_patched: Boolean(basePatchOf('reading_questions', kept.id)), note: KEPT_SIBLING_NOTE[item.language] },
      displaced_question: { id: original.id, order_index: original.order_index, question_type: original.question_type, question_text: original.question_text, correct_answer: original.correct_answer, fact_still_in_passage: true },
      question_patch: { table: 'reading_questions', id: item.replace.id, before: qPatch.before, after: qPatch.after },
      passage_patch: pPatch ? { table: 'reading_passages', id: item.passage, before: pPatch.before, after: pPatch.after } : null,
      grading_check: { method: "lib/grading.ts gradeAnswer with exerciseHints {exerciseType: 'multiple_choice'}", accepted_option_count: 1, displaced_key_accepted: false, key_index: item.options.indexOf(item.correct_answer) },
    };
  }),
  { language: 'pt', passage: { id: ptPassage.id, title: ptPassage.title, cefr_level: ptPassage.cefr_level, stored_word_count: ptPassage.word_count, effective_word_count: countWords(ptPassage.content) }, unit: { id: ptUnit.id, title: ptUnit.title, description: ptUnit.description }, effective_content: ptPassage.content, portuguese_disposition: ptVerdict },
];

const body = `${JSON.stringify({
  reviewer: REVIEWER,
  reviewed_on: REVIEWED_ON,
  source,
  source_sha256: sourceSha,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  build_order: ['readingFixes', 'spanishReadingOrthography', 'readingPlacementFixes', 'readingAnswerFixes', 'readingShortAnswerFixes', 'reading3008RegisterFixes'],
  new_rows: patches.length - baseline.length,
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
for (const item of reading3008Register) {
  const qPatch = patchOf('reading_questions', item.replace.id);
  for (const field of ['question_type', 'question_text', 'options', 'correct_answer']) {
    const d = decisions.get(`${item.replace.id}.${field}`);
    fields.push({
      reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
      table: 'reading_questions', id: item.replace.id, field,
      before: qPatch.before[field], after: qPatch.after[field],
      decision: d.decision, rationale: d.rationale,
      source_sha256: sourceSha,
      evidence: archive, evidence_sha256: evidenceSha,
      ref: `${item.passage} order_index=${item.replace.order_index}`,
      ...(d.recommended_after === undefined ? {} : { recommended_after: d.recommended_after }),
      ...(d.sources ? { sources: d.sources } : {}),
    });
  }
}
const dePatch = patchOf('reading_passages', dePassage);
for (const field of ['content', 'word_count']) {
  const d = decisions.get(`${dePassage}.${field}`);
  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
    table: 'reading_passages', id: dePassage, field,
    before: dePatch.before[field], after: dePatch.after[field],
    decision: d.decision, rationale: d.rationale,
    source_sha256: sourceSha, evidence: archive, evidence_sha256: evidenceSha,
    ref: `${dePassage} passage (question be8e83a8-cf54-4962-8d2e-1593c1dec8ab order_index=0 keys on the appended sentence)`,
  });
}
await writeFile(`${base}/field-decisions.jsonl`, `${fields.map(f => JSON.stringify(f)).join('\n')}\n`);

const tally = fields.reduce((acc, f) => ({ ...acc, [f.decision]: (acc[f.decision] ?? 0) + 1 }), {});

await writeFile(`${base}/README.md`, `# 3008 register scaffold — independent exact-field review

Reviewer: ${REVIEWER}. Reviewed on ${REVIEWED_ON}.
Source: \`${source}\`, SHA-256 \`${sourceSha}\` (verified before review).
Snapshot \`8c7f381c78d8…\`. Applied in build order
(\`readingFixes\` → \`spanishReadingOrthography\` → \`readingPlacementFixes\` →
\`readingAnswerFixes\` → \`readingShortAnswerFixes\` → \`reading3008RegisterFixes\`)
on a fresh set: **+5 rows**, nothing else changed.

**This is a review, not an authorization to deploy, and not a claim that the
batch is error-free.** Exact per-field decisions with before/after values are in
\`field-decisions.jsonl\`; the full reviewed context — effective passages, kept
siblings, displaced questions, grading results — is in
\`reviewed-source-${sourceSha.slice(0, 12)}.json\`. Portuguese has its own
disposition in \`pt-disposition.md\`.

## Decisions

| Decision | Fields |
|---|---|
| approve_as_correction | ${tally.approve_as_correction ?? 0} |
| revise | ${tally.revise ?? 0} |
| reject | ${tally.reject ?? 0} |
| uncertain | ${tally.uncertain ?? 0} |

The two \`revise\` fields are the Spanish \`options\` and \`correct_answer\`. The item
is sound and I would ship it; the **exemplar inside the key** is the weaker half
of the passage's evidence. \`"Los expertos recomiendan"\` is an ordinary
third-person subject clause and illustrates attribution to authority, not
grammatical impersonality. \`"Hacer ejercicio regularmente es esencial"\` is an
impersonal infinitive construction, is the passage's opening clause, is already
in the module's \`present\` guard, and matches what the Italian sibling already
keys on. \`recommended_after\` carries the exact replacement strings.

## What I verified independently

1. **Grading.** Through \`lib/grading.ts\` with the tapped-choice hint, not
   through the module's own test: for each of the four questions exactly one of
   the four offered options is accepted, the displaced key is rejected, and
   \`accepted_answers\` stays \`[]\`. Key positions are 2 (es), 0 (fr), 3 (de),
   1 (it), so there is no positional tell, and \`readingQuestionOptions\` returns
   stored options in order without shuffling.
2. **Register labelling, form by form.** Every example quoted in every option
   was checked for grammatical correctness and for whether its register label is
   true: \`haz\`/\`cammina\` as tu-imperatives, \`usted\`/\`Lei\` as formal polite
   address, \`on\`/\`man\` as impersonal, \`du\`/\`ihr\` agreement, French spacing
   before \`!\`. All are correct. Two soft notes are recorded in the field
   rationales: French \`on\` is labelled impersonal, which is true of the generic
   example quoted but not of spoken \`on\` = "we"; and Spanish \`tío\` is
   Peninsular-specific while the passage leans Latin American.
3. **The German append.** Grammatical and natural B1: verb-final subordinate
   clause, correct \`Sie\`-imperative, correct dative genders after \`mit\`,
   idiomatic \`mit dem Sport beginnen\`, standard gender-inclusive doubling. It is
   the only address form in the passage, so scoping the stem to the last
   sentence is precise.
4. **The word_count rule, inferred not assumed.** Across all 126 passages,
   stored \`word_count\` equals the whitespace-token count exactly for de, fr, it,
   pt and ru (14/14 each) and never for es, ja, ko or zh (0/14 each). German
   follows that rule, frozen 75 matches it, the appended sentence is 17 tokens,
   75 + 17 = 92, and a direct recount of the new content is also 92. Correct.
5. **Option length and rendering.** New options are 53–91 characters against a
   previous maximum of 32 across all 44 existing reading options.
   \`ComprehensionQuestions.tsx\` renders each option in a \`<Text>\` with no
   \`numberOfLines\` and no \`ellipsizeMode\`, inside a padded \`Pressable\` in a
   \`ScrollView\`, so React Native **wraps** rather than truncates. Confirmed, not
   assumed.
6. **Displaced questions.** Each passage keeps exactly one comprehension check,
   and each displaced fact is still in the passage text.

## Reservations the lead should see

- **Comprehension coverage halves** on four passages: 2 comprehension questions
  become 1 comprehension + 1 register. That is the direct cost of
  \`patch-set.mjs\` having no insert path. It is a real loss, not a wash.
- **Italian is the weakest of the four.** Its kept sibling
  \`1f530806-…\` carries **no** upstream patch: the key is the full sentence
  "Running and cycling are two sports mentioned as popular in Italy." with
  \`accepted_answers []\`. After this batch it is the only comprehension check on
  that passage, so the unresolved open-grading policy bites harder here.
- **Italian passage voice.** The final sentence uses inclusive first person
  plural ("quando combiniamo lo sport…"), which no option names, while the stem
  covers the whole passage. The key is still the only defensible choice of the
  four, but the proposal's rationale ("no tu, Lei, imperative or slang") omits
  this. Consider narrowing the Italian stem or naming the non-address explicitly.
- **Spanish and Italian stems** ask "How does the writer speak to the reader in
  this passage?" when the correct answer is that the writer does not address the
  reader. The second sentence ("Choose the description that matches the text")
  carries it, but the presupposition is there.
- **The handoff's "no new health claim" is overstated.** The appended German
  sentence introduces advice to consult a doctor first. It adds no figure and
  the advice is conservative, so I do not treat it as a defect, but it is new.
- **First target-language text inside reading options.** All 44 pre-existing
  reading options are pure ASCII English. These four introduce accented
  Spanish/French/German/Italian quotes inside English options, and
  \`ComprehensionQuestions.tsx\` passes the whole string as
  \`accessibilityLabel\`, so VoiceOver will read the quoted forms with English
  phonology. Not a blocker; worth knowing before more register items are built.
- **word_count is unreliable outside de/fr/it/pt/ru.** Pre-existing and outside
  this batch, but the Spanish sibling in this very unit stores 100 against an
  actual 55 tokens.

## Integration

Verified as specified: import and call immediately after
\`readingShortAnswerFixes(set);\` in \`build-remediation.mjs\`. Earlier is refused
by the Portuguese guard; the draft gains exactly 5 rows (4 \`reading_questions\`,
1 \`reading_passages\`), so any test asserting the draft row total moves by 5.
The module's own suite passes (4 passed, 0 failed):

\`\`\`
deno test --no-check --allow-read --unstable-sloppy-imports docs/audits/question-verification/remediation/reading/reading-3008-register.test.mjs
\`\`\`

**Recommended before integration:** apply the two Spanish \`revise\` strings, or
record a decision not to. Everything else is approved as a correction.
`);

await writeFile(`${base}/pt-disposition.md`, `# Portuguese 3008 — independent disposition

Passage \`aabbccdd-5555-3008-a001-000000000000\` "O Desporto e a Saúde", B1,
in unit \`Formal vs. Informal\` / "Register, polite requests, slang".
Author's disposition: \`blocked_no_change\`.

**Reviewer verdict: a keep-with-evidence disposition does NOT close
\`pt-R0004\` or \`pt-R0027\`. Portuguese still needs a remedy.**

## The register features are real

The passage is genuinely formal written Portuguese. Quoting it:

1. "A prática regular de desporto é essencial para manter uma boa saúde."
   Nominalisation in subject position rather than a verbal clause, plus an
   evaluative copula. Formal written exposition.
2. "A Organização Mundial de Saúde recomenda pelo menos 150 minutos de
   exercício moderado por semana." A named institution as sentence subject.
   Citing an institution is a formal-register move.
3. "Tanto os jovens como os adultos devem praticar desporto regularmente."
   The correlative "Tanto … como …" is a formal connector, and the deontic
   "devem" takes a generic third-person subject, not an address form.
4. "Além disso, a atividade física reduz o stress e aumenta a sensação de
   bem-estar." Formal discourse connective rather than a coordinating "e também".
5. "existem muitos centros de fitness e parques onde as pessoas podem
   exercitar-se". Enclisis ("exercitar-se") is the European Portuguese written
   norm; informal usage fronts the clitic ("se exercitar").

Verified absent from the passage: \`tu\`, \`você\`, \`vocês\`, \`senhor\`, \`pá\`,
\`bora\`, and any exclamation mark. So the author is right that the content rule
(edit only where no signal exists) forbids appending a cue here, exactly as it
permitted one in German.

## Why that does not close the claims

The two claims are not "this passage is informal". Both passes recorded
\`R-UNIT-TOPIC\` / \`N105\`, quoted as "health in Formal/Informal … Exact named
skill absent", and the remaining-fixes entry says "Both independent reviews
found the promised specific unit skill absent from this actual passage/
questions."

The gap is that the learner never **does** anything with register. The passage
*being* formal is a property of the text; the unit promises practice in
noticing, contrasting and adapting register across its six lessons (Formal
Requests, Informal Speech, Writing Emails, Phone Etiquette, Adapting Register,
Review & Test). Portuguese keeps two pure retrieval questions — how many
minutes, and three benefits — neither of which touches register.

The author's own rationale for Spanish and Italian proves the point. Both of
those passages were *already* impersonal-formal, and in both cases "the signal
is already present" was **not** treated as sufficient: a register-identification
question was authored anyway. Portuguese gets nothing only because both of its
question rows are locked, which is a tooling constraint, not a content
judgement. The evidence file's phrasing — "Register signal exists, so the
content rule does not permit a cue" — runs the content rule and the question
rule together and makes the block read as more principled than it is. Only the
locked rows actually block Portuguese.

## Precisely what Portuguese needs

A fourth-option register-identification question on this passage, matching the
Spanish and Italian shape, keyed on an impersonal construction literally present
in the text and with distractors quoting forms literally absent. Concretely:

- Stem: "How does the writer speak to the reader in this passage? Choose the
  description that matches the text."
- Key: \`Impersonally, e.g. "A prática regular de desporto é essencial": neutral, formal written style\`
- Distractors: \`With tu commands, e.g. "Faz desporto todos os dias!": informal speech\`;
  \`With você, e.g. "Você deve praticar desporto": polite address\`;
  \`With slang, e.g. "Bora lá, pá!": very informal speech\`
- Guards: the key phrase present in the effective content; \`tu\`, \`você\`,
  \`vocês\`, \`senhor\`, \`faz\`, \`pá\`, \`bora\` and \`!\` absent. I verified every one
  of those absences against the frozen content while writing this file, so the
  guards will hold. The wording above is a shape, not reviewed content: it needs
  its own author and its own independent review.

## Which of the two paths

**Take path (a): add \`reading_questions\` INSERT support to
\`scripts/question-audit/patch-set.mjs\`.** Not path (b).

- Path (b) — supersede \`pt-R0004\` with a composition adapter and amend
  \`reading-answer.test.mjs\` — throws away reviewed accepted-answer work to buy
  a slot, and leaves Portuguese with one comprehension check like the other
  four.
- Path (a) fixes the actual cause. The no-insert limitation is why **all four**
  of the other languages had to displace a retrieval question in the first
  place. With insert support, Portuguese gains its register question with no
  reviewed work destroyed, and es/fr/de/it can keep **both** retrieval questions
  *and* gain the register question, recovering the comprehension coverage this
  batch spends. That is strictly better for all five passages.
- Cost: \`patch-set.mjs\` currently only emits guarded \`UPDATE\`s keyed on exact
  ids and old values. Inserts need a different guard shape (new ids, an
  existence check, and \`ON CONFLICT\` behaviour) and a decision about how
  \`order_index\` is allocated. That is real work and it is a lead decision, not
  something to fold into this batch.

Until one of those paths is taken, \`pt-R0004\` and \`pt-R0027\` remain **open**
Formal-vs-Informal claims, and this batch should not be reported as resolving
the 3008 register gap for all five languages — only for four.
`);

console.log(JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON, source_sha256: sourceSha,
  rows: rows.length, fields: fields.length, tally,
  revise: fields.filter(f => f.decision === 'revise').map(f => `${f.id}.${f.field}`),
  pt: ptVerdict.reviewer_verdict, evidence: archive, evidence_sha256: evidenceSha,
}, null, 2));
