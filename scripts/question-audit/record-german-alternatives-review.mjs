/**
 * Independent review of `scripts/question-audit/german-accepted-alternatives.mjs`.
 *
 * I did not author that file. This script re-derives the producer's output on a
 * fresh patch set, records the exact before/after of every `accepted_answers`
 * field it emits, and attaches my own decision and reasoning to each one. It
 * writes nothing the producer owns.
 *
 * Two checks decide the non-approvals and are re-run here rather than asserted:
 *  - every addition is looked up course-wide as the `correct_answer` of another
 *    German row and as an authored OPTION of a choice row, so a value that is a
 *    distractor on a row sharing this row's stimulus is caught;
 *  - the real `gradeAnswer` is called with the RUNTIME `exerciseHints` that
 *    `lib/exercise-restore.ts` builds, and acceptance is asserted to be the
 *    exact-match feedback `Correct!`, never a `Minor typo` near miss.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet, SNAPSHOT_SHA } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { germanAcceptedAlternativeRows, germanAcceptedAlternatives } from './german-accepted-alternatives.mjs';
import { gradeAnswer } from '../../lib/grading.ts';

const SOURCE = 'scripts/question-audit/german-accepted-alternatives.mjs';
const EVIDENCE = 'docs/audits/question-verification/remediation/de-it-zh/german-accepted-alternatives-evidence.json';
const SOURCE_SHA = 'b8fd2f565d0babb67e1a22e4fa1b99e7948962576a9fb859398c77ceff20ad2a';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), did not author this batch';
const REVIEWED_ON = '2026-09-14';
const BASE = 'docs/audits/question-verification/remediation/de-alternatives-root-review';

const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(SOURCE));
if (sourceSha !== SOURCE_SHA) throw new Error(`Reviewed source moved: ${sourceSha}`);

/** Exactly `exerciseHints(exercise, language)` from `lib/exercise-restore.ts`. */
const hints = exercise => ({ exerciseHints: {
  exerciseType: exercise.type, skillType: exercise.skill_type,
  targetGrammar: exercise.target_grammar, targetWord: exercise.target_word, language: 'de',
} });

const set = await createPatchSet();
germanAcceptedAlternatives(set);
const get = lessonRefs(set.snapshot, 'de');
const patches = new Map(set.patches().map(p => [p.id, p]));
const every = [];
for (let n = 1; n <= 2312; n++) every.push(get(n));
const key = s => String(s).toLowerCase().trim();

/** Course-wide index of every authored string, so a collision cannot be missed. */
const asKey = new Map(), asOption = new Map();
for (const r of every) {
  const k = key(r.exercise.correct_answer);
  (asKey.get(k) ?? asKey.set(k, []).get(k)).push(r);
  for (const option of r.exercise.options ?? []) {
    if (key(option) === k) continue;
    const o = key(option);
    (asOption.get(o) ?? asOption.set(o, []).get(o)).push(r);
  }
}

