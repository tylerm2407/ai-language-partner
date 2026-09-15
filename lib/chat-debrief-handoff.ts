/**
 * The one-slot handover from the chat screen to the mission debrief.
 *
 * A mirror of `lib/tutor-debrief-handoff.ts`, for the same reasons: the
 * debrief is a ROUTE so it survives the chat screen resetting, the Finish
 * turn returns the result inline, and route params cannot carry kilobytes of
 * a learner's corrections without putting them in the navigation state.
 *
 * A baton, not a cache. One slot, never persisted, gone with the process. The
 * debrief screen must work with an EMPTY slot — a cold deep link, a relaunch,
 * a second visit — and it does: `fetchMissionResult` reads the stored
 * `chat_mission_attempts.result`, which is the source of truth; this is only
 * a latency shortcut over it.
 *
 * Reads are non-destructive and matched on session id, so a re-render does
 * not flicker to loading and a stale result can never be shown for a
 * different attempt.
 */

import type { MissionResult } from './ai';

export interface ChatDebriefHandoff {
  sessionId: string;
  result: MissionResult;
}

let slot: ChatDebriefHandoff | null = null;

/** Hand the debrief screen what the Finish turn already returned. */
export function stashChatDebrief(handoff: ChatDebriefHandoff): void {
  slot = handoff;
}

/** Read the baton back, if it is for this session. */
export function peekChatDebrief(sessionId: string): ChatDebriefHandoff | null {
  return slot !== null && slot.sessionId === sessionId ? slot : null;
}

/** Drop whatever is held. Called when a new attempt starts. */
export function clearChatDebriefHandoff(): void {
  slot = null;
}
