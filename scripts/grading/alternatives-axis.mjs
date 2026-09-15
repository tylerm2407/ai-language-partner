/**
 * What counting sibling ALTERNATIVES as taught strings would cost.
 *
 * `siblingKeys` (lib/grading.ts) refuses a candidate that exactly matches
 * another taught KEY. It deliberately ignores accepted alternatives, and this
 * script is the measurement behind that decision — emitted as data rather than
 * asserted, because it is a population two people cannot usefully argue about
 * from prose.
 *
 * WHAT THIS MEASURES, PRECISELY. It starts from the collisions
 * `widening-check.mjs` reports in corpus-audit mode: (row, candidate) pairs
 * where the row ACCEPTS a string the language teaches as something else. It
 * keeps the ones where the candidate is never a key anywhere in that language
 * but IS an accepted alternative on some other row — the class no sibling
 * scope can reach — and splits them:
 *
 *   breaks: true   some row with THIS ROW'S OWN KEY accepts that string, so it
 *                  is a correct answer for this key, just not written onto this
 *                  row. Counting alternatives would mark it wrong.
 *   breaks: false  no row keyed this way accepts it, so refusing it is safe.
 *
 * WHAT THIS IS NOT. It is not same-gloss-same-key divergence — every row pair
 * sharing a key where one accepts a string the other omits. That population is
 * larger, is not conditioned on a collision existing, and is the right input
 * for content levelling work. This one is conditioned on the grader currently
 * accepting the string by tolerance, so it answers only "what would break if
 * the grader's rule changed". The two overlap without being the same set.
 *
 * A caution for anyone using the `breaks` rows as a content worklist, and it is
 * the majority of them: 161 of the 249 sit on audio-stimulus rows —
 * `listening_type`, `dictation`, `speaking` — where the "missing" alternative
 * should stay missing. Accepting `Generosa` on a row that plays `Generoso` is
 * accepting a different spoken word, not levelling a gender pair. Only the 88
 * typed-cue rows (`translate_to_target`, `free_production`,
 * `translate_to_native`, `fill_blank`) are levelling candidates, and even those
 * want reading: `Einstellen` / `Anstellen` are two verbs, not one word in two
 * genders. Filter on `type` before treating any of this as a worklist.
 *
 * That also settles an apparent contradiction, so nobody re-opens it: a content
 * pass reporting ZERO diverging Italian groups and this file showing `Generoso`
 * diverging across four rows are both correct. The pass counts divergence among
 * typed rows, and the two rows keeping `Generosa` out here are the listening and
 * speaking ones — where it should stay out, because the audio says `Generoso`.
 *
 *   deno run -A --no-check --sloppy-imports scripts/grading/alternatives-axis.mjs \
 *     --snapshot .question-audit/snapshot-9a20145dc6b5.json \
 *     --collisions corpus-widening.json --json alternatives-axis.json
 *
 * Read-only. No database, no provider.
 */
import { readFile, writeFile } from 'node:fs/promises';

const args = new Map();
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) args.set(arg.slice(2), process.argv[i + 1]);
}
const snapshotPath = args.get('snapshot');
const collisionsPath = args.get('collisions');
if (!snapshotPath || !collisionsPath) {
  throw Error('--snapshot <frozen snapshot> and --collisions <widening-check corpus-audit json> are required');
}

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
const units = new Map(snapshot.units.map(u => [u.id, u]));
const courses = new Map(snapshot.courses.map(c => [c.id, c]));
const courseOf = e => units.get(lessons.get(e.lesson_id)?.unit_id)?.course_id;
const languageOf = e => courses.get(courseOf(e))?.target_language;
const norm = x => (x || '').normalize('NFC').toLowerCase().trim();
const fold = x => norm(x).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Where each string is a KEY, and which rows accept it as an ALTERNATIVE. */
const keyLanguages = new Map();
const acceptedBy = new Map();
for (const exercise of snapshot.exercises) {
  const language = languageOf(exercise);
  if (!language) continue;
  if (exercise.correct_answer) {
    const k = norm(exercise.correct_answer);
    (keyLanguages.get(k) ?? keyLanguages.set(k, new Set()).get(k)).add(language);
  }
  for (const alternative of exercise.accepted_answers ?? []) {
    const k = norm(alternative);
    (acceptedBy.get(k) ?? acceptedBy.set(k, []).get(k)).push(exercise);
  }
}

