/**
 * Independent re-adjudication of the 30 held boundary rows.
 *
 * The author replaced all 30 (keep 0). This reviewer re-read every row of all
 * six affected lessons (ES/JA/KO Hobbies & Interests, ES/JA/KO Film & Theater)
 * in the frozen snapshot, plus their sibling lessons, before deciding. A record
 * script is bookkeeping, not a review: the judgements below were made first.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { heldBoundaryFixes, heldBoundaryRepairs } from './es-ja-ko-held-boundary-fixes.mjs';

const base = 'docs/audits/question-verification/remediation/held-boundary-root-review';
const source = 'scripts/question-audit/es-ja-ko-held-boundary-fixes.mjs';
const REVIEWER = 'independent reviewer (Claude Opus 5, session 2026-09-14), independent of author';
const REVIEWED_ON = '2026-09-14';
const sha = x => createHash('sha256').update(x).digest('hex');

const sourceSha = sha(await readFile(source));
if (sourceSha !== 'fdcbc6b0c7a9b10a911b29cc8b71b911537b6fee51ecf3d4596056d1449386ae') throw Error('Unreviewed source');

const set = await createPatchSet();
heldBoundaryFixes(set);

/**
 * Per-row keep/replace adjudication, made independently of the author's
 * dispositions file. `link` records what a keep would have required and what
 * was actually found in the lesson.
 */
const ADJUDICATION = {
  film: {
    decision: 'replace',
    link: 'No learner-visible link found. The Film & Theater lesson contains no film or theater word at all: its complete non-speaking set is Painting, Sculpture, Metaphor, Symbolism, Genre, Protagonist, Plot twist, Review, Masterpiece, Inspiration, and two listening pairs. No row, lesson description (the bare title "Film & Theater"), hint, option or speaking prompt mentions a set, props, scenery, a backdrop, a stage, or a film containing a painting. Painting and Sculpture are the only two items in the lesson that are specifically visual-arts rather than film/theater or general criticism, so the four selected rows are the correct subset. Verified that the sibling lesson Describing Art (order 0, same unit) still teaches both in every language, so the unit does not lose them.',
  },
  hobbies: {
    decision: 'replace',
    link: 'No learner-visible link found. The Hobbies & Interests lesson is a bare-gloss word list with no sentence anywhere: every row is a single label ("Caliente" -> Hot, Cold -> Frio, Verano -> Summer, Invi_____ (Winter)) or a one-word listening prompt. The lesson description is the bare title; the unit description is "Discuss jobs, hobbies, and make plans". No row, hint, option, tile or speaking prompt pairs a season or temperature with an activity, so nothing supplies the seasonal-leisure framing a keep would require. Verified that the adjacent Weather & Seasons lesson (order 3, same unit) still teaches Hot/Cold/Summer/Winter in every language.',
  },
};
const group = n => (n >= 2000 ? 'film' : 'hobbies');

