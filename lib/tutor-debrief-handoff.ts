/**
 * The one-slot handover from the call screen to the debrief screen.
 *
 * ── WHY THIS EXISTS AT ALL ──
 *
 * The debrief is a ROUTE, not a mode of the call screen, so that it survives
 * the call screen unmounting — which is exactly what happens when a call ends
 * badly. That decision has a cost: the call screen is holding the analysis
 * (`endTutorSession` returns the debrief inline) and the transcript (the hook
 * held it), and a route change is not a function call. Something has to carry
 * them across.
 *
 * Route params cannot: they are strings in a URL, and a debrief with three
 * patterns and a transcript is kilobytes of JSON that would end up in the
 * navigation state, in any logging that touches it, and in the back stack.
 * A module slot is the smaller of the two evils and the one that does not put
 * a learner's sentences in a URL.
 *
 * ── WHY IT IS NOT A CACHE ──
 *
 * Exactly one slot, overwritten by the next stash, never persisted, and gone
 * when the process is. It is a baton, not storage. The debrief screen must
 * therefore work with an EMPTY slot — a cold deep link, an app relaunch, a
 * second visit — and it does: `fetchTutorSessionSummary` is the source of
 * truth and this is only ever a latency shortcut over it. If you find yourself
 * wanting a second slot, or a TTL, what you actually want is the server.
 *
 * Reads are non-destructive and matched on session id. Clearing on read would
 * be the obvious "use it once" design and it is wrong here: React renders a
 * screen more than once, and a debrief that vanished on the second render
 * would flicker to the loading state for no reason the learner can see.
 */

import type { TranscriptTurn } from './tutor-transcript';
import type { TutorDebrief } from '../types';

export interface TutorDebriefHandoff {
  sessionId: string;
  /** Null when the analysis had not finished by the time the call ended. */
  debrief: TutorDebrief | null;
  /** Words the server actually wrote into the review queue. May be empty. */
  savedWords: string[];
  /** Server-measured, already whole minutes. */
  minutes: number;
  /**
   * The server's transcript buffer had expired, so there is no debrief and
   * there never will be one. The difference between "your notes are still
   * being written" and "there are no notes" — and the only way the debrief
   * screen can tell a wait from a dead end.
   */
  transcriptLost: boolean;
  /**
   * What was said, so the "notes still being written" fallback has something
   * real to show instead of an apology on an empty page.
   */
  transcript: readonly TranscriptTurn[];
}

let slot: TutorDebriefHandoff | null = null;

/** Hand the debrief screen what the call screen already knows. */
export function stashDebrief(handoff: TutorDebriefHandoff): void {
  slot = handoff;
}

/**
 * Read the baton back, if it is for this session.
 *
 * The id check is not ceremony. Two calls in a row leave the first one's
 * analysis in the slot for as long as it takes the second to end, and a
 * debrief screen that rendered the previous conversation's mistakes would be
 * wrong in the most confusing possible way — plausibly, and about the
 * learner's own sentences.
 */
export function peekDebrief(sessionId: string): TutorDebriefHandoff | null {
  return slot !== null && slot.sessionId === sessionId ? slot : null;
}

/**
 * Drop whatever is held.
 *
 * Called when a new call starts rather than when a debrief is read: the point
 * is that a stale analysis can never outlive the session that follows it.
 */
export function clearDebriefHandoff(): void {
  slot = null;
}