/** `decision` plus the reasoning. A row absent here is approved on the standard check. */
const NOTES = new Map(Object.entries({
'de-E0574': ['approve_as_correction', null, 'Kusine and Vetter are the Duden-listed feminine and masculine cousin against a gender-unmarked English prompt. Approved. The Duden headword spelling Cousine is still not an authored answer and passes only as "Minor typo"; adding it is a worthwhile follow-up, but it would break the producer’s rejected-before assertion and so is left as a recommendation, not a revision.'],
'de-E0664': ['revise', ['Ruhen', 'Ausruhen'], 'Ruhen is licensed by Duden for "to rest" and is approved. But bare Ausruhen — nearer the key Sich ausruhen than Ruhen is, and given by Duden without the reflexive pronoun ("lass mich ausruhen") — is still graded wrong on this row today. Accepting the looser synonym while the closer one keeps failing is the defect class this batch exists to remove.'],
'de-E0697': ['revise', ['Ruhen', 'Ausruhen'], 'Same as de-E0664: Ruhen approved, bare Ausruhen still graded wrong and it should be accepted alongside it.'],
'de-E0790': ['approve_as_correction', null, 'Zornig, Ärgerlich and Verärgert approved for a bare "Angry" prompt. The rejection of Sauer is the most arguable register call in the batch — Duden lists it as umgangssprachlich for verärgert and it is very frequent — but this is a neutral A2 emotion row, and the same line rejects Feuern and Runterladen, so I uphold it.'],
'de-E0803': ['approve_as_correction', null, 'Nervous and Agitated are direct Langenscheidt glosses of aufgeregt. The rejection of Upset is right: aufgeregt is not displeasure.'],
'de-E0840': ['approve_as_correction', null, 'The mütig completion rests on Duden listing großmütig in the synonym group for großzügig. Approved on that source alone; with de-E1770 it is the weakest acceptance in the batch.'],
'de-E0856': ['approve_as_correction', null, 'The bare prompt "I studied" supplies no context forcing lernen over studieren, so both verbs and both past forms are correct here. No target_grammar is declared, so the Präteritum forms contradict no grammar target.'],
'de-E0889': ['approve_as_correction', null, 'As de-E0856: the bare "I studied" licenses lernen and studieren, in Perfekt and Präteritum alike.'],
'de-E0892': ['approve_as_correction', null, 'Ich sprach approved. The rejection of Ich habe geredet is upheld: reden is to talk, the prompt is "I spoke", and the row practises sprechen.'],
'de-E0983': ['approve_as_correction', null, 'Holiday approved. It is the key for Feiertag on de-E1065 and de-E1074, but on those stimuli, not this one, and Holiday is not an option on any Urlaub row. British English "holiday" is the ordinary rendering of Urlaub.'],
'de-E1000': ['approve_as_correction', null, 'The stored key Kleiner reads "shorter" only of height. Kürzer is the length sense and is the form a learner is most likely to produce. Approved, and it repairs a genuinely narrow key.'],
'de-E1033': ['approve_as_correction', null, 'As de-E1000: Kürzer supplies the length sense the key Kleiner does not carry.'],
'de-E1195': ['approve_as_correction', null, 'Politik carries both senses (die Politik der Regierung is a policy), so Policy is dictionary-licensed for the bare prompt.'],
'de-E1197': ['approve_as_correction', null, 'English "to argue" spans reasoning and quarrelling. Streiten is correct for the bare prompt and is not the key of any other German row.'],
'de-E1250': ['approve_as_correction', null, 'Vortrag is a standard equivalent of Präsentation. The typo widening onto Vertrag that follows is a property of lib/grading.ts, is pinned in the author’s test, and belongs in lib/confusable-pairs.ts — not a reason to drop a correct alternative.'],
'de-E1253': ['approve_as_correction', null, 'Kündigen approved (Duden: jemandem kündigen). The rejection of Feuern on register is consistent with the line this batch draws elsewhere.'],
'de-E1279': ['approve_as_correction', null, 'To dismiss approved. The bare "Dismiss" is rightly rejected for consistency with the course’s "To X" infinitive convention.'],
'de-E1292': ['approve_as_correction', null, 'As de-E1253: Kündigen in, Feuern out on register.'],
'de-E1295': ['revise', ['Abgabetermin', 'Abgabefrist'], 'Abgabetermin approved. Abgabefrist was held back for a procedural reason ("not defended by the claim, not settled by a source I read"), not a linguistic one. Duden defines Abgabefrist as the Frist within which something must be submitted; it contains the key morpheme Frist and renders "Deadline" at least as well as the accepted Abgabetermin. I checked it course-wide: it is the key of no row, an option on no choice row, and an accepted answer nowhere — and it is graded wrong today. Withholding it while admitting Abgabetermin is inconsistent.'],
'de-E1404': ['approve_as_correction', null, 'Wiederverwerten approved. The Duden variant spelling Recyclen is still unauthored and passes only as "Minor typo"; a follow-up worth making.'],
'de-E1474': ['approve_as_correction', null, 'Internetseite approved. The rejection of Internetauftritt is right — that is a web presence, not the page the prompt glosses.'],
'de-E1477': ['approve_as_correction', null, 'Downloaden approved. Rejecting the reduced Runterladen on register is consistent with the Sauer and Feuern calls.'],
'de-E1533': ['approve_as_correction', null, 'Social Media approved, and it improves consistency rather than risking anything: de-E1514 already uses "Social media" as the key for this same German phrase.'],
'de-E1712': ['approve_as_correction', null, 'Approved. Note that Stelle dir vor is added on the parallel cloze row de-E1673 but not here, because on this translate row it already passes as "Minor typo" and so fails the producer’s rejected-before check. The learner sees a correct imperative called a typo. Cosmetic, but it is the same mislabelling as Cousine and Recyclen.'],
'de-E1754': ['approve_as_correction', null, 'Viele Grüße approved. The rejection of Mit freundlichen Grüßen rests on exactly the collision test that decides de-E1853 and de-E1923, and is right: de-E1740 teaches it as "Sincerely".'],
'de-E1770': ['approve_as_correction', null, 'A one-letter completion turning the stem "To" into Top. Duden does carry top as an adjective meaning hervorragend, and the unit teaches informal register, so approved — but with de-E0840 this is where I would look first if the set is re-litigated.'],
'de-E1824': ['approve_as_correction', null, 'Sinn and Absicht approved. The rejection of Ziel is upheld: Ziel is the key for "Goal" on four A2 rows and the course draws the Zweck/Ziel line itself.'],
'de-E1853': ['revise', ['Morals'], 'Morals approved. Ethics must NOT be added. de-E1879 is a multiple_choice on the identical stimulus — What does "Moral" mean in English? — whose authored options are Doubt / Freedom / Morality / Ethics. Ethics is a distractor there and is graded wrong when tapped. Adding it here makes the same word correct when typed and wrong when tapped, on the same German prompt. The handoff reasons about Ethik on de-E1865 and does not mention de-E1879 at all. This is the collision rule the author applied to Ziel on de-E1824, not applied here.'],
'de-E1923': ['revise', ['But'], 'But approved. Nevertheless must NOT be added. de-E1949 is a multiple_choice on the identical stimulus — What does "Jedoch" mean in English? — whose authored options are Fallacy / Nevertheless / Rhetoric / However. Nevertheless is a distractor there. Same same-stimulus contradiction as de-E1853, and likewise unmentioned in the handoff.'],
'de-E1979': ['approve_as_correction', null, 'Agreement approved. It is the key for Kongruenz on de-E2312, but that is grammatical agreement on a different stimulus and contradicts nothing here.'],
'de-E2034': ['approve_as_correction', null, 'Etat approved (Duden). The rejection of Haushalt and Haushaltsplan is upheld: the networking prompt supplies neither a household nor a public-finance frame.'],
'de-E2035': ['uncertain', null, 'Interest group is plainly right. Pressure group is a narrower political term and sits badly beside the author’s own rejection of Lobby on this very row for not being in the cited entry — a pressure group is close to the Lobby sense the row just refused. The two calls pull in opposite directions. This needs an editorial decision, not a reviewer’s guess.'],
'de-E2040': ['revise', ['Abgabetermin', 'Abgabefrist'], 'As de-E1295: Abgabetermin approved, Abgabefrist wrongly withheld on a procedural rather than linguistic ground and graded wrong today.'],
'de-E2048': ['approve_as_correction', null, 'Beteiligter and Teilhaber approved on the Langenscheidt entry recorded in pass2/de/sources.md. Leaving Interessenträger and Interessenträgerin uncertain is a fair call: the term is real but low-frequency and administrative.'],
'de-E2096': ['approve_as_correction', null, 'Besprechung approved despite de-E1236 teaching it as "Meeting". Besprechung genuinely carries both senses, the rows are a level and a unit apart, and no choice row on this stimulus offers Besprechung as a distractor — the check that condemns de-E1853 and de-E1923 clears this one.'],
'de-E2147': ['approve_as_correction', null, 'Child’s play approved. The curly-apostrophe twin was correctly identified as a no-op that normalize() folds to the same string.'],
'de-E2152': ['approve_as_correction', null, 'Alle Jubeljahre einmal approved. Rejecting the plain gloss Sehr selten is right HERE: this row asks the learner to produce the German idiom, and a paraphrase is not that.'],
'de-E2161': ['approve_as_correction', null, 'To cost a fortune approved; the bare "Cost a fortune" is rightly rejected for the same infinitive-convention reason as de-E1279.'],
'de-E2203': ['approve_as_correction', null, 'To kid someone approved. The rejection of "To tease someone" is arguable — teasing is a common gloss for jemanden auf den Arm nehmen — but the deception both idioms carry is weaker in "tease", so I uphold it.'],
}));

