/**
 * What the three tutor screens DECIDE, kept out of the screens themselves.
 *
 * The lobby, the call and the debrief are three routes with one conversation
 * running through them, and the interesting parts are not the pixels — they
 * are "where does a call that just died actually send the learner", "is this
 * budget worth mentioning yet", and "did the session id survive the route".
 * None of that is rendering, none of it needs a device, and all of it is the
 * part that will be wrong first (CLAUDE.md §6: business logic does not live in
 * screens). So it lives here, pure and clock-free, and the screens read as
 * layout.
 *
 * The rule that shaped most of this file: THERE IS NO SUCH THING AS A DEAD END.
 * Every terminal condition below resolves to a destination the learner can act
 * on — a debrief, the lobby, or an error with a retry. A blank screen after a
 * dropped call is the failure mode this module exists to make unrepresentable,
 * which is why `destinationForEnd` is total over `TutorEndReason` rather than
 * having a fallthrough that returns null.
 */

import type { ErrorCopy } from './error-copy';
import type { TutorEndReason } from './realtime-session';
import type { TutorDebrief } from '../types';
import type { TutorBudgetVerdict } from './tutor-budget';
import type { TranscriptTurn } from './tutor-transcript';

// ─── Where a finished call sends the learner ────────────────────────────

/**
 * The three real destinations. Deliberately a closed union rather than a
 * route string: a screen that receives `{ kind: 'error' }` cannot forget to
 * render the retry, whereas a screen handed `'/(app)/tutor'` has already lost
 * the reason it was sent there.
 */
export type TutorCallDestination =
  /** They spoke. There is something to say about it. */
  | { kind: 'debrief'; sessionId: string }
  /** Nothing happened worth reviewing. Back where they started, no scolding. */
  | { kind: 'lobby' }
  /** Something broke, or was refused. Say what, and offer the way forward. */
  | {
      kind: 'error';
      copy: ErrorCopy;
      /** Whether trying the same thing again is honest advice. */
      retry: boolean;
      /**
       * Whether to point at text chat as the thing that will work right now.
       * There is no TURN relay in this build, so a learner behind a hostile
       * carrier NAT will fail here every time — for them "try again" is a lie
       * and the text tutor is the actual answer.
       */
      offerTextChat: boolean;
    };

export interface CallEndOutcome {
  reason: TutorEndReason;
  /** Our own session row id. Null means the call died before the server had one. */
  sessionId: string | null;
  /**
   * Whether any turn was actually exchanged.
   *
   * This is the difference between "the call dropped" and "the call dropped
   * after nine minutes of Spanish". The second one has a transcript on the
   * server and deserves the debrief it earned; the first one has nothing to
   * analyse and would render an empty page dressed up as a lesson summary.
   */
  hadConversation: boolean;
}

const MIC_DENIED: ErrorCopy = {
  title: 'Fluenci needs the microphone',
  message:
    'A live conversation needs to hear you. Turn the microphone on for Fluenci in Settings, then start again.',
};

const CONNECTION_LOST: ErrorCopy = {
  title: "Couldn't keep the call up",
  message:
    'The connection to your tutor dropped. This is usually the network rather than you — some mobile networks block live calls entirely.',
};

const SERVER_TROUBLE: ErrorCopy = {
  title: 'The tutor could not be reached',
  message: 'Something went wrong on our side starting the call. Nothing was counted against your time.',
};

const SAFETY_ENDED: ErrorCopy = {
  title: 'Session ended',
  message: 'This conversation was ended automatically. If you think that was a mistake, please let us know.',
};

/**
 * Where a call that has stopped should send the learner.
 *
 * Total over `TutorEndReason` on purpose — the switch has no `default`, so
 * adding a reason to the state machine is a TYPE ERROR here rather than a
 * silent fall into "lobby". That is the whole point: the one bug this function
 * can have is being incomplete, and the compiler is better placed to notice it
 * than a reviewer is.
 */
