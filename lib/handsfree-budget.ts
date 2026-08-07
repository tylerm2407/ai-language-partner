/**
 * Voice-minute budgeting for a hands-free session.
 *
 * THIS IS NOT AN OPTIMISATION. Without it the feature is broken on every tier.
 *
 * The tts function charges one voice-minute per *uncached* generation,
 * regardless of clip length. Daily caps are starter 5 / basic 10 / premium 20 /
 * vip 30. A 20-minute session is roughly 20 cards, each needing a prompt and
 * sometimes a spoken answer line — comfortably more generations than any tier
 * allows.
 *
 * What makes it viable is that cache hits are free, and they are free twice
 * over: the tts function returns a cached clip BEFORE it checks quota, and the
 * on-device cache avoids the request entirely. So the real cost of a session
 * is not its length but how much of it is new audio.
 *
 * The failure this module exists to prevent is specific and bad: a learner
 * starts a session, drives off, and the audio dies three minutes later with a
 * quota error they cannot read or act on. Better to shorten the offered
 * session up front, or say plainly that there is not enough left today.
 */

import type { HandsFreeQueueItem } from './handsfree-session';

/** Voice-minutes charged per uncached generation, per the tts function. */
export const MINUTES_PER_GENERATION = 1;

/**
 * Kept back so a session cannot consume the learner's entire daily allowance
 * and leave them unable to use voice chat afterwards.
 */
export const RESERVE_MINUTES = 2;

export interface BudgetInput {
  /** Items the session intends to cover. */
  queue: HandsFreeQueueItem[];
  /** Cache keys already present on device. */
  cachedKeys: Set<string>;
  /** Builds the cache key for an item's prompt — injected to avoid a cycle. */
  keyFor: (item: HandsFreeQueueItem) => string;
  /** Daily voice-minute cap for the learner's plan. */
  dailyLimit: number;
  /** Voice-minutes already spent today. */
  usedToday: number;
  /**
   * Fixed lines (feedback, announcements) not yet cached. These are identical
   * across learners, so after the first ever use they are permanent server
   * cache hits and cost nothing.
   */
  uncachedConstantPhrases: number;
}

export interface BudgetVerdict {
  /** Generations the session would need if it ran the whole queue. */
  neededGenerations: number;
  /** Voice-minutes still available after the reserve. */
  availableMinutes: number;
  /** Items the budget actually supports. */
  affordableItems: number;
  /** True when the entire queue fits. */
  fitsEntirely: boolean;
  /** True when not even one item fits — do not start. */
  blocked: boolean;
}

/**
 * Decide what the budget supports.
 *
 * Deliberately conservative: it assumes every uncached prompt costs a
 * generation, and never assumes a server-side cache hit it cannot verify. Over
 * -estimating shortens a session; under-estimating strands someone mid-drive.
 */
export function assessVoiceBudget(input: BudgetInput): BudgetVerdict {
  const uncachedPrompts = input.queue.filter(
    (item) => !input.cachedKeys.has(input.keyFor(item)),
  ).length;

  const neededGenerations = uncachedPrompts + input.uncachedConstantPhrases;
  const availableMinutes = Math.max(0, input.dailyLimit - input.usedToday - RESERVE_MINUTES);

  // The fixed phrases are charged first: they are needed however short the
  // session is, so they come out of the budget before any card does.
  const afterConstants = Math.max(
    0,
    availableMinutes - input.uncachedConstantPhrases * MINUTES_PER_GENERATION,
  );
  const affordableUncached = Math.floor(afterConstants / MINUTES_PER_GENERATION);

  // Cached items are free, so they are always affordable on top.
  const cachedItems = input.queue.length - uncachedPrompts;
  const affordableItems = Math.min(
    input.queue.length,
    cachedItems + affordableUncached,
  );

  return {
    neededGenerations,
    availableMinutes,
    affordableItems,
    fitsEntirely: affordableItems >= input.queue.length,
    blocked: affordableItems === 0,
  };
}

/**
 * How long a session the budget supports, given a measured per-item cost.
 * Used to shorten the durations offered on the setup screen rather than
 * letting the learner pick one that cannot complete.
 */
export function affordableDurationMs(
  verdict: BudgetVerdict,
  itemCostMs: number,
): number {
  return Math.max(0, verdict.affordableItems * itemCostMs);
}

/**
 * Message for the setup screen when the full session will not fit.
 * `null` when everything fits and nothing needs saying.
 */
export function budgetNotice(verdict: BudgetVerdict): string | null {
  if (verdict.blocked) {
    return "You've used today's voice allowance. Hands-free sessions need it for the audio.";
  }
  if (!verdict.fitsEntirely) {
    return `Today's remaining voice allowance covers about ${verdict.affordableItems} cards.`;
  }
  return null;
}
