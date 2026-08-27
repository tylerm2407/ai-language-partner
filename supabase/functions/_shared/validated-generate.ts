/**
 * `generateValidated` — orchestrate LLM generation + safety + level checks.
 *
 * Posture (Stream 3, vast-weaving-liskov.md):
 *   - Safety: STRICT. On an unsafe result, retry up to `safetyRetries` (default 2).
 *     On final failure, invoke `fallback()` and mark the result with
 *     `usedFallback: true`. Callers should surface the fallback text as the
 *     real response; the `validations.safety` object reflects the LAST attempt.
 *   - Provider: same shape. A `generate()` that THROWS — a timeout, a 5xx, an
 *     empty completion — is retried on the same budget and then falls back.
 *     It used to propagate instead, which meant CLAUDE.md §5's "retry then
 *     fall back to pre-authored content" only ever covered half the ways a
 *     generation fails, and the half it missed is the common one. Every caller
 *     already passes a real fallback (a per-language reply in ai-chat, a static
 *     hint in get-hint, an explicit skip sentinel in the batch generators), so
 *     the pre-authored content to fall back TO already existed — nothing
 *     reached it on a provider outage.
 *   - Level: WARN-ONLY. Never affects control flow. `validateContentLevel`
 *     emits a structured `level_warn` log when delta ≥ 2 sublevels.
 *
 * Structured logs emitted (grep-able in Supabase logs):
 *   - {"evt":"safety_reject","fn":...,"attempt":N,"reasons":[...], ...}
 *   - {"evt":"provider_error","fn":...,"attempt":N,"message":"...", ...}
 *   - {"evt":"safety_pass","fn":...,"attempt":N, ...}  (only after a retry
 *     or fallback — a clean first pass is silent to keep logs small)
 *   - {"evt":"used_fallback","fn":...,"reason":"safety"|"provider", ...}
 *
 * The provider's own error text is logged, never returned — it quotes the
 * request (and therefore the system prompt) back (CLAUDE.md §6).
 */

import { validateContentSafety, type SafetyCheck } from './content-safety.ts';
import { validateContentLevel, type CEFR, type LevelValidation } from './level-checker.ts';

export type ValidatedGenerateOpts = {
  /** Edge-function name (for log correlation). */
  fn: string;
  /** Attempt producer. Called up to safetyRetries+1 times. */
  generate: (attempt: number) => Promise<string>;
  /** Pre-authored / cached fallback. Called at most once if all retries fail. */
  fallback: () => Promise<string>;
  /** Optional CEFR target for the level-check warning log. */
  targetLevel?: CEFR;
  /** Language code or name (e.g. 'es' or 'Spanish'). */
  language?: string;
  /** Learner age. If < 18 the safety validator is stricter. */
  userAge?: number;
  /** Safety retry count. Default 2. */
  safetyRetries?: number;
  /** Skip level validation (useful for English-only system text). */
  skipLevelCheck?: boolean;
};

export type ValidatedResult = {
  text: string;
  usedFallback: boolean;
  /** Why the fallback fired. Undefined when it did not. Lets a caller tell an
   *  outage (retryable, worth a 502) from content the model kept getting
   *  wrong (not retryable in the same breath). */
  fallbackReason?: 'safety' | 'provider';
  validations: {
    safety: SafetyCheck;
    level?: LevelValidation;
  };
};

export async function generateValidated(
  opts: ValidatedGenerateOpts,
): Promise<ValidatedResult> {
  const { fn, generate, fallback, targetLevel, language, userAge } = opts;
  const retries = opts.safetyRetries ?? 2;
  const totalAttempts = retries + 1;

  let lastText = '';
  let lastSafety: SafetyCheck = { safe: false, reasons: ['no attempt made'] };
  // Which failure the fallback should be attributed to. A run that ends with
  // the provider unreachable is a different operational event from one where
  // the model answered three times and the safety checker refused all three.
  let lastFailure: 'safety' | 'provider' = 'provider';

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      lastText = await generate(attempt);
    } catch (err) {
      lastFailure = 'provider';
      console.log(JSON.stringify({
        evt: 'provider_error',
        fn,
        attempt,
        message: err instanceof Error ? err.message : String(err),
        language,
        ts: new Date().toISOString(),
      }));
      continue;
    }

    lastSafety = await validateContentSafety(lastText, {
      userAge,
      language,
      fn,
    });

    if (lastSafety.safe) {
      if (attempt > 1) {
        console.log(JSON.stringify({
          evt: 'safety_pass',
          fn,
          attempt,
          language,
          ts: new Date().toISOString(),
        }));
      }
      return buildResult(lastText, undefined, lastSafety, fn, language, targetLevel, opts.skipLevelCheck);
    }

    lastFailure = 'safety';
    console.log(JSON.stringify({
      evt: 'safety_reject',
      fn,
      attempt,
      reasons: lastSafety.reasons,
      language,
      ts: new Date().toISOString(),
    }));
  }

  // All attempts failed — fall back.
  const fallbackText = await fallback();
  // We still safety-check the fallback in case it was authored carelessly
  // (or in get-hint's case, is itself template output).
  const fallbackSafety = await validateContentSafety(fallbackText, {
    userAge,
    language,
    fn,
  });

  console.log(JSON.stringify({
    evt: 'used_fallback',
    fn,
    reason: lastFailure,
    language,
    ts: new Date().toISOString(),
  }));

  return buildResult(fallbackText, lastFailure, fallbackSafety, fn, language, targetLevel, opts.skipLevelCheck);
}

function buildResult(
  text: string,
  fallbackReason: 'safety' | 'provider' | undefined,
  safety: SafetyCheck,
  fn: string,
  language: string | undefined,
  targetLevel: CEFR | undefined,
  skipLevelCheck: boolean | undefined,
): ValidatedResult {
  let level: LevelValidation | undefined;
  if (!skipLevelCheck && targetLevel && language) {
    level = validateContentLevel(text, language, targetLevel, { functionName: fn });
  }
  return {
    text,
    usedFallback: fallbackReason !== undefined,
    fallbackReason,
    validations: { safety, level },
  };
}
