/**
 * Round three: the Japanese orthography ruling.
 *
 * `docs/audits/question-verification/round2-triage/needs-human.md` left two
 * decisions open. This builder implements the first of them — Decision 1,
 * Japanese orthography on written-production rows — and only that one. Decision
 * 2 (register) is untouched and still open.
 *
 * THE RULING: accept the reading. On a row whose cue is an English gloss
 * (`Translate to Japanese: Right`, `Fill in the missing word: _____ means
 * Society`), a correct Japanese word written in the other script is a correct
 * answer. 61 rows, 66 additions.
 *
 * WHY, in the order the reasons actually carry weight:
 *
 * 1. The corpus does not hold the rule it would be enforcing. `明日`, `社会` and
 *    `椅子` are keyed in kanji while `まっすぐ`, `おいしい`, `すごい`, `たぶん`,
 *    `さらに` and `めったに` are keyed in kana, and `ご飯`, `お風呂` and
 *    `もっと大きい` are mixed. Refusing means telling a learner their correct
 *    Japanese is wrong for breaking a convention the course itself breaks and
 *    never states.
 *
 * 2. The item is testing the wrong thing. An English gloss asks whether the
 *    learner knows the word, not whether they can write it in kanji. Grading on
 *    script folds an orthographic skill into a vocabulary item, which is
 *    exactly the conflation the five-strand measured level is built to avoid.
 *
 * 3. The costs are asymmetric in time. These are exact-match additions, so they
 *    can be withdrawn later with no residue; a learner told their correct answer
 *    is wrong cannot be un-told.
 *
 * What this ruling deliberately does NOT do is drop the kanji requirement. It
 * drops the requirement from items that never asked for it. If producing kanji
 * should be graded, it needs a cue that says so — an explicit instruction or an
 * orthography item type — and that is a content change, not a grader rule.
 *
 * SCOPE. Every candidate the triage filed under `ja_script_policy` (65 across
 * 61 rows), plus one more: `ja-E0462`'s katakana `イス`, filed under
 * `individual` because it is katakana rather than kana, whose own recorded
 * reason says it is "the same orthography decision". Accepting hiragana `いす`
 * on that row while refusing `イス` would be incoherent, so it rides along. 66.
 *
 * The `before` values are read from a FRESH snapshot, not from the frozen one
 * the earlier rounds used: rounds one and two have landed since, and round two
 * wrote `accepted_answers` on some of these very rows. Guarding against a stale
 * prior value would abort the whole block.
 *
 *   node scripts/question-audit/round3/build-round3.mjs --snapshot .question-audit/snapshot-<hash>.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { renderPatchSql, renderReverseSql } from '../patch-set.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../../..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const snapshotPath = args.get('snapshot');
if (!snapshotPath) throw new Error('--snapshot <path> is required');

const snapshot = JSON.parse(await readFile(resolve(root, snapshotPath), 'utf8'));
const triage = JSON.parse(await readFile(
  resolve(root, 'docs/audits/question-verification/round2-triage/candidate-decisions.json'), 'utf8'));

/** The ruling's scope, stated as a predicate rather than a list of 61 ids, so a
 *  re-run against a re-triaged file cannot silently drop or gain a row. */
const inScope = (c) =>
  c.verdict === 'needs_human' &&
  c.language === 'ja' &&
  (c.group === 'ja_script_policy' ||
    // The one katakana candidate. The triage filed it under `individual` and
    // classed it `lexical` because katakana is not kana, but its own recorded
    // reason says it is "the same orthography decision", so it is matched on
    // that rather than on a class that happens to disagree with it.
    (c.group === 'individual' && /same orthography decision/.test(c.reason)));

const candidates = triage.filter(inScope);
/**
 * These additions are ALREADY LIVE. Round two carried all 66 of them, so
 * applying the ruling wrote no SQL — the deploy on 2026-09-16 had already
 * decided Decision 1 in this direction, before anyone ruled on it.
 *
 * That makes this builder a verifier rather than a patcher. It emits the
 * proposal in the shape `widening-check --additions` expects, with `current`
 * reconstructed as the live list MINUS these readings, so the harness measures
 * exactly what the readings admit against the corpus as it now stands. That
 * check is the one thing this class never got: round two's precondition was
 * about the grader gate, not about this ruling.
 */
