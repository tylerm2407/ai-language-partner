/**
 * Post-hoc safety on the live tutor's speech.
 *
 * WHY THIS IS NOT THE NORMAL PIPELINE
 *
 * Every other AI surface in this app generates on the server, checks the text,
 * and only then shows it to a learner. The live tutor cannot work that way: the
 * audio travels directly from OpenAI to the learner's device over WebRTC and
 * never touches our infrastructure. There is no point at which output can be
 * gated BEFORE it is heard.
 *
 * So safety here is post-hoc. The client posts each completed tutor transcript
 * back to us, we check it, and on a flag we tell the client to cut playback and
 * cancel the response. A fraction of a second of flagged audio may already have
 * been heard. That is genuinely weaker than the pre-generation gate, it was
 * accepted deliberately in exchange for the latency that makes a spoken tutor
 * worth building at all, and CLAUDE.md rule 1 names it as the single exception.
 *
 * The shared validator covers high-confidence phrases in every supported
 * language and uses OpenAI moderation for nuance. Live audio cannot be gated
 * before playback, so an unavailable classifier degrades to the deterministic
 * pass and is recorded as such rather than ending every active voice session.
 */
import { validateContentSafety } from '../_shared/content-safety.ts';

export interface TutorSafetyVerdict {
  safe: boolean;
  flags: string[];
  /** Which pass produced the verdict. Recorded so an operator reading
   *  tutor_safety_events can tell a regex hit from a classifier hit, and can
   *  tell either from a moderation call that never completed. */
  source: 'regex' | 'moderation' | 'both' | 'regex_only_degraded';
}

/**
 * Check one completed tutor transcript.
 *
 * FAIL-OPEN, AND WHY
 *
 * If the moderation call errors or times out, this returns SAFE and records
 * `regex_only_degraded`. That is a deliberate choice, not an oversight.
 *
 * The alternative — treating an unreachable classifier as a flag — means that
 * during an OpenAI moderation outage every active tutor turn gets cut
 * mid-sentence. Failing open here returns live voice to the deterministic
 * protection used before the classifier, while `regex_only_degraded` keeps the
 * operational gap visible.
 *
 * This matches the stance the codebase already takes in `_shared/burst-limit.ts`,
 * which also fails open. The degradation is recorded rather than hidden, so it
 * is visible in logs instead of being discovered later.
 */
export async function checkTutorOutput(
  text: string,
  opts: { language: string; userAge?: number; apiKey?: string | null },
): Promise<TutorSafetyVerdict> {
  const regex = await validateContentSafety(text, {
    language: opts.language,
    userAge: opts.userAge,
    fn: 'tutor-session',
    moderation: 'best-effort',
    moderationApiKey: opts.apiKey,
  });

  if (regex.degraded) {
    return { safe: regex.safe, flags: regex.reasons, source: 'regex_only_degraded' };
  }

  const modelFlagged = regex.reasons.some((reason) => reason.startsWith('moderation:'));
  return {
    safe: regex.safe,
    flags: regex.reasons,
    source: modelFlagged ? 'moderation' : regex.safe ? 'both' : 'regex',
  };
}

/**
 * How many cuts end a session.
 *
 * A tutor that has been cut three times in one conversation is not going to
 * recover, and the learner is by then having a visibly broken experience. End
 * it, refund the unused budget, and let them start again.
 */
export const TUTOR_MAX_SAFETY_CUTS = 3;
