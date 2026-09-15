/** Independent remediation review of `scripts/question-audit/italian-accepted-alternatives.mjs`.
 *
 * The reviewer did not author the batch. Every row was re-read against the frozen
 * exercise — prompt, stored key, existing alternatives, lesson, unit and CEFR band — and
 * judged in that prompt's exact context, not against the author's summary.
 *
 * PROVENANCE. This review first ran against source SHA-256 `24ab03fd2eae...`, which held
 * 333 rows and 495 additions, and returned 2 rejections and 15 revisions. While the review
 * was in progress the producer and its test were revised in this shared worktree to SHA-256
 * `e38855e6794c...` — 331 rows and 508 additions. The delta was compared row by row against
 * the superseded archive and is exactly those 17 findings and nothing else: the two `Orario`
 * rows dropped, the 15 recommended forms appended in the recommended positions, no other row
 * added, removed or altered, no key or type touched. The reviewer does not know how that
 * revision came about and claims no causal credit for it. The superseded archive
 * `reviewed-source-24ab03fd2eae.json` is kept as the record of the version first reviewed.
 *
 * The three findings that drove those non-approvals, now resolved in the source:
 *
 *   - `Orario` for the gloss "(Time)" (it-E0230, it-E0274) was rejected. The handoff
 *     reinstated it on a WordReference reading; Treccani's `orario²` entry is explicit
 *     that the noun is the arrangement or the printed table of times — "predisposizione
 *     dell'ordine in cui determinati avvenimenti ... debbono succedersi nel tempo" — and
 *     not "time" or "hour" itself. That is the author's own "different sense" refusal
 *     ground, which refused bare `Bilancio` for "Budget" on the same reasoning. Both rows
 *     carry this as their only addition, so the recommendation is to drop the rows.
 *
 *   - Fifteen rows left a correct Italian form passing only through edit-distance
 *     tolerance, which the batch's own evidence says is not acceptance. A learner who
 *     writes `Pigra` for "Lazy" or `Sono andata` for "I went" is told "Minor typo". The
 *     batch contradicts itself here: for five glosses the `cloze_deletion` row gained the
 *     form and the `translate_to_target` row with the identical gloss and identical key
 *     did not — `Pigra` at it-E0841 but not it-E0808, `Più bassa` at it-E1033 but not
 *     it-E1000, `Meno cara` at it-E0997 but not it-E1030, `Più cara` at it-E1009 but not
 *     it-E1042, `Fico` at it-E1743 but not it-E1782.
 *
 *   - Applying this producer without extending its sibling leaves three Italian
 *     `listening_choice` rows offering an option this producer asserts is also correct:
 *     it-E1074 (Festa: "Festival" beside the key "Holiday"), it-E1876 (Etica: "Morality"
 *     beside "Ethics") and it-E1960 (Tuttavia: "Nevertheless" beside "However"). No test
 *     catches these, because the choice rows' own `accepted_answers` are untouched and the
 *     grader still returns exactly one right answer. They are recorded in the README
 *     rather than as field decisions, since the field that would change is on another row.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { italianAcceptedAlternatives, italianAlternativeRows } from './italian-accepted-alternatives.mjs';

const base = 'docs/audits/question-verification/remediation/it-alternatives-root-review';
const source = 'scripts/question-audit/italian-accepted-alternatives.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
const SUPERSEDED_SHA = '24ab03fd2eae92dd3b97eba5ff2dcec2b61f9517c987fd264dd62090fa97e6c3';
if (sourceSha !== 'e38855e6794c8295bca97f175fafc1661c9ba11a34e55dccf9254937b03ab8a0') {
  throw new Error(`Unreviewed source: ${source} is ${sourceSha}${sourceSha === SUPERSEDED_SHA ? ' (the superseded version this review first ran against)' : ''}`);
}

const TRECCANI_ORARIO = 'https://www.treccani.it/vocabolario/orario2/';

/** Rejected: the addition is not a correct answer to this prompt. */
const RESOLVED_REJECTIONS = new Map([
  [230, { rationale: 'The blank is glossed "(Time)" and the key completes to `Ora`. `Orario` is not a reading of bare "Time": Treccani\'s orario² is the arrangement of times or the printed table of them (a timetable, opening hours, a train schedule), never the hour itself. This is the same "different sense" ground on which the batch refused bare `Bilancio` for "Budget". It is the row\'s only addition, so the row should be dropped rather than narrowed.', sources: [TRECCANI_ORARIO] }],
  [274, { rationale: 'Identical prompt, key and addition to it-E0230, and rejected for the same reason: Treccani\'s orario² is a timetable, not "time". The row\'s only addition, so the row should be dropped.', sources: [TRECCANI_ORARIO] }],
]);

