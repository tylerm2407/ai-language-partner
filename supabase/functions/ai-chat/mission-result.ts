/**
 * Scoring a finished mission attempt. Pure — no Deno APIs, no network — so
 * mission-result.test.ts can pin every branch of the pass rule.
 *
 * THE PASS RULE
 *   passed = every objective met AND (no scored turns OR mean accuracy ≥ 0.7)
 *
 * The accuracy half reuses the number the learner already sees: the same
 * 0.5/0.5 accuracy-intelligibility combination `fetchPushSignal` and the CEFR
 * report use, and the same 0.7 pass mark as `lib/cefr-proficiency.ts`. A
 * mission is a slice of the proficiency measurement, not a second grading
 * system with its own idea of "good enough".
 *
 * THE UNSCORED EXCEPTION is Tyler's call. `scoreTurn` refuses to score turns
 * under `MIN_WORDS_FOR_EVIDENCE` words, and A1 turns are often exactly that —
 * "Una mesa, por favor" is three words, and it is a perfectly good way to
 * greet the server and ask for a table. A beginner whose every turn is short
 * has produced no evidence, not bad evidence, so they pass on objectives
 * alone. `accuracy` is null in that case, never 0.
 *
 * `.claude/rules/learning.md` ("Chat missions") states the rule; change both.
 */

import type { Mission } from '../_shared/missions.ts';

/** Mirrors the band pass mark in `lib/cefr-proficiency.ts`. */
export const MISSION_PASS_ACCURACY = 0.7;

export type MissionFailReason = 'objectives_incomplete' | 'accuracy_below_pass';

/** One `conversation_evidence` row, as PostgREST returns it. `numeric`
 *  columns can arrive as strings depending on the client, so both are
 *  coerced with `Number` the way `fetchPushSignal` does. */
export interface EvidenceRow {
  accuracy: number | string | null;
  intelligibility: number | string | null;
}

export interface MissionObjectiveResult {
  id: string;
  text: string;
  met: boolean;
}

export interface MissionScore {
  passed: boolean;
  /** Null when passed. Objectives are reported before accuracy: a learner
   *  who did not do the task has a clearer next step than one who did it
   *  with mistakes. */
  reason: MissionFailReason | null;
  /** Mean over scored turns, 0..1. Null when there were none. */
  accuracy: number | null;
  scoredTurns: number;
  objectives: MissionObjectiveResult[];
}

/** One turn's contribution, exactly as the proficiency report combines it. */
export function combineTurnScore(row: EvidenceRow): number {
  const accuracy = Number(row.accuracy ?? 0);
  const intelligibility =
    row.intelligibility === null || row.intelligibility === undefined
      ? null
      : Number(row.intelligibility);
  return intelligibility === null ? accuracy : 0.5 * accuracy + 0.5 * intelligibility;
}

export function computeMissionResult(input: {
  mission: Mission;
  objectivesMet: readonly string[];
  evidence: readonly EvidenceRow[];
}): MissionScore {
  const met = new Set(input.objectivesMet);
  const objectives = input.mission.objectives.map((o) => ({
    id: o.id,
    text: o.text,
    met: met.has(o.id),
  }));
  const allMet = objectives.every((o) => o.met);

  const scoredTurns = input.evidence.length;
  let accuracy: number | null = null;
  if (scoredTurns > 0) {
    let total = 0;
    for (const row of input.evidence) total += combineTurnScore(row);
    // Clamped: the column has a 0..1 CHECK, and a malformed row must not turn
    // a finish into a constraint error. Rounded to four places: it is stored
    // and shown as a percentage, and 0.8500000000000001 is float noise, not
    // a measurement.
    accuracy = Math.round(Math.min(1, Math.max(0, total / scoredTurns)) * 10_000) / 10_000;
  }

  const accuracyOk = accuracy === null || accuracy >= MISSION_PASS_ACCURACY;
  const passed = allMet && accuracyOk;
  const reason: MissionFailReason | null = passed
    ? null
    : !allMet
      ? 'objectives_incomplete'
      : 'accuracy_below_pass';

  return { passed, reason, accuracy, scoredTurns, objectives };
}

/** One `correction_log` row, the three columns the debrief reads. */
export interface CorrectionRow {
  error_type: string | null;
  original: string | null;
  corrected: string | null;
}

export interface MissionCorrectionGroup {
  errorType: string;
  count: number;
  /** Up to three You-said / Better pairs. */
  examples: { original: string; corrected: string }[];
}

/** Cap on examples per group — the debrief is a summary, not the log. */
export const MAX_CORRECTION_EXAMPLES = 3;

/**
 * Group the attempt's corrections by error type for the debrief.
 *
 * Sorted by count descending, then error type ascending, so the learner's
 * most frequent problem is first and ties are stable. Rows with no error type
 * are grouped as `other`. Examples prefer rows where the model quoted a
 * phrase: a pair of empty strings renders as nothing, so it only takes a slot
 * when there is nothing better.
 */
export function groupCorrections(rows: readonly CorrectionRow[]): MissionCorrectionGroup[] {
  const groups = new Map<string, { count: number; quoted: CorrectionRow[]; bare: CorrectionRow[] }>();
  for (const row of rows) {
    const errorType = row.error_type && row.error_type.trim() ? row.error_type.trim() : 'other';
    let group = groups.get(errorType);
    if (!group) {
      group = { count: 0, quoted: [], bare: [] };
      groups.set(errorType, group);
    }
    group.count++;
    const hasText = Boolean((row.original ?? '').trim() || (row.corrected ?? '').trim());
    (hasText ? group.quoted : group.bare).push(row);
  }

  const out: MissionCorrectionGroup[] = [];
  for (const [errorType, group] of groups) {
    const examples = [...group.quoted, ...group.bare]
      .slice(0, MAX_CORRECTION_EXAMPLES)
      .map((r) => ({ original: (r.original ?? '').trim(), corrected: (r.corrected ?? '').trim() }));
    out.push({ errorType, count: group.count, examples });
  }
  out.sort((a, b) => b.count - a.count || (a.errorType < b.errorType ? -1 : a.errorType > b.errorType ? 1 : 0));
  return out;
}
