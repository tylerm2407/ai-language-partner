/**
 * The one-slot handover from the lobby to the call screen.
 *
 * ── WHY NOT ROUTE PARAMS ──
 *
 * The lobby mints the session, so it is holding a `StartTutorSessionResult`
 * that the call screen needs. The obvious way to pass it is the URL, and the
 * URL is exactly where it must not go: that object carries `clientSecret`, an
 * ephemeral OpenAI credential that can open a realtime call and spend against
 * this account's grant.
 *
 * A route param is not a function argument. It is a string in the navigation
 * state — retained in the back stack, serialised into any state persistence,
 * and printed by anything that logs a route. `lib/tutor-api.ts` ships a
 * `redactTutorSecrets` helper precisely because this value must never appear
 * in a log line; putting it in the URL would route around that on the way in.
 * The screen name in analytics is a closed set for a related reason.
 *
 * So the credential is handed over in memory and only the navigation happens
 * through the router. Nothing about the session appears in the route at all.
 *
 * ── WHAT HAPPENS WHEN THE SLOT IS EMPTY ──
 *
 * A cold deep link to `/tutor/call`, or a relaunch onto a restored route, will
 * find nothing here — there is no way to reconstruct a client secret, and it
 * would have expired anyway. The call screen must treat an empty slot as "go
 * back to the lobby and start properly", never as a blank screen. That is the
 * only failure mode this module has, and it is the one the call screen tests.
 *
 * Read is non-destructive so that a re-render does not lose the session; the
 * slot is cleared when the call ends, because a spent client secret kept
 * around is a credential with no reason to still exist.
 */

import type { StartTutorSessionResult } from './tutor-api';

let slot: StartTutorSessionResult | null = null;

/** Hand the call screen the session the lobby just minted. */
export function stashCallHandoff(session: StartTutorSessionResult): void {
  slot = session;
}

/**
 * Read the pending session, or null when there is none.
 *
 * Non-destructive: React renders a screen more than once and a session that
 * disappeared on the second render would bounce the learner back to the lobby
 * mid-connect.
 */
export function peekCallHandoff(): StartTutorSessionResult | null {
  return slot;
}

/**
 * Drop the credential.
 *
 * Called when the call ends, not when it starts. A client secret that has done
 * its job is a live credential with nothing left to do, and the cheapest place
 * to stop holding one is the moment it stops being needed.
 */
export function clearCallHandoff(): void {
  slot = null;
}