/** Revised: everything added is correct, but the row still leaves a correct Italian form
 * passing only as a "Minor typo". `extra` is appended to the authored result. */
const RESOLVED_REVISIONS = new Map([
  [42, { extra: ['Scusa'], rationale: 'The row adds `Scusami` and `Scusatemi` but not the plain informal `Scusa`, which is the most likely learner answer to "Excuse me" and currently passes only as a minor typo of `Scusi`.' }],
  [124, { extra: ['Deliziosa'], rationale: 'The prompt names no referent and the row already accepts both genders of the alternative (`Squisito`/`Squisita`), so the feminine of the key is licensed on the batch\'s own `gender` ground. It currently passes only as a minor typo.' }],
  [212, { extra: ['Costosa'], rationale: 'The row accepts `Cara` beside `Caro` but not `Costosa` beside the key `Costoso`. The feminine of the key is equally grammatical for an ungendered "Expensive" and currently passes only as a minor typo.' }],
  [224, { extra: ['Economica'], rationale: 'The prompt names no referent, so the feminine of the key is equally grammatical for "Cheap". It currently passes only as a minor typo.' }],
  [496, { extra: ['Sana'], rationale: 'The feminine of the key is equally grammatical for an ungendered "Healthy" and currently passes only as a minor typo.' }],
  [528, { extra: ['Malata'], rationale: 'The row accepts `Ammalata`, the feminine of the synonym, but not `Malata`, the feminine of the key itself. `Malata` currently passes only as a minor typo.' }],
  [540, { extra: ['Sana'], rationale: 'Identical prompt and key to it-E0496, and the same omission: the feminine of the key passes only as a minor typo.' }],
  [790, { extra: ['Arrabbiata'], rationale: 'The feminine of the key is equally grammatical for an ungendered "Angry" and currently passes only as a minor typo.' }],
  [808, { extra: ['Pigra'], rationale: 'it-E0841 carries the identical gloss "Lazy" and the identical key `Pigro` and was given `Pigra`; this row was not. The batch contradicts itself on two rows of the same word, and `Pigra` currently passes only as a minor typo.' }],
  [832, { extra: ['Orgogliosa'], rationale: 'The row accepts `Fiera`, the feminine of the synonym, but not `Orgogliosa`, the feminine of the key. It currently passes only as a minor typo.' }],
  [862, { extra: ['Sono andata'], rationale: 'With `essere` the past participle agrees with the subject, so a female learner rendering "I went" writes `Sono andata`. That is fully correct Italian and currently passes only as a minor typo. (The `Ho`-auxiliary rows in this unit are unaffected: with `avere` the participle does not agree with the subject.)' }],
  [1000, { extra: ['Più bassa'], rationale: 'it-E1033 carries the identical gloss "Shorter" and the identical key `Più basso` and was given `Più bassa`; this row was not. It currently passes only as a minor typo.' }],
  [1030, { extra: ['Meno cara'], rationale: 'it-E0997 carries the identical gloss "Cheaper" and the identical key `Meno caro` and was given `Meno cara`; this row was not. It currently passes only as a minor typo.' }],
  [1042, { extra: ['Più cara'], rationale: 'it-E1009 carries the identical gloss "More expensive" and the identical key `Più caro` and was given `Più cara`; this row was not. It currently passes only as a minor typo.' }],
  [1782, { extra: ['Fico'], rationale: 'it-E1743 carries the identical gloss "Cool" and the identical key `Figo` and was given the attested spelling variant `Fico`; this row was given only `Forte`. `Fico` currently passes only as a minor typo. (The feminine `Figa` is deliberately not recommended: it is vulgar slang, not the feminine of `figo` in this sense.)' }],
]);

/** Row-specific confirmations for additions a reviewer should not wave through on the
 * grounds label alone. Everything else is confirmed against its grounds, below. */
