/**
 * Which opt-in learner-context sections a text-chat turn may fetch.
 *
 * One decision, out here rather than inline in `index.ts`, because it is the
 * entitlement boundary for a paid personalisation feature and `index.ts` calls
 * `serve()` at module scope — anything left in there cannot be unit-tested
 * without standing up an HTTP listener (the same reason `parse.ts`,
 * `prompt.ts` and `turn-policy.ts` exist).
 */

import {
  isEntitledToLearnerContext,
  type SnapshotSection,
} from '../_shared/learner-context.ts';

/**
 * `['goal']` for basic and up, `[]` for everyone else.
 *
 * The gate is `isEntitledToLearnerContext` and nothing else — deliberately NOT
 * the text allowance the caller has already resolved, which is what gates the
 * *base* snapshot.
 *
 * That distinction is the whole point of this function. A `starter` learner in
 * a classroom can have `dailyTextMessages > 0`, because their org's
 * `contract_config` is merged in by `get_effective_limits`; their school bought
 * them conversation turns. It did not buy them a paid personalisation feature,
 * and the onboarding "picture a moment" answer (`user_profiles.ideal_l2_self`)
 * is one. So that student keeps the base context — what they keep getting
 * wrong, which is what their turns paid for — and gets no goal line. Resolving
 * the gate on the allowance instead would have handed the feature to every
 * school-contract student and to nobody else on the free tier, which is not a
 * rule anyone could have intended.
 *
 * An unresolvable tier is not a paid tier: `resolveEntitlement` fails closed to
 * `starter`, and this fails closed on anything it does not recognise.
 *
 * `goal_track` is deliberately NOT requested here even though the live voice
 * tutor asks for it alongside `goal`. That tutor resolves its context once per
 * SESSION; this runs once per TURN, and `fetchGoalTrack` is an extra round trip
 * on every message of every conversation. What it buys — the situations the
 * learner is training for — is in chat already stated outright by `scenarioKey`
 * and `topic`, so the turn would pay a query to be told what it was handed.
 * `pronunciation` is skipped for a second reason on top: a typed turn has no
 * pronunciation to shape.
 */
export function learnerContextIncludeFor(tier: string | null | undefined): SnapshotSection[] {
  return isEntitledToLearnerContext(tier) ? ['goal'] : [];
}
