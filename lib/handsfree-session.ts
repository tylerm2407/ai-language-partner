/**
 * The hands-free session state machine.
 *
 * This module is the deliverable of hands-free mode. Development happens on
 * Windows with no iOS simulator, so anything that lives in a hook cannot be
 * verified before it reaches a device. Every decision therefore lives here —
 * pure, clock-free, exhaustively tested — and the host hook is left with
 * nothing but I/O. If you find yourself writing an `if` in the hook that is
 * not about performing an effect, it belongs in this file.
 *
 * DESIGN NOTES worth knowing before changing anything:
 *
 * - Reducer plus OUTBOX. The reducer never performs a write; it appends a
 *   commit that the host drains and persists. That keeps it a total function
 *   while still letting the host know what to save. Commit ids are supplied by
 *   the caller so an offline replay is idempotent.
 *
 * - `elapsedMs` EXCLUDES paused time. A ten-minute phone call must not consume
 *   a twenty-minute session.
 *
 * - Pause always resumes at the START of the current item, never mid-prompt.
 *   Resuming into the second half of a sentence is disorienting when you
 *   cannot see the screen.
 *
 * - An aborted listen NEVER produces a commit. Road noise, a missed cue, or a
 *   low-confidence transcript must not demote an item the learner actually
 *   knew. This is enforced structurally: the only path that appends to the
 *   outbox is a real graded answer.
 *
 * - Only the FIRST attempt at a card is scored. Replays after a wrong answer
 *   exist to teach, not to offer a better grade — SM-2 asks whether you
 *   recalled it unaided, and the answer to that does not change on the retry.
 */

import type { ReviewRating } from '../types';
import type { VadConfig } from './vad';

// ─── Phases ─────────────────────────────────────────────────────────────

export type HandsFreePhase =
  | 'idle'
  | 'announcing'
  | 'prompting'
  | 'earcon'
  | 'listening'
  | 'feedback'
  /**
   * Feedback that is followed by a replay of the same card rather than by
   * advancing. Distinct from `feedback` because the two look identical to the
   * host but mean opposite things on completion, and conflating them silently
   * skips cards the learner was meant to retry.
   */
  | 'retry_feedback'
  | 'paused'
  | 'summarizing'
  | 'ended';

export type PauseReason = 'user' | 'call' | 'focus_loss' | 'headphones' | 'error';
export type EndReason = 'completed' | 'user_ended' | 'interrupted' | 'error';

/** Fixed feedback lines. Kept few and constant so they stay TTS cache hits. */
export type FeedbackPhraseKey = 'correct' | 'close' | 'incorrect' | 'not_caught';

export type HandsFreeCommand = 'pause' | 'repeat' | 'skip' | 'end';

// ─── Steps: what the host should perform right now ──────────────────────

export type HandsFreeStep =
  | { kind: 'none' }
  | { kind: 'announce'; text: string }
  | { kind: 'prompt'; cardId: string; text: string; lang: string }
  | { kind: 'earcon'; tone: 'your_turn' | 'correct' | 'incorrect' }
  | { kind: 'listen'; cardId: string; vad: VadConfig }
  | { kind: 'feedback'; phraseKey: FeedbackPhraseKey; text: string }
  | { kind: 'summary'; text: string };

// ─── Configuration ──────────────────────────────────────────────────────

export interface HandsFreeConfig {
  /** Time box. Sessions are a duration, not a card count — a commute is a duration. */
  targetDurationMs: number;
  vad: VadConfig;
  /** Replay an item once after a wrong answer, for learning. Does not re-score. */
  repeatOnFail: boolean;
  /** Attempts before giving up on a card and moving on unscored. */
  maxAttemptsPerCard: number;
  /** Auto-end if a focus-loss pause is never resumed within this window. */
  resumeGraceMs: number;
  /** Stop adding items when the remaining budget drops below cost * this. */
  budgetSafetyFactor: number;
}