const NOTES = new Map([
  [2, 'Ciao is goodbye as well as hello and Addio is the permanent farewell; both answer "Goodbye" with nothing in the prompt narrowing it.'],
  [3, 'Buongiorno is the ordinary formal Hello in the daytime, which is the same reading the sibling collision producer relies on at it-E0034.'],
  [68, 'ArrivederLa is the formal counterpart of arrivederci and the stem admits it. The grader matches accepted answers case-insensitively, so the lowercase arrivederla passes on this entry too — verified against the patched row.'],
  [230, 'Rejected; see REJECT.'],
  [274, 'Rejected; see REJECT.'],
  [389, 'Figlio is son and also child-of-someone ("ho due figli"), which is the sense a bare gloss leaves open.'],
  [520, 'Male as a noun is the ordinary word for pain ("mi fa male"), so it answers a bare "Pain".'],
  [743, 'Lavare glossed as "To clean" is the same equivalence the sibling producer acts on at it-E0765. The two stand or fall together: a reviewer who rejects the option swap there should reject this addition too. Noted as a coupling, not as a defect.'],
  [808, 'Revised; see REVISE. Separately, Treccani frames svogliato as lack of will and indolence rather than laziness proper, so Svogliato/Svogliata for "Lazy" is a near-synonym rather than an equivalent. It is left in place as a free-text answer, but it is the weakest pair in this batch and is flagged in the README as an open editorial point.'],
  [841, 'Carries Pigra, which the identically keyed it-E0808 lacks. The Svogliato/Svogliata caveat recorded at it-E0808 applies here too.'],
  [1008, 'The addition `costoso` is correct and approved. Separately, this row carries an unfixed rendering defect that belongs to the sibling producer: the prompt is `Meno_____ (Cheaper)`, so the filled answer reads `Menocaro`. See the README.'],
  [1074, 'Not a row in this batch. Recorded in the README: this batch makes its options ambiguous.'],
  [1390, 'Contaminazione for "Pollution" is confirmed: Treccani gives contaminazione as covering infection and pollution, cites atmospheric contamination, and treats inquinamento as synonymous for the mass or volume sense.'],
  [1517, 'Caricare is to load, to charge and to upload; "To charge" is a correct reading of the bare verb.'],
  [1533, '"Media sociali" is a literal calque rather than the idiomatic Italian, which is "social media" or "i social". It is not wrong, and accepting it costs nothing on a free-text row.'],
  [1799, 'Treccani gives tipo the colloquial sense of an individual or person ("un tipo strano"), which supports the guy/dude reading. Note the batch refused Ragazzo for the same gloss; tipo is the closer of the two in register, so the asymmetry holds.'],
  [2034, 'Bilancio preventivo is accepted while bare Bilancio was refused; the qualified form is the standard Italian for a budget and the distinction is correct.'],
  [2166, 'Svelare/Rivelare un segreto are meaning-level renderings rather than idioms, which is what the idiom ground licenses: the learner is asked to translate the sense, not to reproduce one fixed form.'],
]);

/** Independent confirmation of each licensing ground, in the reviewer's own words. */
const GROUNDS = {
  lexical: 'an ordinary dictionary equivalent of the key, with nothing in the bare prompt narrowing the sense',
  gender: 'the English carries no gender and the prompt names no referent, so the counterpart Italian form is equally grammatical',
  register: 'the same referent in a neighbouring register, with no register cue in the prompt',
  completion: 'the visible stem admits this completion as well as the keyed one, and the prompt selects neither',
  pronoun: 'Italian licenses an explicit subject pronoun and nothing in the prompt forbids one',
  perfect: 'the passato prossimo renders as English present perfect as well as simple past, and no finished-time adverbial is supplied',
  participle: 'both are standard past participles of the same verb',
  reflexive: 'the reflexive is a standard reading of the objectless English infinitive',
  person: 'the prompt names no addressee, so the other persons of the same verb are equally licensed',
  idiom: 'a standard equivalent of the same figurative sense; the learner translates the idiom, not one fixed form',
};

const set = await createPatchSet();
italianAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'it');
const patches = new Map(set.patches().map(p => [p.id, p]));
if (patches.size !== 331) throw new Error(`Expected 331 patches, replayed ${patches.size}`);
for (const n of RESOLVED_REJECTIONS.keys()) {
  if (italianAlternativeRows.some(r => r[0] === n)) throw new Error(`Rejected row ${n} is still present in the source`);
}

