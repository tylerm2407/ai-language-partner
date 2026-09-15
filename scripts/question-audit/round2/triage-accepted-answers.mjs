/**
 * The 298 triaged Japanese and Korean rows, as accepted-answer additions.
 *
 * Provenance. These are the confirmed defects from the triage of the 371
 * uncertain Japanese and 29 Korean claims. The input is the triage's own
 * machine-readable output, copied into this directory verbatim and pinned by
 * hash so the build is reproducible from this worktree alone:
 *
 *   source  audit-triage/docs/audits/question-verification/round2-triage/confirmed.json
 *   here    docs/audits/question-verification/round2/triage-confirmed.json
 *   sha256  d897777b985558929da9e57a7fa1445bc303a289c414c6b49a7f48f135ea9775
 *
 * This producer authors no content. Every string comes from the triage entry,
 * and every entry is re-checked against the frozen snapshot before it is used:
 * the row must exist, the key must not have moved, the type must match, and
 * `accepted_answers` must still be empty. A triage entry that has gone stale
 * fails the build rather than writing a value nobody re-read.
 *
 * WHY THESE ARE DEFECTS, not a policy question. 283 of the 298 are
 * `listening_type` or `dictation`, and on those the learner is shown nothing to
 * take a spelling from. `components/lesson/ListeningExercise.tsx` deliberately
 * withholds `prompt`, because `prompt` is the text handed to text-to-speech and
 * printing it would show the answer; `DictationExercise.tsx` likewise speaks the
 * answer as its stimulus, which is what dictation is. So the learner hears
 * おねがいします and can correctly transcribe it in kana or in kanji, and the row
 * accepts exactly one of the two. Adding the other spelling is what makes the
 * row answerable — there is no rendering change that could do it instead,
 * because rendering the cue would destroy the exercise.
 *
 * TWO PRECONDITIONS, both carried in the patch itself rather than only in prose.
 *
 * 1. FOUR ROWS CARRY A RECORDED DEPENDENCY. ja-E0361, ja-E0373, ja-E0569 and
 *    ja-E0581 add the kanji spellings of おばあさん / おじいさん / おじさん / おばさん.
 *    Those spellings are correct, but they pull five other taught kinship terms
 *    — お母さん, お父さん, お姉さん, お嬢さん, お隣さん — inside the typo budget on
 *    rows whose entire purpose is separating kinship terms. Twelve collateral
 *    acceptances in total, enumerated below and re-measured by
 *    `runtime-round2.mjs` against the whole language, not per row. They close
 *    when the confusable pairs the `grader` agent is authoring in
 *    `lib/confusable-pairs.ts` land. The rows are included because the additions
 *    are right and because splitting them out would hide the dependency; the
 *    dependency is written into each of those four patch reasons so it travels
 *    with the row.
 *
 * 2. THE WHOLE BLOCK SHIPS WITH THE GRADER BRANCH, NOT BEFORE IT. Triage
 *    measured that the additions and the Japanese edit-distance gate are
 *    complementary: under strict grading all 313 additions still pass and all 12
 *    collateral acceptances disappear. Without the gate the additions widen
 *    tolerance on 88 rows. This is stated at the top of the round-2 report and
 *    recorded in `findings.json`; it cannot be enforced from inside a SQL patch.
 *
 * WHAT IS LEFT OUT. The 67 rows where a product decision is the only thing
 * outstanding — Japanese orthography on written-production rows, and register
 * variants on a cue that names no register. Four rows appear in both places
 * (ja-E0892, ja-E0970, ko-E0856, ko-E0862) because each carries one confirmed
 * defect and one open candidate; only the confirmed half is here. The build
 * asserts that the intersection is exactly those four.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TRIAGE_FILE = 'docs/audits/question-verification/round2/triage-confirmed.json';
export const TRIAGE_SHA = 'd897777b985558929da9e57a7fa1445bc303a289c414c6b49a7f48f135ea9775';
export const TRIAGE_SOURCE = 'audit-triage worktree, docs/audits/question-verification/round2-triage/confirmed.json';

/** Exactly the rows that must not land without the confusable pairs, and the
 * taught strings each one lets through until they do. Duplicated from the
 * triage's `admits_other_taught_strings` so a change on either side is visible
 * as a build failure rather than a silent divergence. */