export function destinationForEnd(outcome: CallEndOutcome): TutorCallDestination {
  const { reason, sessionId, hadConversation } = outcome;

  // A debrief is only offered when there is BOTH a session to read and
  // something said in it. Both halves matter: a session id with no speech
  // analyses to an empty page, and speech with no session id has nowhere to
  // read the analysis back from.
  const debriefable = sessionId !== null && hadConversation;
  const debrief: TutorCallDestination = debriefable
    ? { kind: 'debrief', sessionId: sessionId as string }
    : { kind: 'lobby' };

  switch (reason) {
    // ── Ordinary ends. The learner got what they came for. ──
    case 'user_ended':
    case 'budget_exhausted':
    case 'session_max':
    case 'app_backgrounded':
      return debrief;

    // ── Broke mid-call. If they had already been talking, the server has a
    //    transcript and the debrief is still the right place to land — losing
    //    nine minutes of work to a dropped packet is its own bug. ──
    case 'network_lost':
      return debriefable
        ? debrief
        : { kind: 'error', copy: CONNECTION_LOST, retry: true, offerTextChat: true };

    case 'server_error':
      return debriefable
        ? debrief
        : { kind: 'error', copy: SERVER_TROUBLE, retry: true, offerTextChat: true };

    // ── Refused. Neither is an error the learner should be apologised to for,
    //    but the microphone one is actionable and the consent one is not. ──
    case 'permission_denied':
      return { kind: 'error', copy: MIC_DENIED, retry: true, offerTextChat: true };

    // They read the sheet and said no. Repeating the question as an error
    // would be arguing with a decision they just made.
    case 'consent_declined':
      return { kind: 'lobby' };

    // No retry and no fallback: pointing someone at the text tutor moments
    // after the voice tutor stopped them is routing around the stop.
    case 'safety':
      return { kind: 'error', copy: SAFETY_ENDED, retry: false, offerTextChat: false };
  }
}

/** The debrief's route, as expo-router's typed-routes plugin knows it. */
export const DEBRIEF_PATHNAME = '/(app)/tutor/debrief';

/**
 * Where to navigate for a session's debrief.
 *
 * The object form rather than a `?sessionId=` string, and not for tidiness:
 * expo-router escapes the value itself, so a session id is never hand-encoded
 * into a URL here — and `pathname` stays a literal the typed-routes plugin can
 * check, which a template string is not.
 */
export function debriefHref(sessionId: string): {
  pathname: typeof DEBRIEF_PATHNAME;
  params: { sessionId: string };
} {
  return { pathname: DEBRIEF_PATHNAME, params: { sessionId } };
}

// ─── Route params ───────────────────────────────────────────────────────

/**
 * Read a session id out of expo-router's params.
 *
 * `useLocalSearchParams` types every value as `string | string[]` because a
 * param can legally repeat in a URL, and a screen that assumes `string` and
 * receives `['a','b']` passes an array into a query. Repeats take the first
 * value; blank and whitespace-only read as absent, so a `?sessionId=` with
 * nothing after it lands on the "no id" branch instead of querying for the
 * empty string.
 */
export function parseSessionIdParam(raw: string | string[] | undefined): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return null;
  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─── Clocks ─────────────────────────────────────────────────────────────

/**
 * `m:ss` for the call header.
 *
 * Seconds, not the whole minutes `assessTutorBudget` reports. The two are not
 * in conflict — rounded-up minutes are the right unit for a sentence a learner
 * READS ("about 2 minutes left"), and a ticking clock is the right unit for a
 * number they GLANCE at. A clock that jumps 2 → 1 → 0 in sixty-second steps
 * looks broken.
 *
 * Non-finite and negative inputs floor at zero rather than rendering `NaN:aN`,
 * which is what a missing grant used to put in the header.
 */
export function formatCallClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The spoken form of the same clock.
 *
 * VoiceOver reads "3:04" as "three oh four", which is a time of day. The
 * header is a countdown, so the label spells the units out.
 */
export function callClockAccessibilityLabel(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return `${parts.join(' ')} of tutor time left`;
}

// ─── Budget copy ────────────────────────────────────────────────────────

/**
 * Below this, the lobby tells the learner how much is left BEFORE they commit
 * to starting.
 *
 * Ten minutes rather than the call's two-minute warning, because these two
 * numbers answer different questions. Two minutes is "wrap up"; ten minutes is
 * "is it worth starting". Someone with eight minutes left may well still want
 * a call — they just should not discover the ceiling four minutes into it.
 */
export const LOW_BUDGET_MINUTES = 10;

/**
 * The lobby's remaining-time line, or null when the budget is not worth
 * mentioning.
 *
 * Silence is the default and that is deliberate. A learner on a plan with an
 * hour a day does not need a meter on the screen — showing one turns an
 * allowance they will never reach into something they now watch, which is the
 * anxiety `lib/tutor-budget.ts`'s header is about. Minutes only, never cents.
 */
export function lowBudgetLine(remainingMinutes: number | null | undefined): string | null {
  if (typeof remainingMinutes !== 'number' || !Number.isFinite(remainingMinutes)) return null;
  const whole = Math.max(0, Math.floor(remainingMinutes));
  if (whole > LOW_BUDGET_MINUTES) return null;
  if (whole === 0) return 'No tutor time left today.';
  return `About ${whole} minute${whole === 1 ? '' : 's'} of tutor time left today.`;
}