const rows = [], fields = [];
for (const [n, type, lessonTitle, key, current, additions, grounds] of italianAlternativeRows) {
  const { exercise, lesson, unit, course, ref } = get(n);
  const patch = patches.get(exercise.id);
  if (!patch) throw new Error(`${ref}: the producer emitted no patch`);
  const after = patch.after.accepted_answers;
  if (Object.keys(patch.after).length !== 1) throw new Error(`${ref}: the producer moved a field other than accepted_answers`);

  // Neither map yields a live decision against this source: the rejected rows are gone
  // (asserted above) and every recommended form is present. The `revised` check is kept
  // live rather than hard-coded, so that if a form is ever dropped again the review
  // re-raises the revision instead of silently approving.
  const rejected = undefined;
  const wanted = RESOLVED_REVISIONS.get(n);
  const revised = wanted && !wanted.extra.every(e => after.some(x => x.toLowerCase() === e.toLowerCase())) ? wanted : undefined;
  const decision = rejected ? 'reject' : revised ? 'revise' : 'approve_as_correction';
  const note = NOTES.get(n);
  const groundsText = grounds.map(g => GROUNDS[g] ?? g).join('; ');
  const rationale = rejected ? rejected.rationale
    : revised ? `${revised.rationale} The additions themselves are correct (${groundsText}).`
    : `Re-read in context against the frozen row (${course.cefr_level}, ${unit.title} > ${lessonTitle}, key ${JSON.stringify(key)}). Every addition is a correct answer to this exact prompt: ${groundsText}.${note ? ` ${note}` : ''}`;

  rows.push({ ref, frozen_ref_number: n, exercise_id: exercise.id, type, cefr_level: course.cefr_level, unit: unit.title, lesson: lesson.title, prompt: exercise.prompt, stored_key: key, accepted_answers_before: current, accepted_answers_after: after, additions, grounds, decision, note: note ?? null });

  fields.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id,
    field: 'accepted_answers', before: exercise.accepted_answers, after, decision, rationale,
    source_sha256: sourceSha,
    ...(rejected ? { recommended_after: exercise.accepted_answers, recommended_action: 'drop this row from the producer; its only addition is refused' } : {}),
    ...(revised ? { recommended_after: [...after, ...revised.extra] } : {}),
    ...(rejected?.sources ? { sources: rejected.sources } : {}),
  });
}

/** Choice rows this batch makes ambiguous. The field that would change lives on another
 * row, so these are reported rather than decided here. */
const IMPLIED_COLLISIONS = [
  { ref: 'it-E1074', type: 'listening_choice', cefr: 'A2', prompt: 'Festa', key: 'Holiday', options: ['Festival', 'To celebrate', 'Holiday', 'Gift'], colliding_option: 'Festival', asserted_by: 'it-E1115 adds "Festival" as a correct English answer for Festa' },
  { ref: 'it-E1876', type: 'listening_choice', cefr: 'B2', prompt: 'Etica', key: 'Ethics', options: ['Morality', 'Ethics', 'Freedom', 'Doubt'], colliding_option: 'Morality', asserted_by: 'it-E1839 adds "Morality" as a correct English answer for Etica' },
  { ref: 'it-E1960', type: 'listening_choice', cefr: 'B2', prompt: 'Tuttavia', key: 'However', options: ['Nevertheless', 'However', 'Claim', 'Evidence'], colliding_option: 'Nevertheless', asserted_by: 'it-E1923 adds "Nevertheless" as a correct English answer for Tuttavia' },
];

/** Follow-up decisions, written after the lead applied all 17 findings.
 *
 * `review-current.mjs` attaches a decision to a draft field only on an exact deepEqual of
 * both `before` and `after`. The original 15 `revise` entries carry the pre-revision
 * `after`, so they match the applied draft only through its `recommended_after` branch and
 * land on `reviewer_requested_revision_applied_pending_verification`. These entries carry
 * the applied value itself, so they close to `exact_value_independently_approved`.
 *
 * Every before/after below is RE-DERIVED from the frozen row and the current producer
 * against the grader as it stands now, not reused from the first pass. That matters: the
 * confusable-pair list and the typo budget both moved today, so a recorded "passed by
 * tolerance" from the earlier run is not evidence about the current grader. Re-derived,
 * all 15 forms are still tolerance-passes rather than outright rejections, and all 508
 * additions are authored-accepted after the patch with no "Minor typo" on any row.
 *
 * The two rejected rows emit no patch at all now, so no draft field exists for them to
 * close against and no approval is owed. They are recorded as `reject` pinned to the exact
 * value that was refused, so that if either row ever returns carrying `rario` the decision
 * re-attaches instead of the row arriving unreviewed. */
