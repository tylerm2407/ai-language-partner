/** Independent remediation review of `scripts/question-audit/italian-option-collision-fixes.mjs`.
 *
 * The reviewer did not author the batch. Each of the five defects was re-read against the
 * frozen row, and the replacement distractors were checked for being unambiguously wrong,
 * plausible, at the right band and not near-synonyms of the key.
 *
 * All seven fields are approved. Two gaps in COVERAGE are recorded instead, because the
 * fields that would change live on rows this producer does not touch:
 *
 *   - Three more Italian `listening_choice` rows offer an option that the sibling
 *     `italian-accepted-alternatives.mjs` asserts is also correct: it-E1074, it-E1876 and
 *     it-E1960. Applying that producer without extending this one leaves three questions
 *     with no single right answer, by the project's own asserted semantics.
 *
 *   - A fifth welded blank survives. it-E1008 is `Meno_____ (Cheaper)` with key `caro`,
 *     so the filled answer renders `Menocaro` — the same defect as it-E1546 here and the
 *     already-approved it-E2190 and it-E2204. A scan of every Italian prompt whose blank
 *     is preceded by a standalone Italian word finds exactly these five and no others; the
 *     remaining eight candidates (`Leg_____`, `Fine_____`, `Sta_____`, `Mal_____`,
 *     `Pass_____`, `Perso_____`, `Stra_____`) are ordinary stems that close into one real
 *     word and are not defects. The sibling producer already patches it-E1008's
 *     `accepted_answers`, a different field, so a prompt fix there would not contend.
 *
 * On the collision claims themselves: for each of the four, the course teaches a distinct
 * Italian word for the removed English gloss in the same unit — `Ciao`/Hello, `Pulire`/To
 * clean, `Riunione`/Meeting. That is real counter-evidence to calling the option correct,
 * and it is recorded rather than buried. The swaps are approved anyway: the key never
 * moves, the replacements are unambiguously wrong, and retiring a contestable distractor
 * for an uncontestable one improves the item whichever way the editorial call goes.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { italianOptionCollisionFixes, italianOptionCollisions, italianPromptSpacing } from './italian-option-collision-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/it-option-collision-root-review';
const source = 'scripts/question-audit/italian-option-collision-fixes.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
if (sourceSha !== 'd96a672953ccf5daf88fa7dfabeea4ee9f73df3327152b7f63f31e9dd772ce71') {
  throw new Error(`Unreviewed source: ${source} is ${sourceSha}`);
}

const TRECCANI_COLLOQUIO = 'https://www.treccani.it/vocabolario/colloquio/';
const TRECCANI_LAVARE = 'https://www.treccani.it/vocabolario/lavare/';

const NOTES = new Map([
  [34, {
    collision: 'Confirmed. Buongiorno is the ordinary formal daytime greeting on meeting, so a learner hearing it and choosing "Hello" has understood it; the row offered two correct tiles and had no single answer. The sibling producer relies on the same equivalence at it-E0003, so the two batches are consistent with each other.',
    replacement: 'Agreed. "Good night" is buonanotte, which the course teaches as a distinct A1 word across five rows in this same unit, and which buongiorno never means. It is plausible, at band, in the same greeting family, and not a near-synonym of "Good morning". The option set becomes three time-of-day greetings plus "Yes", which discriminates better than the original.',
    counter: 'The course elsewhere keys Hello to Ciao (three A1 rows), which is evidence that "Hello" was intended as ciao\'s gloss and so as a legitimate distractor here. The swap is approved regardless: it removes the contest instead of settling it.',
  }],
  [765, {
    collision: 'Arguable, and approved. Treccani defines lavare as making something clean by means of water, so "To clean" is a defensible reading of the objectless verb and the prompt supplies no object to separate the two. The sibling producer makes the same assertion in free text at it-E0743; the two rows are one editorial decision and must move together.',
    replacement: 'Agreed. "To cook" is cucinare or cuocere, taught separately across ten rows including two in this same At Home unit. It is unambiguously wrong for lavare, plausible as a household verb, at band, and not a near-synonym of "To wash".',
    counter: 'The same At Home unit teaches Pulire as "To clean" across five rows, including a direct "What does Pulire mean in English?" item. That is real evidence that "To clean" was the intended gloss of a different taught verb and so a legitimate discrimination distractor rather than a collision. Approved anyway on the same reasoning as it-E0034.',
  }],
  [1232, {
    collision: 'Arguable, and approved. Treccani gives colloquio as a conversation or talk between people alongside the job-interview sense, so "Meeting" is a defensible reading and nothing in a bare dictated word narrows it.',
    replacement: 'Agreed. "Salary" is stipendio, keyed across five rows in this same Work & Career unit and never a reading of colloquio. Plausible in an interview lesson, at band, not a near-synonym of "Interview".',
    counter: 'The same unit teaches Riunione as "Meeting" across five B1 rows, including a direct "What does Riunione mean in English?" item, which is evidence that "Meeting" was the intended gloss of a different taught word. Approved anyway.',
  }],
  [1272, {
    collision: 'The same colloquio/meeting collision as it-E1232 in the typed form; the same reasoning and the same caveat apply.',
    replacement: 'Agreed, and agreed with taking a different replacement from it-E1232 so the two rows do not collapse into the same question. "Deadline" is scadenza, keyed across six rows including three in Work & Career, unambiguously wrong for colloquio, at band, not a near-synonym of "Interview".',
    counter: 'As it-E1232: the course teaches Riunione for "Meeting" in this unit.',
  }],
]);

const set = await createPatchSet();
italianOptionCollisionFixes(set);
const get = lessonRefs(set.snapshot, 'it');
const patches = new Map(set.patches().map(p => [p.id, p]));
if (patches.size !== 5) throw new Error(`Expected 5 patched rows, replayed ${patches.size}`);

const sorted = list => JSON.stringify([...list].sort());
const rows = [], fields = [];

for (const [n, type, lessonTitle, prompt, key, options, replaced, replacement, reason, sources] of italianOptionCollisions) {
  const { exercise, lesson, unit, course, ref } = get(n);
  const patch = patches.get(exercise.id);
  const note = NOTES.get(n);

  // Re-derive the guarantees rather than trusting the producer's own reason string.
  if (exercise.correct_answer !== key) throw new Error(`${ref}: key moved`);
  if (Object.hasOwn(patch.after, 'correct_answer') || Object.hasOwn(patch.after, 'accepted_answers')) throw new Error(`${ref}: the key or its alternatives moved`);
  if (!patch.after.options.includes(key)) throw new Error(`${ref}: the key left the options`);
  if (patch.after.options.includes(replaced)) throw new Error(`${ref}: the colliding option is still offered`);
  if (patch.after.options.length !== options.length) throw new Error(`${ref}: the option count changed`);
  const mirrors = type === 'listening_choice'
    ? sorted(patch.after.distractors) === sorted(patch.after.options.filter(o => o !== key))
    : !Object.hasOwn(patch.after, 'distractors');

  rows.push({ ref, frozen_ref_number: n, exercise_id: exercise.id, type, cefr_level: course.cefr_level, unit: unit.title, lesson: lesson.title, prompt, stored_key: key, key_unchanged: true, options_before: exercise.options, options_after: patch.after.options, distractors_before: exercise.distractors ?? [], distractors_after: patch.after.distractors ?? (exercise.distractors ?? []), distractor_convention_held: mirrors, replaced_option: replaced, replacement_option: replacement, author_reason: reason, author_sources: sources, review: note });

  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id, field: 'options', before: exercise.options, after: patch.after.options, decision: 'approve_as_correction', rationale: `${note.collision} Replacement: ${note.replacement} Counter-evidence: ${note.counter}`, source_sha256: sourceSha, sources: [...sources, n === 765 ? TRECCANI_LAVARE : TRECCANI_COLLOQUIO].filter((v, i, a) => a.indexOf(v) === i && (n === 34 ? v !== TRECCANI_COLLOQUIO : true)) });

  if (Object.hasOwn(patch.after, 'distractors')) {
    fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id, field: 'distractors', before: exercise.distractors, after: patch.after.distractors, decision: 'approve_as_correction', rationale: `Re-mirrored to options-minus-key after the swap, which is the convention 3,134 of the 3,168 frozen listening_choice rows carry and which none of the 34 exceptions includes. Verified non-empty and set-equal to the patched options minus the key: an empty list on a listening_choice row would itself be a defect.`, source_sha256: sourceSha });
  }
}

for (const [n, lessonTitle, prompt, corrected, key, reason] of italianPromptSpacing) {
  const { exercise, lesson, unit, course, ref } = get(n);
  const patch = patches.get(exercise.id);
  if (Object.keys(patch.after).join() !== 'prompt') throw new Error(`${ref}: something other than the prompt moved`);
  if (prompt.replace('_____', key) !== 'Socialmedia (Social media)') throw new Error(`${ref}: the frozen prompt does not render as the reported defect`);
  if (corrected.replace('_____', key) !== 'Social media (Social media)') throw new Error(`${ref}: the correction does not render as two words`);
  if (corrected.replace(' _____', '_____') !== prompt) throw new Error(`${ref}: the correction changes more than the separating space`);
  rows.push({ ref, frozen_ref_number: n, exercise_id: exercise.id, type: exercise.type, cefr_level: course.cefr_level, unit: unit.title, lesson: lesson.title, prompt_before: prompt, prompt_after: corrected, stored_key: key, author_reason: reason });
  fields.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id, field: 'prompt', before: exercise.prompt, after: patch.after.prompt, decision: 'approve_as_correction', rationale: 'Confirmed as the same defect and the same correction as the already-approved it-E2190 and it-E2204: a blank welded to a preceding whole word, separated by inserting one space and changing nothing else. The key `media` is a separate word, and the filled prompt goes from `Socialmedia` to `Social media`. Note that this leaves a fifth instance of the class unfixed, it-E1008 `Meno_____ (Cheaper)` rendering as `Menocaro`; see the README.', source_sha256: sourceSha });
}

/** Coverage gaps: real defects of the same classes, on rows this producer does not touch. */
const UNFIXED_COLLISIONS = [
  { ref: 'it-E1074', type: 'listening_choice', cefr: 'A2', unit: 'Cultural Topics', prompt: 'Festa', key: 'Holiday', options: ['Festival', 'To celebrate', 'Holiday', 'Gift'], colliding_option: 'Festival', asserted_by: 'italian-accepted-alternatives.mjs adds "Festival" as a correct English answer for Festa at it-E1115' },
  { ref: 'it-E1876', type: 'listening_choice', cefr: 'B2', unit: 'Abstract Ideas', prompt: 'Etica', key: 'Ethics', options: ['Morality', 'Ethics', 'Freedom', 'Doubt'], colliding_option: 'Morality', asserted_by: 'italian-accepted-alternatives.mjs adds "Morality" as a correct English answer for Etica at it-E1839' },
  { ref: 'it-E1960', type: 'listening_choice', cefr: 'B2', unit: 'Debate & Argumentation', prompt: 'Tuttavia', key: 'However', options: ['Nevertheless', 'However', 'Claim', 'Evidence'], colliding_option: 'Nevertheless', asserted_by: 'italian-accepted-alternatives.mjs adds "Nevertheless" as a correct English answer for Tuttavia at it-E1923' },
];
const UNFIXED_SPACING = [
  { ref: 'it-E1008', type: 'fill_blank', cefr: 'A2', unit: 'Comparisons', lesson: 'Comparing People', prompt: 'Meno_____ (Cheaper)', key: 'caro', renders_as: 'Menocaro (Cheaper)', recommended_prompt: 'Meno _____ (Cheaper)', note: 'The sibling producer patches this row\'s accepted_answers, a different field, so a prompt fix would not contend with it.' },
];

const counts = fields.reduce((acc, f) => ({ ...acc, [f.decision]: (acc[f.decision] ?? 0) + 1 }), {});
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha, snapshot_sha256: SNAPSHOT_SHA, reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  grader: 'lib/grading.ts gradeAnswer, called with the runtime exerciseHints from lib/exercise-restore.ts',
  method: 'Each collision re-read against the frozen row and judged on whether two offered options are both correct with nothing narrowing the prompt; each replacement checked for being unambiguously wrong, plausible, at band and not a near-synonym of the key; distractor conventions re-derived from the frozen corpus rather than taken from the producer.',
  counts, unfixed_collisions_of_the_same_class: UNFIXED_COLLISIONS, unfixed_prompt_spacing_of_the_same_class: UNFIXED_SPACING, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, fields: fields.length, counts, unfixed_collisions: UNFIXED_COLLISIONS.map(c => c.ref), unfixed_spacing: UNFIXED_SPACING.map(c => c.ref) }, null, 1));