const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
const collisions = JSON.parse(await readFile(collisionsPath, 'utf8'));
const rows = [];
for (const finding of collisions.findings) {
  for (const { candidate, feedback } of finding.newly_accepted) {
    const row = byId.get(finding.id);
    if (!row) continue;
    const language = languageOf(row);
    const key = norm(candidate);
    // An accent fold of this row's own key is an accent question, not this one.
    if (fold(candidate) === fold(finding.key)) continue;
    // A taught key is reachable by widening the scope; that decision is made.
    if (keyLanguages.get(key)?.has(language)) continue;
    const accepting = (acceptedBy.get(key) ?? []).filter(e => languageOf(e) === language);
    if (accepting.length === 0) continue;

    const sameKey = accepting.filter(e => norm(e.correct_answer) === norm(finding.key));
    rows.push({
      breaks: sameKey.length > 0,
      exercise_id: row.id,
      language,
      type: row.type,
      key: finding.key,
      accepted_here: row.accepted_answers ?? [],
      would_be_refused: candidate,
      accepted_today_as: feedback,
      // Which rows already accept that string, and whether any of them is keyed
      // the same way as this one — that is what makes it a right answer here.
      accepted_as_an_alternative_on: accepting.map(e => ({
        exercise_id: e.id,
        type: e.type,
        key: e.correct_answer,
        same_key_as_this_row: norm(e.correct_answer) === norm(finding.key),
      })),
    });
  }
}

rows.sort((a, b) => Number(b.breaks) - Number(a.breaks) || a.language.localeCompare(b.language));
const breaks = rows.filter(r => r.breaks);
const perLanguage = {};
for (const r of breaks) perLanguage[r.language] = (perLanguage[r.language] ?? 0) + 1;

const report = {
  what_this_is: 'Collisions whose colliding string is only ever an accepted ALTERNATIVE, never a key. ' +
    'No sibling scope reaches them. `breaks: true` means some row with this row\'s own key accepts ' +
    'that string, so counting alternatives would mark a right answer wrong.',
  what_this_is_not: 'Same-gloss-same-key divergence across the corpus. That population is larger, is ' +
    'not conditioned on a collision, and is the right input for content levelling.',
  why_a_content_pass_may_report_fewer: 'A pass counting divergence among TYPED rows and this file can ' +
    'disagree without either being wrong: 161 of the breaking rows are audio-stimulus rows, where the ' +
    'absent alternative should stay absent. Italian Generoso is the worked example — diverging across ' +
    'four rows here, levelled among the typed ones.',
  snapshot: snapshotPath,
  snapshot_captured_at: snapshot.captured_at ?? null,
  collisions_source: collisionsPath,
  alternatives_only_collisions: rows.length,
  would_mark_a_right_answer_wrong: breaks.length,
  safe_to_refuse: rows.length - breaks.length,
  breaks_per_language: perLanguage,
  rows,
};
const out = args.get('json');
if (out) await writeFile(out, JSON.stringify(report, null, 1));

console.log(`${rows.length} collisions where the string is only an alternative`);
console.log(`  ${breaks.length} would mark a right answer wrong`, perLanguage);
console.log(`  ${rows.length - breaks.length} safe to refuse`);
for (const r of breaks.slice(0, 8)) {
  console.log(`  [${r.language}] ${r.exercise_id.slice(0, 8)} ${r.type}: key ${JSON.stringify(r.key)} ` +
    `would refuse ${JSON.stringify(r.would_be_refused)}, which ${r.accepted_as_an_alternative_on
      .filter(a => a.same_key_as_this_row).map(a => a.exercise_id.slice(0, 8)).join(', ')} accepts on the same key`);
}
