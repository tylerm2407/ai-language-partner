/**
 * Time budgeting for a live speech-to-speech tutor call.
 *
 * THIS IS NOT AN OPTIMISATION. Without it the feature is broken on every tier.
 *
 * The sibling of `lib/handsfree-budget.ts`, and it exists to prevent the same
 * specific, bad failure: a learner starts a session, settles into it, and the
 * audio dies three minutes later with a quota error they cannot read or act
 * on. In a live call that is worse than in hands-free — the tutor stops
 * mid-sentence, so it reads as a crash rather than a limit. Better to warn
 * while there is still time to react, let the tutor wind the conversation up
 * like a person would, and only then stop.
 *
 * ── CENTS ARE SERVER-SIDE. THE LEARNER SEES MINUTES. ──
 *
 * The server meters realtime audio in cents, because that is what the vendor
 * charges and the only unit in which a per-tier ceiling can be enforced
 * honestly. It hands the client a grant already converted to milliseconds.
 * Nothing in this module, and nothing downstream of it, may render a dollar
 * figure, a cent figure, or a "credits" count for remaining AI time.
 *
 * Two reasons, and the second is the one that matters:
 *   1. A learner who paid a flat monthly price did not buy cents. Showing
 *      them a balance draining in currency turns a subscription into a meter
 *      running in a taxi, which is the exact anxiety a flat price sells them
 *      out of.
 *   2. The cents figure is our COST, not their price. Publishing it publishes
 *      our margin per learner, per minute, to anyone who screenshots it.
 *
 * `tutor-budget.test.ts` asserts no currency symbol can appear in any copy
 * this module produces. Keep that test.
 *
 * ── Tier semantics ──
 *
 * `tier` here is the EFFECTIVE tier — `effectiveTier(subscription,
 * entitledTier)` from `stores/useAppStore`, which takes the higher of the
 * learner's own subscription and any school entitlement. It is passed in
 * already resolved rather than computed here so this module stays pure and
 * store-free; the same convention the chat screen already follows. The
 * upsell-vs-top-tier decision is then `lib/limit-messaging.ts`'s to make, not
 * ours: below the top tier a ceiling is an upgrade moment, on it there is
 * nothing to sell and the only useful information is when the allowance
 * returns.
 */

import { limitCopy, TUTOR_FEATURE_NOUN, type LimitCopy, type Tier } from './limit-messaging';

/**
 * Remaining time at which the learner is told the call is running out.
 *
 * Two minutes because that is long enough to finish the exchange they are in
 * and say goodbye. A warning that arrives with fifteen seconds left is not a
 * warning, it is an announcement.
 */
export const WARN_REMAINING_MS = 120_000;

/**
 * Remaining time at which the TUTOR is told to start closing.
 *
 * Distinct from the warning above and aimed at a different audience: the
 * warning is a banner the learner reads, this is an instruction we inject
 * into the session so the model steers toward a natural ending. A tutor that
 * asks an open question with forty seconds left has set the learner up to be
 * cut off mid-answer.
 */
export const CLOSING_CUE_REMAINING_MS = 60_000;

/**
 * The instruction sent to the model when the closing cue fires.
 *
 * NOT learner-facing — it never appears on screen. Phrased as a stance rather
 * than a script so the tutor closes in the target language, in its own voice,
 * at whatever point in the exchange it actually is.
 */
export const CLOSING_CUE_INSTRUCTION =
  'The session is nearly over. Bring the conversation to a natural close in ' +
  'the next couple of turns: acknowledge what was just said, do not ask a ' +
  'new open question, and say goodbye warmly.';

/** Re-bound locally for readability. The single definition lives in
 *  `lib/limit-messaging.ts` — see the note there on why it is shared. */
const FEATURE_NOUN = TUTOR_FEATURE_NOUN;

export interface TutorBudgetInput {
  /** Milliseconds the server granted this call. Already converted from cents. */
  grantedMs: number;
  /** Milliseconds of call already spent. */
  elapsedMs: number;
  /** The learner's EFFECTIVE tier — see the header. */
  tier: Tier | string | null | undefined;
}

export interface TutorBudgetVerdict {
  /** Milliseconds left. Never negative, never NaN. */
  remainingMs: number;
  /**
   * Whole minutes to SHOW. Rounded up, so a learner with 30 seconds left is
   * told "1 minute" rather than "0 minutes" — zero reads as "already over"
   * while the tutor is still talking.
   */
  remainingMinutes: number;
  /** Show the running-out banner. */
  shouldWarn: boolean;
  /** Inject CLOSING_CUE_INSTRUCTION into the session. */
  shouldSendClosingCue: boolean;
  /** Stop the call. Terminal — nothing below it is worth acting on. */
  shouldEnd: boolean;
  /**
   * Learner-facing line for the banner, or `null` when there is nothing worth
   * saying yet. Minutes only — see the header.
   */
  notice: string | null;
}

/** "1 minute" / "2 minutes". */
function minutesLabel(minutes: number): string {
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Where the call stands against its budget.
 *
 * Deliberately fails CLOSED. A grant that is missing, negative or non-finite
 * ends the call rather than being treated as generous: this budget governs
 * real per-minute spend, and the one outcome we cannot walk back is having
 * already spent it. An unnecessary "time's up" costs the learner a tap to
 * start again; an unbounded call costs money on every tier at once.
 */
export function assessTutorBudget(input: TutorBudgetInput): TutorBudgetVerdict {
  const granted = Number.isFinite(input.grantedMs) ? input.grantedMs : 0;
  const elapsed = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : Infinity;
  const remainingMs = Math.max(0, granted - elapsed);
  const remainingMinutes = Math.ceil(remainingMs / 60_000);

  const shouldEnd = remainingMs <= 0;
  // The two cues stay TRUE through the rest of the call rather than firing in
  // exclusive bands: the banner must not vanish for the final minute, and a
  // caller that misses one tick must not miss the cue entirely. Callers that
  // act once (sending the model instruction) latch on the first true.
  const shouldSendClosingCue = !shouldEnd && remainingMs <= CLOSING_CUE_REMAINING_MS;
  const shouldWarn = !shouldEnd && remainingMs <= WARN_REMAINING_MS;

  return {
    remainingMs,
    remainingMinutes,
    shouldWarn,
    shouldSendClosingCue,
    shouldEnd,
    notice: shouldEnd
      ? null // The ended case gets the full tier-aware copy below, not a banner line.
      : shouldWarn
        ? `About ${minutesLabel(remainingMinutes)} of ${FEATURE_NOUN} left today.`
        : null,
  };
}

/**
 * What to say when the budget runs out.
 *
 * Routed through `limitCopy` rather than written here so the two audiences
 * cannot drift apart per-feature: below the top tier this is a sales moment,
 * on the top tier it is an honest "here is when it comes back". `now` is
 * injectable for the tests.
 */
export function tutorBudgetExhaustedCopy(
  tier: Tier | string | null | undefined,
  now: Date = new Date(),
): LimitCopy {
  return limitCopy(FEATURE_NOUN, tier, now);
}