const byRow = new Map();
for (const c of candidates) {
  if (!byRow.has(c.exercise_id)) byRow.set(c.exercise_id, { ref: c.ref, candidates: [] });
  byRow.get(c.exercise_id).candidates.push(c);
}

const exercises = new Map(snapshot.exercises.map((e) => [e.id, e]));
const proposals = [];
const patches = [];
const skipped = [];
const unapplied = [];

for (const [id, { ref, candidates: cs }] of [...byRow].sort((a, b) => a[1].ref.localeCompare(b[1].ref))) {
  const row = exercises.get(id);
  if (!row) throw new Error(`${ref}: ${id} is not in the snapshot`);
  // Every candidate on a row must agree about the key it is a reading of. If
  // production has since changed the key, the reading was reviewed against a
  // different word and this is no longer a decided row.
  for (const c of cs) {
    if (c.key !== row.correct_answer) {
      throw new Error(`${ref}: key moved since triage (${c.key} -> ${row.correct_answer})`);
    }
  }
  const live = row.accepted_answers ?? [];
  const readings = cs.map((c) => c.candidate);
  // Live minus the readings: what the row would accept had the ruling gone the
  // other way. That is the baseline the harness has to grade against.
  const before = live.filter((a) => !readings.includes(a));
  const additions = readings.filter((a) => live.includes(a));
  const pending = readings.filter((a) => !live.includes(a));
  if (pending.length) unapplied.push({ ref, id, pending });
  if (!additions.length) { skipped.push({ ref, id, why: 'no reading is live on this row' }); continue; }
  const after = [...before, ...additions];
  proposals.push({
    language: 'ja', exercise_id: id, ref, exercise_type: row.type,
    prompt: row.prompt, gloss: row.gloss ?? null, correct_answer: row.correct_answer,
    field: 'accepted_answers', current: before, proposed: after, additions,
    reason: 'Decision 1 of round2-triage/needs-human.md, ruled 2026-09-16: on a written-production row whose cue is an English gloss, a correct Japanese word in the other script is a correct answer. The corpus keys the same class of word in kanji, kana and mixed script, so no orthography rule is inferable from it.',
    source: 'docs/audits/question-verification/round2-triage/needs-human.md, Decision 1',
  });
  patches.push({
    table: 'exercises', id,
    // Identity fields the patch never writes, carried so a row that has moved
    // lesson, type or key aborts rather than being written blind.
    before: {
      lesson_id: row.lesson_id, type: row.type, prompt: row.prompt,
      correct_answer: row.correct_answer, accepted_answers: before,
    },
    after: { accepted_answers: after },
  });
}

const outputDirectory = resolve(root, 'docs/audits/question-verification/round3');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'proposal.json'), `${JSON.stringify(proposals, null, 2)}\n`);
await writeFile(resolve(outputDirectory, 'draft-patches.json'), `${JSON.stringify({
  snapshot_sha256: snapshotPath.match(/snapshot-([0-9a-f]+)\.json$/)?.[1] ?? null,
  status: 'built',
  round: 3,
  applies_on_top_of: 'round two, deployed 2026-09-16',
  ruled_on: '2026-09-16',
  apply_precondition: 'None beyond the grader already shipped for round two. These are exact-match accepted_answers additions; widening-check must report zero newly accepted taught strings before they are applied.',
  patches,
}, null, 2)}\n`);
// Only emit SQL when there is something to write. With every reading already
// live the correct artefact is the reverse — the file that would withdraw the
// ruling — so that a later decision to require kanji has an exact, guarded
// undo instead of a hand-written one.
if (unapplied.length) await writeFile(resolve(outputDirectory, 'draft.sql'), renderPatchSql(patches));
await writeFile(resolve(outputDirectory, 'withdraw.sql'), renderReverseSql(patches));

console.log(JSON.stringify({
  candidates: candidates.length,
  rows_in_scope: byRow.size,
  rows_already_live: proposals.length,
  readings_already_live: proposals.reduce((n, p) => n + p.additions.length, 0),
  rows_still_to_write: unapplied.length,
  unapplied,
  skipped,
  by_type: proposals.reduce((acc, p) => ({ ...acc, [p.exercise_type]: (acc[p.exercise_type] ?? 0) + 1 }), {}),
}, null, 2));