/** Per-row rationale for the replacement content itself (key, options, level fit). */
const ROW_NOTES = new Map([
  ['es-E0309', 'Bailar = to dance is core A1 hobby vocabulary. Options are four verbs; only To dance is correct. To sing appears as a distractor and is the key of E0310, which reinforces rather than conflicts.'],
  ['es-E0310', 'Cantar is the single natural rendering of to sing. No alternative is needed; the grader is case- and accent-insensitive for Spanish.'],
  ['es-E0311', 'Dibujar = to draw. Correctly does NOT accept the paint variants used for JA/KO: Spanish separates dibujar from pintar, and the grader was confirmed to reject "To paint" here.'],
  ['es-E0312', 'Deporte with a single blank at "Depor_____ (Sport)", matching the frozen fill_blank shape. Key "te" grades correctly.'],
  ['es-E0315', 'Guitarra as a dictation transcript with the English hint Guitar; transcript, key and hint agree. Card link detached because the frozen card means Summer.'],
  ['es-E0316', 'Guitar is unique among To cook / Guitar / Soccer / To read; distractors mirror options minus the key, as every frozen listening_choice row does.'],
  ['es-E2089', 'Guion is film/theater vocabulary and unambiguously means script or screenplay. The RAE-current unaccented spelling is used in the prompt and the accented variant is noted in the explanation. Screenplay is not offered as an option, so the single key is unambiguous.'],
  ['es-E2090', 'Escenario is the standard word for a theater stage. The parenthetical "(of a theater)" is load-bearing: without it, etapa or fase would be defensible answers. El escenario is accepted and the grader rejects escena, etapa and tablas.'],
  ['es-E2099', 'Publico = audience is a film/theater term. Transcript, key and hint agree; the grader accepts the answer with or without the accent.'],
  ['es-E2100', 'Audience is unique among Genre / Audience / Poem / Inspiration, a one-word swap from the frozen option set.'],
  ['ja-E0309', 'Odoru = to dance, dictionary form, consistent with the lesson\'s yomu and ryori suru. Only To dance is correct among the four verbs.'],
  ['ja-E0310', 'Utau in dictionary form matches the lesson\'s other verbs; the kana reading utau is accepted. Polite forms are not accepted, which matches the frozen rows in this lesson.'],
  ['ja-E0311', 'E wo kaku is the natural Japanese for to draw and uses the wo particle correctly. Accepting the paint variants is right for Japanese, where kaku covers drawing and painting alike.'],
  ['ja-E0312', 'Supotsu is the natural answer and the row stays a cloze, matching the frozen type. The key itself is correct; see the separate decision on its alternatives.'],
  ['ja-E0315', 'Gita as a dictation transcript with the English hint Guitar; transcript, key and hint agree. Card link detached because the frozen card means Summer.'],
  ['ja-E0316', 'Guitar is unique among the four options; distractors mirror options minus the key.'],
  ['ja-E2089', 'Kyakuhon is the standard Japanese for a script or screenplay and is squarely film/theater vocabulary. Script is unique among the options.'],
  ['ja-E2090', 'Butai is the theater stage; butai in kana and suteji are both accepted and both natural.'],
  ['ja-E2099', 'Kankyaku = audience. Adding the kana reading as an accepted answer is an improvement over the frozen row, which accepted nothing, because a listener may type kana.'],
  ['ja-E2100', 'Audience is unique among Audience / Metaphor / Inspiration / Symbolism, a one-word swap from the frozen option set.'],
  ['ko-E0309', 'Chumchuda = to dance, dictionary form, consistent with the lesson\'s ilkda and yorihada. Only To dance is correct.'],
  ['ko-E0310', 'Noraehada is standard; the three accepted variants are all natural Korean and all grade correctly. Dictionary form matches the lesson, so haeyoche is not expected here.'],
  ['ko-E0311', 'Geurimeul geurida is the natural Korean for to draw. Accepting the paint variants is right, since geurida covers drawing and painting.'],
  ['ko-E0312', 'Seupocheu with a single blank at "seupo_____ (Sport)", matching the frozen fill_blank shape.'],
  ['ko-E0315', 'Gita as a dictation transcript with the English hint Guitar. The gita homograph (guitar versus etcetera) carries no risk on a type-what-you-hear row, where the learner reproduces the audio regardless of sense, and the English hint disambiguates. Card link detached because the frozen card means Summer.'],
  ['ko-E0316', 'Guitar is unique among To cook / Soccer / Guitar / To read, and the etcetera reading is not offered, so the homograph cannot produce a defensible second answer.'],
  ['ko-E2089', 'Gakbon means script or screenplay and is film/theater vocabulary. The row is multiple choice with an English key, so the equally usable daebon does not need to be accepted.'],
  ['ko-E2090', 'Mudae is the standard theater stage. No alternative is needed; seuteiji is a loanword used mainly for concert stages and the grader rejects it.'],
  ['ko-E2099', 'Gwangaek = audience. Hangul has a single spelling, so no alternative is required.'],
  ['ko-E2100', 'Audience is unique among Novel / Audience / Poem / Masterpiece, a one-word swap from the frozen option set.'],
]);