export const HANDSFREE_CONFIG_DEFAULTS: Omit<HandsFreeConfig, 'vad'> = {
  targetDurationMs: 20 * 60 * 1000,
  repeatOnFail: true,
  maxAttemptsPerCard: 2,
  resumeGraceMs: 120_000,
  budgetSafetyFactor: 1.0,
};

/** Seed for the per-item cost estimate, before any item has been measured. */
export const INITIAL_ITEM_COST_MS = 14_000;
/** Weight of the newest measurement in the cost EWMA. */
const COST_EWMA_ALPHA = 0.3;
/** How many items ahead the host should have audio cached for. */
export const PREFETCH_AHEAD = 3;

// ─── Queue and commits ──────────────────────────────────────────────────

export interface HandsFreeQueueItem {
  cardId: string;
  reviewItemId: string;
  /** What the tutor says. */
  promptText: string;
  /** What the learner should say back. */
  expectedText: string;
  acceptedVariants: string[];
  targetWord?: string;
  promptLang: string;
}

export interface HandsFreeCommit {
  /** Caller-supplied and stable across retries, so replay is idempotent. */
  commitId: string;
  cardId: string;
  reviewItemId: string;
  rating: ReviewRating;
  transcript: string;
  responseTimeMs: number;
  wasCorrect: boolean;
}

// ─── State ──────────────────────────────────────────────────────────────

export interface HandsFreeSessionState {
  readonly phase: HandsFreePhase;
  readonly config: HandsFreeConfig;
  readonly queue: readonly HandsFreeQueueItem[];
  readonly index: number;
  /** Attempts spent on the current card. 0 is the scored one. */
  readonly attempt: number;
  readonly step: HandsFreeStep;
  readonly startedAt: number;
  readonly now: number;
  readonly pausedAt: number | null;
  readonly pausedTotalMs: number;
  readonly pauseReason: PauseReason | null;
  /** Phase to return to on resume — always the start of the current item. */
  readonly itemStartedAt: number;
  readonly itemCostEwmaMs: number;
  readonly itemsAttempted: number;
  readonly itemsCorrect: number;
  readonly outbox: readonly HandsFreeCommit[];
  readonly endReason: EndReason | null;
}

// ─── Events ─────────────────────────────────────────────────────────────

export type HandsFreeEvent =
  | { type: 'START'; now: number; queue: HandsFreeQueueItem[] }
  /** Playback of the current audio step finished. */
  | { type: 'STEP_DONE'; now: number }
  /** A graded answer. The host does transcription and grading. */
  | {
      type: 'ANSWER';
      now: number;
      commitId: string;
      rating: ReviewRating;
      transcript: string;
      wasCorrect: boolean;
      responseTimeMs: number;
      phraseKey: FeedbackPhraseKey;
    }
  /** The listen window produced nothing gradeable. Never scores the card. */
  | { type: 'LISTEN_ABORTED'; now: number; reason: 'max_window' | 'no_speech' | 'too_short' | 'low_confidence' }
  | { type: 'COMMAND'; now: number; command: HandsFreeCommand }
  | { type: 'PAUSE'; now: number; reason: PauseReason }
  | { type: 'RESUME'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'QUEUE_APPENDED'; now: number; items: HandsFreeQueueItem[] }
  | { type: 'END'; now: number; reason: EndReason }
  | { type: 'STEP_FAILED'; now: number; stage: 'tts' | 'stt' | 'grade'; recoverable: boolean };

// ─── Helpers ────────────────────────────────────────────────────────────

export function createHandsFreeSession(
  config: HandsFreeConfig,
  now: number,
): HandsFreeSessionState {
  return {
    phase: 'idle',
    config,
    queue: [],
    index: 0,
    attempt: 0,
    step: { kind: 'none' },
    startedAt: now,
    now,
    pausedAt: null,
    pausedTotalMs: 0,
    pauseReason: null,
    itemStartedAt: now,
    itemCostEwmaMs: INITIAL_ITEM_COST_MS,
    itemsAttempted: 0,
    itemsCorrect: 0,
    outbox: [],
    endReason: null,
  };
}

