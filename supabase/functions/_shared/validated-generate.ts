/**
 * `generateValidated` — orchestrate LLM generation + safety + level checks.
 *
 * Posture (Stream 3, vast-weaving-liskov.md):
 *   - Safety: STRICT. On an unsafe result, retry up to `safetyRetries` (default 2).
 *     On final failure, invoke `fallback()` and mark the result with
 *     `usedFallback: true`. Callers should surface the fallback text as the
 *     real response; the `validations.safety` object reflects the LAST attempt.
 *   - Level: WARN-ONLY. Never affects control flow. `validateContentLevel`
 *     emits a structured `level_warn` log when delta ≥ 2 sublevels.
 *
 * Structured logs emitted (grep-able in Supabase logs):
 *   - {"evt":"safety_reject","fn":...,"attempt":N,"reasons":[...], ...}
 *   - {"evt":"safety_pass","fn":...,"attempt":N, ...}  (only after a retry
 *     or fallback — a clean first pass is silent to keep logs small)
 *   - {"evt":"used_fallback","fn":...,"reason":"safety", ...}
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

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    lastText = await generate(attempt);
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
      return buildResult(lastText, false, lastSafety, fn, language, targetLevel, opts.skipLevelCheck);
    }

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
    reason: 'safety',
    language,
    ts: new Date().toISOString(),
  }));

  return buildResult(fallbackText, true, fallbackSafety, fn, language, targetLevel, opts.skipLevelCheck);
}

function buildResult(
  text: string,
  usedFallback: boolean,
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
  return { text, usedFallback, validations: { safety, level } };
}