/** Field-level departures from approve_as_correction. */
const FIELD_OVERRIDES = new Map([
  ['ja-E0312.accepted_answers', {
    decision: 'revise',
    recommended_after: [],
    rationale:
      'Undo, not a wrong key: the key supotsu is correct, but accepting undo (and its kana reading) for Sport contradicts this curriculum\'s own gloss. The frozen snapshot keys undo as Exercise in the Japanese A2 course (Health & Wellness, Healthy Lifestyle translate_to_target, plus the Review & Test multiple_choice, listening_type, listening_choice and speaking rows, all bound to card aabbccdd-6666-2002-c012-a20000000000). A learner who meets both is told undo = Exercise at A2 while being credited for undo = Sport at A1. Undo primarily means exercise, motion or physical activity and reads as sport only in compounds such as undokai and undobu; supotsu is the unmarked answer to "_____ means Sport". Confirmed with the real gradeAnswer that both alternatives currently pass. Recommend emptying accepted_answers so the row keys supotsu alone.',
    sources: [
      'frozen snapshot 8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f: ja A2 Health & Wellness / Healthy Lifestyle translate_to_target "Translate to Japanese: Exercise" key undo; card aabbccdd-6666-2002-c012-a20000000000 undo = Exercise',
      'https://dictionary.goo.ne.jp/word/%E9%81%8B%E5%8B%95/',
    ],
  }],
]);

const idmap = new Map();
for (const p of heldBoundaryRepairs) {
  const c = lessonRefs(set.snapshot, p.language)(p.n);
  idmap.set(c.exercise.id, { ref: c.ref, n: p.n, lang: p.language, full: c, oldKey: p.oldKey });
}

const rows = [], fields = [];
for (const patch of set.patches()) {
  const meta = idmap.get(patch.id);
  if (!meta) throw Error(`Unexpected patch outside the reviewed batch: ${patch.id}`);
  const { ref, full, oldKey } = meta;
  const adj = ADJUDICATION[group(meta.n)];
  const rowNote = ROW_NOTES.get(ref);
  if (!rowNote) throw Error(`No independent rationale recorded for ${ref}`);
  rows.push({
    ref,
    table: 'exercises',
    id: patch.id,
    language: meta.lang,
    cefr_level: full.course.cefr_level,
    unit: { title: full.unit.title, description: full.unit.description, order_index: full.unit.order_index },
    lesson: { id: full.lesson.id, title: full.lesson.title, description: full.lesson.description, order_index: full.lesson.order_index },
    frozen_type: full.exercise.type,
    original_label: oldKey,
    keep_or_replace: adj.decision,
    keep_evidence_search: adj.link,
    replacement_rationale: rowNote,
    before: patch.before,
    after: patch.after,
  });
  for (const [field, after] of Object.entries(patch.after)) {
    const override = FIELD_OVERRIDES.get(`${ref}.${field}`);
    fields.push({
      reviewer: REVIEWER,
      reviewed_on: REVIEWED_ON,
      ref,
      table: 'exercises',
      id: patch.id,
      field,
      before: patch.before[field],
      after,
      decision: override?.decision ?? 'approve_as_correction',
      rationale: override?.rationale ?? `${adj.link} ${rowNote}`,
      source_sha256: sourceSha,
      ...(override?.recommended_after !== undefined ? { recommended_after: override.recommended_after } : {}),
      ...(override?.sources ? { sources: override.sources } : {}),
    });
  }
}
if (rows.length !== 30) throw Error(`Expected thirty reviewed rows, got ${rows.length}`);

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({
  reviewer: REVIEWER,
  reviewed_on: REVIEWED_ON,
  snapshot_sha256: '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f',
  source, source_sha256: sourceSha,
  independent_adjudication: ADJUDICATION,
  rows,
}, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); }
catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
const evidenceSha = sha(body);
await writeFile(`${base}/field-decisions.jsonl`,
  fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: evidenceSha })).join('\n') + '\n');

const tally = fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {});
console.log(JSON.stringify({
  rows: rows.length,
  kept: rows.filter(r => r.keep_or_replace === 'keep').length,
  replaced: rows.filter(r => r.keep_or_replace === 'replace').length,
  fields: fields.length,
  tally,
  not_approved: fields.filter(f => f.decision !== 'approve_as_correction').map(f => `${f.ref}.${f.field} (${f.decision})`),
}));