/** Session time excluding anything spent paused. */
export function elapsedMs(state: HandsFreeSessionState): number {
  const pausedNow = state.pausedAt === null ? 0 : state.now - state.pausedAt;
  return Math.max(0, state.now - state.startedAt - state.pausedTotalMs - pausedNow);
}

export function remainingMs(state: HandsFreeSessionState): number {
  return Math.max(0, state.config.targetDurationMs - elapsedMs(state));
}

/**
 * Whether there is room for another item. Uses the measured cost rather than a
 * fixed guess, so a session that is running slow stops sooner instead of
 * overrunning the learner's commute.
 */
export function hasBudgetForAnotherItem(state: HandsFreeSessionState): boolean {
  if (!Number.isFinite(state.config.targetDurationMs)) return true;
  return remainingMs(state) >= state.itemCostEwmaMs * state.config.budgetSafetyFactor;
}

/** Card ids the host should have audio cached for. */
export function prefetchWindow(state: HandsFreeSessionState): string[] {
  return state.queue.slice(state.index, state.index + PREFETCH_AHEAD).map((i) => i.cardId);
}

export function currentItem(state: HandsFreeSessionState): HandsFreeQueueItem | null {
  return state.queue[state.index] ?? null;
}

/** How many more items the host should fetch to fill the remaining budget. */
export function shouldTopUpQueue(state: HandsFreeSessionState): number {
  if (state.phase === 'ended' || state.phase === 'summarizing') return 0;
  const left = state.queue.length - state.index;
  if (!Number.isFinite(state.config.targetDurationMs)) {
    return Math.max(0, PREFETCH_AHEAD - left);
  }
  const affordable = Math.floor(remainingMs(state) / Math.max(1, state.itemCostEwmaMs));
  return Math.max(0, Math.min(affordable, PREFETCH_AHEAD) - left);
}

export function handsFreeSummaryText(state: HandsFreeSessionState): string {
  if (state.itemsAttempted === 0) return 'Session finished. Nothing reviewed this time.';
  return `Session finished. ${state.itemsCorrect} of ${state.itemsAttempted} correct.`;
}

/** Remove and return pending commits. */
export function drainCommits(state: HandsFreeSessionState): {
  state: HandsFreeSessionState;
  commits: HandsFreeCommit[];
} {
  if (state.outbox.length === 0) return { state, commits: [] };
  return { state: { ...state, outbox: [] }, commits: [...state.outbox] };
}

// ─── Internal transitions ───────────────────────────────────────────────

function announceText(state: HandsFreeSessionState): string {
  const total = Number.isFinite(state.config.targetDurationMs) ? state.queue.length : null;
  const n = state.index + 1;
  return total === null ? `Card ${n}.` : `Card ${n} of ${total}.`;
}

/** Enter the announce step for the item at `index`, or finish if none remains. */
function beginItem(state: HandsFreeSessionState, now: number): HandsFreeSessionState {
  const base = { ...state, now, attempt: 0, itemStartedAt: now };

  if (base.index >= base.queue.length || !hasBudgetForAnotherItem(base)) {
    return toSummary(base, now);
  }
  return { ...base, phase: 'announcing', step: { kind: 'announce', text: announceText(base) } };
}

function toSummary(state: HandsFreeSessionState, now: number): HandsFreeSessionState {
  return {
    ...state,
    now,
    phase: 'summarizing',
    step: { kind: 'summary', text: handsFreeSummaryText(state) },
  };
}

/**
 * Replay the current item without re-scoring it. Does not touch `attempt` —
 * callers decide whether a replay consumes one, because a learner asking to
 * hear a card again should not burn a retry.
 */