export const DEPENDENT_ROWS = {
  'ja-E0361': ['お父さん', 'お姉さん', 'お嬢さん', 'お母さん', 'お隣さん'],
  'ja-E0373': ['お父さん', 'お姉さん', 'お嬢さん', 'お母さん', 'お隣さん'],
  'ja-E0569': ['お父さん'],
  'ja-E0581': ['お母さん'],
};

/** Rows that also appear under a decision in the triage's needs-human list,
 * where only the confirmed half is taken. */
export const PARTIALLY_HELD = ['ja-E0892', 'ja-E0970', 'ko-E0856', 'ko-E0862'];

const DEPENDENCY_NOTE = collateral =>
  ` DEPENDENCY — do not apply this row without the confusable pairs the grader branch adds to lib/confusable-pairs.ts: until they land, the added kanji spelling brings ${collateral.join(', ')} inside this row's typo budget, on a row whose purpose is separating kinship terms.`;

export async function loadTriage() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', TRIAGE_FILE);
  const raw = await readFile(path, 'utf8');
  if (createHash('sha256').update(raw).digest('hex') !== TRIAGE_SHA) {
    throw new Error('triage-confirmed.json has changed; re-read it and re-pin TRIAGE_SHA before building');
  }
  const entries = JSON.parse(raw);
  if (entries.length !== 298) throw new Error(`Expected 298 confirmed triage rows, found ${entries.length}`);
  return entries;
}

/**
 * Contribute the triage additions to the shared accepted-answer ledger rather
 * than writing them directly: five rows are also reached by one of the two
 * product rulings, and the union has to be composed in one place. See
 * `accepted-answer-ledger.mjs`.
 */
export async function triageAcceptedAnswers(set, ledger) {
  const { row } = set;
  const entries = await loadTriage();
  const seen = new Set();
  let additions = 0;
  const dependent = [];

  for (const entry of entries) {
    const { ref, exercise_id: id, language, exercise_type: type, correct_answer: key, field } = entry;
    if (field !== 'accepted_answers') throw new Error(`${ref}: this producer writes accepted_answers only, not ${field}`);
    if (seen.has(id)) throw new Error(`${ref}: duplicate exercise in the triage output`);
    seen.add(id);

    const original = row('exercises', id);
    if (original.correct_answer !== key) throw new Error(`${ref}: the stored key moved since triage`);
    if (original.type !== type) throw new Error(`${ref}: the exercise type moved since triage`);
    if (!Array.isArray(original.accepted_answers) || original.accepted_answers.length) {
      throw new Error(`${ref}: accepted_answers is no longer empty; re-triage before adding`);
    }
    if (!Array.isArray(entry.additions) || !entry.additions.length) throw new Error(`${ref}: no additions`);
    // `proposed` is the whole new list and `additions` the delta. On an empty
    // field they must agree; if they ever stop agreeing the triage means
    // something this producer has not been told about.
    if (JSON.stringify(entry.proposed) !== JSON.stringify(entry.additions)) {
      throw new Error(`${ref}: proposed and additions disagree on a row whose accepted_answers is empty`);
    }
    for (const addition of entry.additions) {
      if (typeof addition !== 'string' || !addition.trim()) throw new Error(`${ref}: empty addition`);
      if (addition === key) throw new Error(`${ref}: the addition repeats the key`);
    }
    if (!entry.reason?.trim()) throw new Error(`${ref}: the triage entry carries no reason`);

    const collateral = DEPENDENT_ROWS[ref];
    if (Boolean(entry.blocking) !== Boolean(collateral)) throw new Error(`${ref}: the triage blocking flag and DEPENDENT_ROWS disagree`);
    if (collateral) {
      if (JSON.stringify([...(entry.admits_other_taught_strings ?? [])].sort()) !== JSON.stringify([...collateral].sort())) {
        throw new Error(`${ref}: the collateral list has changed since it was recorded here`);
      }
      dependent.push(ref);
    }

    const reason = `${ref} (${language}, ${type}): ${entry.reason}${collateral ? DEPENDENCY_NOTE(collateral) : ''}`;
    ledger.contribute(id, { block: 'triage', additions: entry.additions, reason, sources: entry.source ? [entry.source] : [] });
    additions += entry.additions.length;
  }

  if (additions !== 313) throw new Error(`Expected 313 authored additions, wrote ${additions}`);
  if (dependent.sort().join() !== Object.keys(DEPENDENT_ROWS).sort().join()) {
    throw new Error('The dependency-bearing rows are not the four that were recorded');
  }
  return { rows: entries.length, additions, dependent: dependent.length };
}
