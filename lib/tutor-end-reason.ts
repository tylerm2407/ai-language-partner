/**
 * Translating why a call stopped into what the server is told.
 *
 * There are two end-reason vocabularies in this feature and they are not the
 * same size:
 *
 *   client — `TutorEndReason` in `lib/realtime-session.ts`. Nine values,
 *            because the state machine has to distinguish a revoked
 *            microphone from a dropped socket in order to decide what the
 *            learner sees next.
 *   wire   — `supabase/functions/tutor-session/end.ts`. Five values, because
 *            the server is deciding how to SETTLE a session, and settlement
 *            has fewer cases than user experience does.
 *
 * The narrowing is genuine, not laziness, and it belongs in one named place
 * rather than at the call site. An inline cast at the point of `endTutorSession`
 * would compile — `endReason` is typed as `string` on the wire — and would
 * silently send `'permission_denied'`, a value the server does not know, on a
 * request that settles money.
 *
 * Pure, total, and exhaustive by switch: adding a client reason is a type error
 * here rather than a value the server quietly ignores.
 */

import type { TutorEndReason } from './realtime-session';

/** What `supabase/functions/tutor-session/end.ts` accepts. */
export type WireEndReason = 'learner' | 'budget' | 'safety' | 'timeout' | 'error';

export function wireEndReason(reason: TutorEndReason): WireEndReason {
  switch (reason) {
    // The learner decided the call was over. Declining consent and leaving the
    // app are the same kind of event as tapping End — a person choosing to
    // stop — and settling them as errors would put a fault in the record for
    // something nothing went wrong in.
    case 'user_ended':
    case 'consent_declined':
    case 'app_backgrounded':
      return 'learner';

    // Ran out of allowance. The one reason the server prices differently.
    case 'budget_exhausted':
      return 'budget';

    // Hit the per-session ceiling rather than the per-day one. Not the
    // learner's doing and not a fault, which is exactly what 'timeout' means
    // on the server side.
    case 'session_max':
      return 'timeout';

    case 'safety':
      return 'safety';

    // Genuine faults. `permission_denied` sits here rather than under
    // 'learner' because by the time the state machine sees it, the microphone
    // was granted at the lobby and then went away — that is a failure, not a
    // choice.
    case 'network_lost':
    case 'server_error':
    case 'permission_denied':
      return 'error';
  }
}
