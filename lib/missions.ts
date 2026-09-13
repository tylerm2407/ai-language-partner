/**
 * Pure helpers for the chat mission ladder.
 *
 * Everything the picker, the checklist and the debrief compute from server
 * state lives here so it can be tested without React: which dots to draw,
 * what the one button says, how a turn's `objectivesMet` merges into the
 * checklist, what "78% over 6 turns" reads as. No I/O, no colour, no JSX.
 *
 * Server truth: `chat_mission_progress` (best per stage) and
 * `chat_mission_attempts` (open and finished attempts). The client never
 * decides what is unlocked — it reads `highestUnlocked`, computed by
 * `highestUnlockedStage` from the rows the server wrote.
 */

import type { MissionResult } from './ai';
import { errorTypeIcon, errorTypeLabel } from './insights';
import type { MissionProgressRow } from './supabase-queries';
import { MISSION_META, MISSION_STAGE_COUNT, type MissionMeta } from '../types/missions';
import type { ScenarioKey } from '../types/scenarios';

/** The authored mission for a scene and stage, or null (free_chat, bad stage). */
export function missionFor(scenarioKey: string, stage: number): MissionMeta | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > MISSION_STAGE_COUNT) return null;
  if (!Object.prototype.hasOwnProperty.call(MISSION_META, scenarioKey)) return null;
  const ladder = MISSION_META[scenarioKey as keyof typeof MISSION_META];
  return ladder.find((m) => m.stage === stage) ?? null;
}

/** "Mission 2 of 4". */
export function stageLabel(stage: number): string {
  return `Mission ${stage} of ${MISSION_STAGE_COUNT}`;
}

/**
 * The highest stage the learner may start for a scene: max passed stage + 1.
 * Ranges 1..5, where 5 means every stage of the ladder has been passed.
 */
export function highestUnlockedStage(rows: readonly MissionProgressRow[], scenarioKey: string): number {
  let maxPassed = 0;
  for (const row of rows) {
    if (row.scenarioKey === scenarioKey && row.passedAt && row.stage > maxPassed) {
      maxPassed = row.stage;
    }
  }
  return Math.min(maxPassed + 1, MISSION_STAGE_COUNT + 1);
}

export type StageDot = 'done' | 'current' | 'locked';

/** Four dots for a tile. Shape carries state, never colour alone. */
export function stageDots(highestUnlocked: number): StageDot[] {
  const dots: StageDot[] = [];
  for (let stage = 1; stage <= MISSION_STAGE_COUNT; stage++) {
    dots.push(stage < highestUnlocked ? 'done' : stage === highestUnlocked ? 'current' : 'locked');
  }
  return dots;
}

/** The stage the one button acts on. Null when the ladder is done. */
export function currentStage(highestUnlocked: number): number | null {
  return highestUnlocked > MISSION_STAGE_COUNT ? null : Math.max(1, highestUnlocked);
}

export type MissionCta =
  /** free_chat: no ladder, the old "Continue" behaviour. */
  | 'free_chat'
  /** Not entitled to chat at all: the button routes to the paywall. */
  | 'plans'
  /** An attempt of the current stage is open: resume it. */
  | 'resume'
  /** Begin a fresh attempt of the current stage. */
  | 'start'
  /** Every stage passed: replay the last one. Replaying earlier stages is a
   *  later pass (memory fluenci-chat-missions). */
  | 'replay';

export function missionCta(input: {
  scenarioKey: string;
  paid: boolean;
  highestUnlocked: number;
  hasOpenAttempt: boolean;
}): MissionCta {
  if (input.scenarioKey === 'free_chat') return 'free_chat';
  if (!input.paid) return 'plans';
  if (input.hasOpenAttempt) return 'resume';
  if (currentStage(input.highestUnlocked) === null) return 'replay';
  return 'start';
}