function replayItem(state: HandsFreeSessionState, now: number): HandsFreeSessionState {
  const item = currentItem(state);
  if (!item) return toSummary(state, now);
  return {
    ...state,
    now,
    phase: 'prompting',
    step: { kind: 'prompt', cardId: item.cardId, text: item.promptText, lang: item.promptLang },
  };
}

/** Whether the current card still has a retry left. */
function canRetry(state: HandsFreeSessionState): boolean {
  return state.attempt + 1 < state.config.maxAttemptsPerCard;
}

/** Finish the current item, fold its cost into the estimate, and move on. */
function advanceItem(state: HandsFreeSessionState, now: number): HandsFreeSessionState {
  const cost = Math.max(0, now - state.itemStartedAt);
  // The seed is a guess, so the first measured item replaces it outright
  // rather than being averaged against it — otherwise the guess keeps
  // distorting the budget for several items. `index === 0` identifies the
  // first item to complete; itemsAttempted cannot be used here because ANSWER
  // has already incremented it by this point.
  const ewma =
    state.index === 0
      ? cost
      : state.itemCostEwmaMs * (1 - COST_EWMA_ALPHA) + cost * COST_EWMA_ALPHA;

  return beginItem({ ...state, index: state.index + 1, itemCostEwmaMs: ewma }, now);
}

function endSession(
  state: HandsFreeSessionState,
  now: number,
  reason: EndReason,
): HandsFreeSessionState {
  return { ...state, now, phase: 'ended', step: { kind: 'none' }, endReason: reason };
}

// ─── Reducer ────────────────────────────────────────────────────────────

/**
 * Total function. Any event in any phase returns a valid state; unhandled
 * combinations are no-ops rather than throws, because a dropped audio callback
 * must never crash a session the learner cannot see.
 */
