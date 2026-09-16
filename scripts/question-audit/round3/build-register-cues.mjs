/**
 * Decision 2: register variants on a cue that names no register.
 *
 * THE RULING: fix the cue, not the grading.
 *
 * The triage recommended accept-upward / refuse-downward. Upward is already
 * live — round two added 料理します, でしょう, 아닙니다, 공부했습니다, 갔습니다,
 * 해야 합니다, 해야 해요, 바라요, 바랍니다 and 저는 바랍니다 — so the only thing
 * still refused anywhere in this class is the DOWNWARD direction, on seven rows.
 *
 * Refusing downward fails by the triage's own argument. It justified accepting
 * upward with "hard to justify refusing on a cue that names no register", and
 * `Translate to Korean: I studied` names no register in either direction. The
 * asymmetry the triage drew is pedagogical (A1 teaches the polite greeting), not
 * evidential, and a grading rule cannot carry a distinction the prompt does not
 * make.
 *
 * So the prompt makes it. Seven cues gain an explicit register marker, and
 * nothing about the grading changes. After this, refusing おはよう for
 * おはようございます is honest: the item asked for the polite form and said so.
 *
 * THIS ALSO RESOLVES THE INCONSISTENCY the triage flags in §2 — `JA-POLITE-AFFIX`
 * refusing おはよう while `lexical` accepts ごめん for すみません, うん for はい and
 * ううん for いいえ — WITHOUT touching those four rows. Their cues stay bare
 * glosses, and a bare gloss accepting either register is exactly right. The
 * grading now differs because the CUES differ, which is a distinction a learner
 * can see. Withdrawing those three live acceptances would have been the other
 * way to make it consistent, and the worse one: it newly rejects correct answers
 * to fix a wording problem.
 *
 * Five of the twelve rows the triage lists need no cue: `ja-E0462` is the script
 * decision, and `ja-E0712`, `ja-E1642`, `ko-E1670` and `ko-E1684` are keyed at
 * the PLAIN level with the polite forms already accepted, so they refuse
 * nothing and a marker would only narrow a row that is currently correct.
 *
 *   node scripts/question-audit/round3/build-register-cues.mjs --snapshot <path>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPatchSql, renderReverseSql } from '../patch-set.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../../..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const snapshotPath = args.get('snapshot');
if (!snapshotPath) throw new Error('--snapshot <path> is required');
const snapshot = JSON.parse(await readFile(resolve(root, snapshotPath), 'utf8'));
const exercises = new Map(snapshot.exercises.map((e) => [e.id, e]));

/**
 * The seven rows, each with the exact prompt it must currently have and the
 * exact prompt it gets. Written out rather than derived: a cue is learner-facing
 * copy, and copy is authored, not generated. `refuses` records what the marker
 * is there to make honest, so a later reader can check the marker still earns
 * its place.
 */
const cues = [
  { ref: 'ja-E0014', id: null,
    from: 'Translate to Japanese: Good morning',
    to: 'Translate to Japanese (polite): Good morning', refuses: ['おはよう'] },
  { ref: 'ja-E0038', id: null,
    from: 'Translate to Japanese: Good night',
    to: 'Translate to Japanese (polite): Good night', refuses: ['おやすみ'] },
  { ref: 'ko-E0066', id: null,
    from: 'Translate to Korean: No',
    to: 'Translate to Korean (polite): No', refuses: ['아니'] },
  { ref: 'ko-E0856', id: null,
    from: 'Translate to Korean: I studied',
    to: 'Translate to Korean (polite): I studied', refuses: ['공부했다'] },
  { ref: 'ko-E0862', id: null,
    from: 'Translate to Korean: I went',
    to: 'Translate to Korean (polite): I went', refuses: ['갔다'] },
  { ref: 'ko-E0889', id: null,
    from: 'Fill in the missing word: _____ means I studied',
    to: 'Fill in the missing word (polite form): _____ means I studied', refuses: ['공부했다'] },
  { ref: 'ko-E0901', id: null,
    from: 'Fill in the missing word: _____ means I played',
    to: 'Fill in the missing word (polite form): _____ means I played', refuses: ['놀았다'] },
];

// Ids the triage recorded, resolved by ref so a typo cannot patch a neighbour.
const triage = JSON.parse(await readFile(
  resolve(root, 'docs/audits/question-verification/round2-triage/candidate-decisions.json'), 'utf8'));
const idByRef = new Map(triage.map((c) => [c.ref, c.exercise_id]));

const patches = [];
const report = [];
for (const cue of cues) {
  const id = cue.id ?? idByRef.get(cue.ref);
  if (!id) throw new Error(`${cue.ref}: no exercise id`);
  const row = exercises.get(id);
  if (!row) throw new Error(`${cue.ref}: ${id} is not in the snapshot`);
  if (row.prompt === cue.to) { report.push({ ref: cue.ref, state: 'already carries the marker' }); continue; }
  if (row.prompt !== cue.from) throw new Error(`${cue.ref}: prompt is not what the ruling read (${row.prompt})`);
  // The marker only earns its place if the row really does refuse the casual
  // form. If someone has since accepted it, the cue change would be a narrowing
  // nobody ruled on.
  const accepted = row.accepted_answers ?? [];
  const wronglyAccepted = cue.refuses.filter((r) => accepted.includes(r) || r === row.correct_answer);
  if (wronglyAccepted.length) throw new Error(`${cue.ref}: already accepts ${wronglyAccepted.join(', ')}`);
  patches.push({
    table: 'exercises', id,
    before: {
      lesson_id: row.lesson_id, type: row.type, prompt: row.prompt,
      correct_answer: row.correct_answer, accepted_answers: accepted,
    },
    after: { prompt: cue.to },
  });
  report.push({ ref: cue.ref, id, type: row.type, key: row.correct_answer, from: cue.from, to: cue.to, refuses: cue.refuses });
}

const outputDirectory = resolve(root, 'docs/audits/question-verification/round3/register-cues');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'cues.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(outputDirectory, 'draft-patches.json'), `${JSON.stringify({
  snapshot_sha256: snapshotPath.match(/snapshot-([0-9a-f]+)\.json$/)?.[1] ?? null,
  status: 'built', round: 3, part: 'register cues (Decision 2)',
  ruled_on: '2026-09-16',
  apply_precondition: 'None. Prompt copy only — no accepted answer is added or withdrawn, so no grading behaviour changes and no widening is possible.',
  patches,
}, null, 2)}\n`);
if (patches.length) await writeFile(resolve(outputDirectory, 'draft.sql'), renderPatchSql(patches));
if (patches.length) await writeFile(resolve(outputDirectory, 'reverse.sql'), renderReverseSql(patches));
console.log(JSON.stringify({ rows: patches.length, report }, null, 2));