/**
 * The in-call banner, or null when there is nothing to say.
 *
 * A thin pass-through over the verdict today, and it stays here rather than in
 * the screen so that the screen never grows an `if` about budgets. The one
 * rule it enforces is that the banner is shown for the REST of the call once
 * it appears — `assessTutorBudget` already latches `shouldWarn`, and this must
 * not un-latch it by adding a ceiling of its own.
 */
export function callBudgetNotice(verdict: TutorBudgetVerdict): string | null {
  return verdict.shouldWarn ? verdict.notice : null;
}

// ─── The lobby's Start button ───────────────────────────────────────────

/**
 * Why Start is disabled, or null when it is not.
 *
 * Returned as a REASON rather than a boolean so the screen can label the
 * button honestly. A greyed-out button with no explanation is the single most
 * common accessibility complaint in this app's category, and the answer is
 * always the same: say what is missing.
 */
export type StartBlockedReason = 'no_profile' | 'needs_correction_mode' | 'starting';

export interface StartGateInput {
  /** Profile has loaded — we need a target language and level to start a call. */
  hasProfile: boolean;
  /** The first-launch question, still unanswered. */
  needsCorrectionMode: boolean;
  /** A start is already in flight. */
  starting: boolean;
}

export function startBlockedReason(input: StartGateInput): StartBlockedReason | null {
  if (input.starting) return 'starting';
  if (!input.hasProfile) return 'no_profile';
  // Asked once, and the call cannot begin until it is answered — the mode is
  // baked into the session instructions at mint time, so there is no such
  // thing as starting without one. See lib/tutor-storage.ts.
  if (input.needsCorrectionMode) return 'needs_correction_mode';
  return null;
}

// ─── What the debrief screen is showing ─────────────────────────────────

/**
 * How many times the debrief screen re-asks the server before giving up on
 * the analysis arriving.
 *
 * Two, and then it stops. The analysis is a model call the server makes AFTER
 * the session closes, so it is usually there by the time this screen renders
 * and occasionally a few seconds behind. Polling forever would hold a learner
 * who has just stopped talking on a spinner for a result that may never come
 * — a failed analysis is a real outcome, not a slow one — and the fallback
 * below is a genuinely useful screen rather than a placeholder.
 */
export const DEBRIEF_POLL_ATTEMPTS = 2;

/** Gap between those attempts. */
export const DEBRIEF_POLL_INTERVAL_MS = 2_500;

/**
 * The display caps, mirrored from `supabase/functions/_shared/tutor-analysis.ts`.
 *
 * The server already truncates to these, and re-applying them here is not
 * belt-and-braces — it is the guarantee that a debrief written before those
 * caps existed, or one that arrives from a future version of the analyser,
 * still renders as a lesson rather than as a list of everything the learner
 * cannot do. The pedagogy note in that file is worth reading: a debrief
 * listing eleven mistakes is a punishment, and learners who get one speak
 * less next time.
 */
export const MAX_SHOWN_PATTERNS = 3;
export const MAX_SHOWN_PHRASES = 3;

export type DebriefView =
  /** Still asking. */
  | { kind: 'loading' }
  /** The analysis arrived. */
  | { kind: 'ready'; debrief: TutorDebrief }
  /** No analysis, but we have what was said. Show that. */
  | { kind: 'transcript_only'; transcript: readonly TranscriptTurn[] }
  /** No analysis and nothing said. Say so plainly rather than spinning. */
  | { kind: 'unavailable' }
  /** Arrived here without a session to look up. */
  | { kind: 'missing' };

export interface DebriefViewInput {
  sessionId: string | null;
  debrief: TutorDebrief | null;
  transcript: readonly TranscriptTurn[];
  /** Poll attempts already COMPLETED. */
  attempts: number;
  /** The server said the transcript is gone, so no analysis is coming. */
  transcriptLost: boolean;
}

/**
 * What the debrief screen should render right now.
 *
 * Written as a function over facts rather than as a chain of `if`s in the
 * screen because the ordering is the whole thing, and it is not obvious:
 * `transcriptLost` beats the poll count. A server that has already told us the
 * transcript expired will never produce an analysis, and continuing to poll
 * for one makes the learner wait five seconds to be told something we knew
 * when we arrived.
 *
 * There is no branch that returns nothing. The worst case is `unavailable`,
 * which is still a screen with a sentence and a way out.
 */
export function debriefView(input: DebriefViewInput): DebriefView {
  if (input.sessionId === null) return { kind: 'missing' };
  if (input.debrief !== null) return { kind: 'ready', debrief: input.debrief };

  const done = input.transcriptLost || input.attempts >= DEBRIEF_POLL_ATTEMPTS;
  if (!done) return { kind: 'loading' };

  return input.transcript.length > 0
    ? { kind: 'transcript_only', transcript: input.transcript }
    : { kind: 'unavailable' };
}