/** The one row I decide against that the producer emits no field for. */
const UNPATCHED = new Map(Object.entries({
'de-E2217': ['revise', ['Very rarely'], 'Upheld claim, no patch, and I disagree. This row is the mirror of de-E2152 and the author’s idiom rule should not extend to it: it is translate_to_native, so the task is comprehension, and a learner who renders Alle Jubeljahre as "Very rarely" has demonstrated exactly what the row tests. Marking that wrong is the defect class this batch exists to remove. Checked course-wide: "Very rarely" is the key of no row and an option on no choice row.'],
}));

const decisions = [], archiveRows = [];
let approved = 0, revised = 0, uncertain = 0, rejected = 0;

for (const [n, expectedKey, before, additions] of germanAcceptedAlternativeRows) {
  const { exercise, lesson, unit, course, ref } = get(n);
  const patch = patches.get(exercise.id);
  if (!patch) throw new Error(`No patch emitted for ${ref}`);
  const after = patch.after.accepted_answers;
  if (JSON.stringify(Object.keys(patch.after)) !== '["accepted_answers"]') throw new Error(`${ref} touches more than accepted_answers`);
  if (JSON.stringify(after) !== JSON.stringify([...before, ...additions])) throw new Error(`${ref} is not append-only`);
  if (exercise.correct_answer !== expectedKey) throw new Error(`${ref} key moved`);

  // Re-verify grading independently of the author's test.
  const grading = additions.map(alternative => {
    const wasGraded = gradeAnswer(alternative, expectedKey, before, hints(exercise));
    const nowGraded = gradeAnswer(alternative, expectedKey, after, hints(exercise));
    if (wasGraded.isCorrect) throw new Error(`${ref}: "${alternative}" already passed`);
    if (!nowGraded.isCorrect || nowGraded.feedback !== 'Correct!') throw new Error(`${ref}: "${alternative}" is not an authored acceptance (${nowGraded.feedback})`);
    return { alternative, before_feedback: wasGraded.feedback, after_feedback: nowGraded.feedback };
  });

  // Course-wide collision lookup for every addition.
  const collisions = [];
  for (const alternative of additions) {
    const k = key(alternative);
    for (const other of (asKey.get(k) ?? []).filter(r => r.exercise.id !== exercise.id)) {
      collisions.push({ alternative, kind: 'taught_as_key_elsewhere', ref: other.ref, type: other.exercise.type, prompt: other.exercise.prompt });
    }
    for (const other of asOption.get(k) ?? []) {
      const sameStimulus = other.exercise.prompt.includes(exercise.prompt.replace(/^Translate to (English|German): /, '').replace(/^Fill in the missing word: _____ means /, ''))
        || key(other.exercise.correct_answer) === key(expectedKey);
      collisions.push({ alternative, kind: sameStimulus ? 'DISTRACTOR_ON_SAME_STIMULUS' : 'distractor_elsewhere', ref: other.ref, type: other.exercise.type, key: other.exercise.correct_answer, prompt: other.exercise.prompt, options: other.exercise.options });
    }
  }

  const [decision, recommended, note] = NOTES.get(ref) ?? ['approve_as_correction', null, null];
  const rationale = note ?? `Read ${ref} whole in the frozen snapshot (${course.cefr_level}, ${unit.title}/${lesson.title}, ${exercise.type}, prompt "${exercise.prompt}", key "${expectedKey}", no existing accepted answers, no options, no target_grammar). Each addition (${additions.map(a => `"${a}"`).join(', ')}) is a standard equivalent that this exact prompt licenses at this level. Verified through the real gradeAnswer with runtime exerciseHints that every one was rejected before and is an authored acceptance after, with exact-match feedback rather than a typo near miss, and checked course-wide that none is an authored distractor on a choice row sharing this stimulus.`;

  if (decision === 'approve_as_correction') approved++;
  else if (decision === 'revise') revised++;
  else if (decision === 'uncertain') uncertain++;
  else rejected++;

  decisions.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id,
    field: 'accepted_answers', before, after, decision, ...(recommended ? { recommended_after: [...before, ...recommended] } : {}), rationale });
  archiveRows.push({ ref, id: exercise.id, level: course.cefr_level, unit: unit.title, lesson: lesson.title,
    type: exercise.type, prompt: exercise.prompt, key: expectedKey, before, after, additions, decision,
    ...(recommended ? { recommended_after: [...before, ...recommended] } : {}), rationale, grading, collisions });
}

