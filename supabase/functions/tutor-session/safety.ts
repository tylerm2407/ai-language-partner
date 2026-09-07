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
 * THE LANGUAGE GAP, AND WHAT CLOSES IT
 *
 * `_shared/content-safety.ts` is regex-only. Its word boundaries are ASCII and
 * its term lists cover English plus es/fr/de/it/pt. Against Japanese, Korean,
 * Chinese and Russian — four of the nine languages this app teaches — it is
 * very nearly blind. In JSON-mode chat that gap is partly covered by the model
 * being tightly constrained by an output schema. A free-form spoken tutor is
 * not constrained that way at all.
 *
 * So for those four languages we additionally call OpenAI's moderation
 * endpoint, which is multilingual and free. The regex pass still runs
 * everywhere: it is deterministic, sub-millisecond, and catches things a
 * general-purpose classifier is not tuned for.
 */
import { validateContentSafety } from '../_shared/content-safety.ts';
import { providerFetch, PROVIDER_TIMEOUT_MS } from '../_shared/provider-fetch.ts';

/**
 * Languages `_shared/content-safety.ts` actually has patterns for.
 *
 * Deliberately a positive list, not a negative one: adding a tenth language to
 * the app must not silently inherit "covered" status. If you add patterns for a
 * language, add it here in the same change.
 */
export const REGEX_COVERED_LANGUAGES: ReadonlySet<string> = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt',
]);

/** The four the regex cannot see. Derived, so the two lists cannot drift. */
export function needsModeration(language: string): boolean {
  return !REGEX_COVERED_LANGUAGES.has(language);
}

export interface TutorSafetyVerdict {
  safe: boolean;
  flags: string[];
  /** Which pass produced the verdict. Recorded so an operator reading
   *  tutor_safety_events can tell a regex hit from a classifier hit, and can
   *  tell either from a moderation call that never completed. */
  source: 'regex' | 'moderation' | 'both' | 'regex_only_degraded';
}

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';

/** Transcripts are capped upstream, but never hand an unbounded string to a
 *  paid endpoint — the cap belongs at the boundary too. */
const MAX_MODERATION_CHARS = 1000;

async function moderate(text: string, apiKey: string): Promise<{ flagged: boolean; categories: string[] } | null> {
  try {
    const res = await providerFetch(
      MODERATION_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODERATION_MODEL, input: text.slice(0, MAX_MODERATION_CHARS) }),
      },
      { provider: 'openai-moderation', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const result = body?.results?.[0];
    if (!result) return null;
    const categories = Object.entries(result.categories ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    return { flagged: result.flagged === true, categories };
  } catch {
    // Includes ProviderTimeoutError. Swallowed on purpose — see the fail-open
    // note in checkTutorOutput.
    return null;
  }
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
 * during an OpenAI moderation outage every single tutor turn in Japanese,
 * Korean, Chinese and Russian gets cut mid-sentence. That is not a safer
 * product, it is a broken one, and the failure would be silent and total for
 * four languages at once. Failing open returns those languages to exactly the
 * protection they had before this function existed: the system instructions,
 * which forbid the same content, plus the regex pass, which still runs.
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
  });

  if (!needsModeration(opts.language)) {
    return { safe: regex.safe, flags: regex.reasons, source: 'regex' };
  }

  if (!opts.apiKey) {
    return { safe: regex.safe, flags: regex.reasons, source: 'regex_only_degraded' };
  }

  const verdict = await moderate(text, opts.apiKey);
  if (verdict === null) {
    return { safe: regex.safe, flags: regex.reasons, source: 'regex_only_degraded' };
  }

  const flags = [...regex.reasons, ...verdict.categories.map((c) => `moderation:${c}`)];
  return {
    safe: regex.safe && !verdict.flagged,
    flags,
    source: 'both',
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