const followups = [];
for (const [n, , , , , additions] of italianAlternativeRows) {
  const wanted = RESOLVED_REVISIONS.get(n);
  if (!wanted) continue;
  const { exercise, ref, course, unit, lesson } = get(n);
  const after = patches.get(exercise.id).after.accepted_answers;
  for (const form of wanted.extra) {
    if (!after.some(x => x.toLowerCase() === form.toLowerCase())) throw new Error(`${ref}: recommended form ${form} is absent from the applied value`);
    if (!additions.some(x => x.toLowerCase() === form.toLowerCase())) throw new Error(`${ref}: recommended form ${form} is not among the row's additions`);
  }
  followups.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id,
    level: course.cefr_level, unit: unit.title, lesson: lesson.title,
    field: 'accepted_answers', before: exercise.accepted_answers, after,
    decision: 'approve_as_correction',
    rationale: `Follow-up: the reviewer's recommended_after was applied verbatim and is re-verified against the current grader. ${wanted.rationale} Re-derived now: ${JSON.stringify(wanted.extra)} was not authored-accepted before the patch (it passed only through edit-distance tolerance, which reports "Minor typo") and is authored-accepted after it. No stored key or pre-existing alternative regressed, and all 712 Italian choice rows still return exactly one right answer.`,
    source_sha256: sourceSha, superseded_source_sha256: SUPERSEDED_SHA, snapshot_sha256: SNAPSHOT_SHA,
    reviewer_recommended: wanted.extra,
  });
}
for (const [n, resolved] of RESOLVED_REJECTIONS) {
  // lessonRefs indexes all 2,312 frozen Italian rows by ref number, so the dropped rows
  // are still reachable even though the producer no longer emits them.
  const { exercise, ref, course, unit, lesson } = get(n);
  followups.push({
    reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id,
    level: course.cefr_level, unit: unit.title, lesson: lesson.title,
    field: 'accepted_answers', before: exercise.accepted_answers, after: [...exercise.accepted_answers, 'rario'],
    decision: 'reject',
    rationale: `${resolved.rationale} The row was dropped from the producer and now emits no patch, so nothing is owed an approval. This entry is pinned to the exact refused value so the refusal re-attaches if the row ever returns.`,
    source_sha256: sourceSha, superseded_source_sha256: SUPERSEDED_SHA, snapshot_sha256: SNAPSHOT_SHA,
    recommended_after: exercise.accepted_answers, sources: resolved.sources,
  });
}

const counts = fields.reduce((acc, f) => ({ ...acc, [f.decision]: (acc[f.decision] ?? 0) + 1 }), {});
await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  source, source_sha256: sourceSha, superseded_source_sha256: SUPERSEDED_SHA,
  superseded_review: 'reviewed-source-24ab03fd2eae.json — 333 rows, 495 additions, 2 rejected, 15 revised; the source was revised mid-review to adopt all 17 and nothing else',
  snapshot_sha256: SNAPSHOT_SHA, reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  grader: 'lib/grading.ts gradeAnswer, called with the runtime exerciseHints from lib/exercise-restore.ts',
  method: 'Each row re-read against the frozen exercise in its own lesson, unit and CEFR band; decided in that prompt\'s exact context. Acceptance asserted only where the grader returns isCorrect without "Minor typo".',
  counts, implied_choice_collisions: IMPLIED_COLLISIONS, rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
await writeFile(`${base}/followup-field-decisions.jsonl`, followups.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
const followupCounts = followups.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {});
console.log(JSON.stringify({ rows: rows.length, fields: fields.length, counts, followups: followups.length, followup_counts: followupCounts, implied_choice_collisions: IMPLIED_COLLISIONS.map(c => c.ref), pending: fields.filter(f => f.decision !== 'approve_as_correction').map(f => `${f.ref}.${f.field}:${f.decision}`) }, null, 1));