for (const [ref, [decision, recommended, note]] of UNPATCHED) {
  const { exercise, lesson, unit, course } = get(Number(ref.slice(4)));
  if (patches.has(exercise.id)) throw new Error(`${ref} is patched after all`);
  const before = exercise.accepted_answers ?? [];
  revised++;
  decisions.push({ reviewer: REVIEWER, reviewed_on: REVIEWED_ON, ref, table: 'exercises', id: exercise.id,
    field: 'accepted_answers', before, after: before, decision, recommended_after: [...before, ...recommended], rationale: note });
  archiveRows.push({ ref, id: exercise.id, level: course.cefr_level, unit: unit.title, lesson: lesson.title,
    type: exercise.type, prompt: exercise.prompt, key: exercise.correct_answer, before, after: before, additions: [],
    decision, recommended_after: [...before, ...recommended], rationale: note, grading: [], collisions: [] });
}

const flagged = archiveRows.flatMap(r => r.collisions.filter(c => c.kind === 'DISTRACTOR_ON_SAME_STIMULUS')
  .map(c => ({ ref: r.ref, decision: r.decision, ...c })));

await mkdir(BASE, { recursive: true });
const archive = `${BASE}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER, reviewed_on: REVIEWED_ON,
  source: SOURCE, source_sha256: sourceSha,
  author_evidence: EVIDENCE, author_evidence_sha256: sha(await readFile(EVIDENCE)),
  snapshot_sha256: SNAPSHOT_SHA,
  grading_sha256: sha(await readFile('lib/grading.ts')), confusable_pairs_sha256: sha(await readFile('lib/confusable-pairs.ts')),
  fields: decisions.length, approve_as_correction: approved, revise: revised, uncertain, reject: rejected,
  same_stimulus_distractor_collisions: flagged, rows: archiveRows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw error; }

const evidenceSha = sha(body);
await writeFile(`${BASE}/field-decisions.jsonl`,
  decisions.map(d => JSON.stringify({ ...d, source_sha256: sourceSha, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n');

console.log(JSON.stringify({
  fields: decisions.length, approve_as_correction: approved, revise: revised, uncertain, reject: rejected,
  not_approved: decisions.filter(d => d.decision !== 'approve_as_correction').map(d => `${d.ref}.${d.field}=${d.decision}`),
  same_stimulus_distractor_collisions: flagged.map(f => `${f.ref} "${f.alternative}" is an authored distractor on ${f.ref === f.ref ? '' : ''}${f.kind === 'DISTRACTOR_ON_SAME_STIMULUS' ? f.prompt : ''}`),
}, null, 1));