export function handsFreeReduce(
  state: HandsFreeSessionState,
  event: HandsFreeEvent,
): HandsFreeSessionState {
  // A finished session is inert. Late audio callbacks arrive routinely.
  if (state.phase === 'ended') return state;

  switch (event.type) {
    case 'START': {
      if (state.phase !== 'idle') return state;
      const seeded: HandsFreeSessionState = {
        ...state,
        now: event.now,
        startedAt: event.now,
        queue: event.queue,
        index: 0,
      };
      if (event.queue.length === 0) return toSummary(seeded, event.now);
      return beginItem(seeded, event.now);
    }

    case 'STEP_DONE': {
      const s = { ...state, now: event.now };
      const item = currentItem(s);

      switch (s.phase) {
        case 'announcing':
          if (!item) return toSummary(s, event.now);
          return {
            ...s,
            phase: 'prompting',
            step: { kind: 'prompt', cardId: item.cardId, text: item.promptText, lang: item.promptLang },
          };

        case 'prompting':
          return { ...s, phase: 'earcon', step: { kind: 'earcon', tone: 'your_turn' } };

        case 'earcon':
          if (!item) return toSummary(s, event.now);
          return {
            ...s,
            phase: 'listening',
            step: { kind: 'listen', cardId: item.cardId, vad: s.config.vad },
          };

        case 'feedback':
          return advanceItem(s, event.now);

        case 'retry_feedback':
          return replayItem(s, event.now);

        case 'summarizing':
          return endSession(s, event.now, 'completed');

        default:
          return s;
      }
    }

    case 'ANSWER': {
      if (state.phase !== 'listening') return state;
      const item = currentItem(state);
      if (!item) return toSummary({ ...state, now: event.now }, event.now);

      // Only the first attempt is scored. A replay teaches; it does not
      // re-grade, because SM-2 is asking whether recall was unaided.
      const scoring = state.attempt === 0;

      const withResult: HandsFreeSessionState = {
        ...state,
        now: event.now,
        itemsAttempted: scoring ? state.itemsAttempted + 1 : state.itemsAttempted,
        itemsCorrect:
          scoring && event.wasCorrect ? state.itemsCorrect + 1 : state.itemsCorrect,
        outbox: scoring
          ? [
              ...state.outbox,
              {
                commitId: event.commitId,
                cardId: item.cardId,
                reviewItemId: item.reviewItemId,
                rating: event.rating,
                transcript: event.transcript,
                responseTimeMs: event.responseTimeMs,
                wasCorrect: event.wasCorrect,
              },
            ]
          : state.outbox,
      };

      // A wrong answer replays the card once, for learning. The replay is not
      // re-scored — the commit above already happened.
      const willRetry = !event.wasCorrect && state.config.repeatOnFail && canRetry(state);

      return {
        ...withResult,
        phase: willRetry ? 'retry_feedback' : 'feedback',
        attempt: willRetry ? state.attempt + 1 : state.attempt,
        step: {
          kind: 'feedback',
          phraseKey: event.phraseKey,
          text: event.wasCorrect ? '' : item.expectedText,
        },
      };
    }

    case 'LISTEN_ABORTED': {
      if (state.phase !== 'listening') return state;
      const s = { ...state, now: event.now };

      // Deliberately no commit on any path here. An unheard answer is not a
      // wrong answer, and treating it as one would let a noisy road quietly
      // destroy the learner's schedule.
      if (canRetry(s)) {
        return {
          ...s,
          phase: 'retry_feedback',
          attempt: s.attempt + 1,
          step: { kind: 'feedback', phraseKey: 'not_caught', text: '' },
        };
      }
      // Out of retries: move on WITHOUT scoring. The card stays due.
      return advanceItem(s, event.now);
    }

    case 'COMMAND': {
      const s = { ...state, now: event.now };
      switch (event.command) {
        case 'pause':
          return handsFreeReduce(s, { type: 'PAUSE', now: event.now, reason: 'user' });
        case 'end':
          return endSession(s, event.now, 'user_ended');
        case 'skip':
          return advanceItem(s, event.now);
        case 'repeat':
          return replayItem(s, event.now);
        default:
          return s;
      }
    }

    case 'PAUSE': {
      if (state.phase === 'paused' || state.phase === 'summarizing') return state;
      return {
        ...state,
        now: event.now,
        phase: 'paused',
        pausedAt: event.now,
        pauseReason: event.reason,
        step: { kind: 'none' },
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || state.pausedAt === null) return state;
      const resumed: HandsFreeSessionState = {
        ...state,
        now: event.now,
        pausedTotalMs: state.pausedTotalMs + (event.now - state.pausedAt),
        pausedAt: null,
        pauseReason: null,
      };
      // Restart the current item rather than resuming mid-utterance.
      return beginItem(resumed, event.now);
    }

    case 'TICK': {
      const s = { ...state, now: event.now };
      // A pause the learner never came back from ends the session rather than
      // sitting open forever holding the audio route.
      if (
        s.phase === 'paused' &&
        s.pausedAt !== null &&
        s.pauseReason !== 'user' &&
        event.now - s.pausedAt >= s.config.resumeGraceMs
      ) {
        return endSession(s, event.now, 'interrupted');
      }
      return s;
    }

    case 'QUEUE_APPENDED': {
      if (state.phase === 'summarizing') return state;
      return { ...state, now: event.now, queue: [...state.queue, ...event.items] };
    }

    case 'END':
      return endSession({ ...state, now: event.now }, event.now, event.reason);

    case 'STEP_FAILED': {
      const s = { ...state, now: event.now };
      if (!event.recoverable) return endSession(s, event.now, 'error');
      // A failed prompt or feedback clip must not stall the loop. Skip past
      // the broken step rather than waiting for audio that will never arrive.
      return s.phase === 'listening' ? advanceItem(s, event.now) : handsFreeReduce(s, { type: 'STEP_DONE', now: event.now });
    }

    default:
      return state;
  }
}