/** The one button's label. The stage is `currentStage(...)`, or the open attempt's. */
export function missionCtaLabel(cta: MissionCta, stage: number | null): string {
  switch (cta) {
    case 'free_chat': return 'Continue';
    case 'plans': return 'See plans';
    case 'resume': return `Continue mission ${stage ?? 1}`;
    case 'replay': return `Play mission ${MISSION_STAGE_COUNT} again`;
    default: return `Start mission ${stage ?? 1}`;
  }
}

/** Under the objectives on the picker sheet when an attempt is open. */
export function missionResumeHint(metCount: number, total: number): string {
  if (metCount <= 0) return 'You started this mission. Pick up where you left off.';
  return `You have done ${metCount} of ${total} objectives. Pick up where you left off.`;
}

/**
 * Picker order: the learner's goal-track scenes first (in the order the goal
 * names them), then the rest in their existing order, free_chat always last.
 * Stable — nothing else moves.
 */
export function orderScenarios<T extends { key: ScenarioKey }>(
  scenarios: readonly T[],
  goalScenes: readonly string[],
): T[] {
  const rank = new Map<string, number>();
  goalScenes.forEach((scene, i) => {
    if (!rank.has(scene)) rank.set(scene, i);
  });
  return scenarios
    .map((s, index) => ({ s, index }))
    .sort((a, b) => {
      const aFree = a.s.key === 'free_chat' ? 1 : 0;
      const bFree = b.s.key === 'free_chat' ? 1 : 0;
      if (aFree !== bFree) return aFree - bFree;
      const aRank = rank.get(a.s.key) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.s.key) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.index - b.index;
    })
    .map((x) => x.s);
}

/**
 * Merge a turn's report into the checklist. Ids not in `valid` are dropped —
 * the server whitelists too, but a checklist must never tick an objective the
 * mission does not have. Order follows `valid` so the list is stable.
 */
export function mergeObjectivesMet(
  prev: readonly string[],
  incoming: readonly string[],
  valid: readonly string[],
): { next: string[]; newlyMet: string[] } {
  const have = new Set(prev.filter((id) => valid.includes(id)));
  const newlyMet: string[] = [];
  for (const id of incoming) {
    if (!valid.includes(id) || have.has(id)) continue;
    have.add(id);
    newlyMet.push(id);
  }
  return { next: valid.filter((id) => have.has(id)), newlyMet };
}

/** "78% accuracy over 6 turns", or the honest line when nothing was scorable. */
export function accuracyLine(accuracy: number | null, scoredTurns: number): string {
  if (accuracy === null || scoredTurns <= 0) return 'Not enough said to score';
  const pct = Math.round(Math.min(1, Math.max(0, accuracy)) * 100);
  return `${pct}% accuracy over ${scoredTurns} ${scoredTurns === 1 ? 'turn' : 'turns'}`;
}

export interface CorrectionHabit {
  errorType: string;
  label: string;
  icon: ReturnType<typeof errorTypeIcon>;
  count: number;
  /** At most two pairs; the debrief shows no more. */
  examples: { original: string; corrected: string }[];
}

/** The debrief's "Habits worth fixing" rows, from the server's grouped corrections. */
export function correctionHabits(result: Pick<MissionResult, 'corrections'>): CorrectionHabit[] {
  return [...result.corrections]
    .sort((a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType))
    .map((g) => ({
      errorType: g.errorType,
      label: errorTypeLabel(g.errorType),
      icon: errorTypeIcon(g.errorType),
      count: g.count,
      examples: g.examples.filter((e) => e.original || e.corrected).slice(0, 2),
    }));
}

export type NextMissionAfter = 'next' | 'retry' | 'ladder_done';

/** Which footer the debrief shows. */
export function nextMissionAfter(result: Pick<MissionResult, 'passed' | 'stage'>): NextMissionAfter {
  if (!result.passed) return 'retry';
  return result.stage >= MISSION_STAGE_COUNT ? 'ladder_done' : 'next';
}

/** Route to the debrief for one attempt. */
export function chatDebriefHref(sessionId: string): { pathname: '/(app)/chat/debrief'; params: { sessionId: string } } {
  return { pathname: '/(app)/chat/debrief', params: { sessionId } };
}
