/**
 * Content safety validation for AI-generated content.
 * All AI outputs must pass through validateContent() before display to learners.
 * Required by the product's learner-safety architecture rules.
 *
 * The deterministic pass catches high-confidence violations without a network
 * dependency. AI-generated text additionally uses OpenAI moderation before it
 * can be shown to a learner (see `moderation: 'required'`).
 */

import { providerFetch, PROVIDER_TIMEOUT_MS } from './provider-fetch.ts';

// ─── Types ───────────────────────────────────────────────────────────

export interface ContentSafetyResult {
  safe: boolean;
  flags: string[];
  sanitizedContent?: string;
}

export interface LevelCheckResult {
  appropriate: boolean;
  detectedLevel: string;
  targetLevel: string;
  issues: string[];
}

// ─── Pattern Definitions ─────────────────────────────────────────────

/** Common profanity patterns (English). Extend per target language as needed. */
const PROFANITY_PATTERNS = [
  /\b(fuck|shit|damn|ass|bitch|bastard|crap|dick|piss|cunt|slut|whore)\b/i,
  /\bf+u+c+k+/i,
  /\bs+h+i+t+/i,
];

/**
 * Strong profanity in the app's target languages (es/fr/de/it/pt).
 * Matched against diacritic-stripped text (see normalizeForMatching), so
 * accented evasions like "jodér" still match. Terms whose stripped form
 * collides with a common innocent word (e.g. es "coño" → "cono" = cone)
 * are deliberately excluded from this deterministic pass — the LLM pass
 * covers those.
 */
const MULTILINGUAL_PROFANITY_PATTERNS = [
  // Spanish
  /\b(mierda|joder|puta|puto|cabron|gilipollas|pendejo|verga|polla|maricon)\b/i,
  // French
  /\b(merde|putain|salope|connard|connasse|encule|pute|batard)\b/i,
  // German
  /\b(scheisse|scheiss|fotze|hurensohn|arschloch|fick|wichser)\b/i,
  // Italian
  /\b(cazzo|puttana|stronzo|vaffanculo|troia|merda)\b/i,
  // Portuguese
  /\b(caralho|porra|foda|merda|puta|buceta|viado)\b/i,
];

/**
 * High-confidence threats and self-harm directives in every language the app
 * teaches. Keep this list contextual: broad nouns such as `suicide`, `bomb`,
 * or `sex` incorrectly reject legitimate lessons (for example, a discussion
 * of suicide prevention). The model moderation pass handles nuanced prose.
 */
const VIOLENCE_PATTERNS = [
  // English
  /\b(?:i(?:'ll|\s+will|\s+am going to)|we(?:'ll|\s+will|\s+are going to))\s+(?:kill|murder|stab|shoot)\s+(?:you|him|her|them)\b/i,
  /\b(?:kill|hurt|shoot|stab|hang)\s+yourself\b/i,
  // Spanish, French, German, Italian, Portuguese
  /\b(?:te voy a matar|voy a matarte|m[aá]tate)\b/i,
  /\b(?:je vais te tuer|tue[- ]toi)\b/i,
  /\b(?:ich werde dich t[oö]ten|bring dich um)\b/i,
  /\b(?:ti uccider[oò]|ammazzati|ucciditi)\b/i,
  /\b(?:vou te matar|vou matar voc[eê]|mate[- ]se)\b/i,
  // Russian, Japanese, Korean, Chinese (word boundaries do not work here).
  /(?:я\s+тебя\s+убью|убей\s+себя)/i,
  /(?:あなたを殺す|殺してやる|死ね)/,
  /(?:너를\s*죽이겠|죽여\s*버릴|죽어)/,
  /(?:我要杀你|杀了你|去死)/,
];

/** Sexual content patterns */
const SEXUAL_PATTERNS = [
  /\b(?:send|show|share|trade|buy|sell)\s+(?:me\s+|your\s+|some\s+)?(?:nudes?|porn(?:ography)?)\b/i,
  /\b(?:explicit sex|sexual roleplay|erotic roleplay)\b/i,
];

/** Hate speech / discriminatory patterns */
const HATE_SPEECH_PATTERNS = [
  /\b(nigger|nigga|faggot|retard|tranny|chink|spic|kike|wetback)\b/i,
  /\b(white\s*supremac|nazi|aryan\s*nation|ethnic\s*cleansing)\b/i,
];

/** PII patterns */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const URL_PATTERN = /https?:\/\/[^\s)>\]]+/gi;

/** Stricter patterns applied when the user is a minor */
const MINOR_EXTRA_PATTERNS = [
  /\b(?:let(?:'s| us)|you should|you can)\s+(?:drink|get drunk|gamble|place a bet|vape|smoke)\b/i,
  /\b(?:buy|score|sell)\s+(?:some\s+)?(?:cocaine|heroin|meth|marijuana|weed)\b/i,
  /\b(?:join me|meet me|find me)\s+(?:on|at)\s+(?:tinder|grindr|a casino)\b/i,
];

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';
const MAX_MODERATION_CHARS = 20_000;

export type ModerationMode = 'required' | 'best-effort' | 'skip';

type ModerationVerdict = {
  flagged: boolean;
  categories: string[];
};

function moderationApiKeyFromEnvironment(): string | null {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get: (name: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.Deno?.env?.get('OPENAI_KEY') ?? runtime.process?.env?.OPENAI_KEY ?? null;
}

// ─── CEFR Level Heuristics ──────────────────────────────────────────

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Rough heuristic thresholds per CEFR level */
const LEVEL_THRESHOLDS: Record<string, { maxAvgWordLen: number; maxSentenceLen: number }> = {
  A1: { maxAvgWordLen: 5, maxSentenceLen: 8 },
  A2: { maxAvgWordLen: 6, maxSentenceLen: 12 },
  B1: { maxAvgWordLen: 7, maxSentenceLen: 18 },
  B2: { maxAvgWordLen: 8, maxSentenceLen: 25 },
  C1: { maxAvgWordLen: 9, maxSentenceLen: 35 },
  C2: { maxAvgWordLen: 100, maxSentenceLen: 100 },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function testPatterns(content: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(content));
}

/**
 * NFD-normalize and strip combining diacritics so accented evasions
 * ("jodér") match their base forms, and `\b` word boundaries (ASCII-only
 * in JS regex) work for accented languages.
 */
function normalizeForMatching(content: string): string {
  return content
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

function cefrIndex(level: string): number {
  const idx = CEFR_LEVELS.indexOf(level as typeof CEFR_LEVELS[number]);
  return idx === -1 ? -1 : idx;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Validate content for safety before displaying to a learner.
 * Uses deterministic regex matching for speed and predictability.
 *
 * @param content - The AI-generated text to validate.
 * @param options - Optional flags. Set `isMinor: true` for the minor-safe policy.
 * @returns A `ContentSafetyResult` indicating whether content is safe and any flags raised.
 */
export function validateContent(
  content: string,
  options?: { isMinor?: boolean }
): ContentSafetyResult {
  const flags: string[] = [];
  const normalized = normalizeForMatching(content);

  if (
    testPatterns(content, PROFANITY_PATTERNS) ||
    testPatterns(normalized, PROFANITY_PATTERNS) ||
    testPatterns(normalized, MULTILINGUAL_PROFANITY_PATTERNS)
  ) {
    flags.push('profanity');
  }
  if (testPatterns(content, VIOLENCE_PATTERNS) || testPatterns(normalized, VIOLENCE_PATTERNS)) {
    flags.push('violence');
  }
  if (testPatterns(content, SEXUAL_PATTERNS) || testPatterns(normalized, SEXUAL_PATTERNS)) {
    flags.push('sexual_content');
  }
  if (testPatterns(content, HATE_SPEECH_PATTERNS) || testPatterns(normalized, HATE_SPEECH_PATTERNS)) {
    flags.push('hate_speech');
  }

  // PII detection
  if (EMAIL_PATTERN.test(content) || PHONE_PATTERN.test(content) || SSN_PATTERN.test(content)) {
    flags.push('personal_info');
  }
  // Reset lastIndex for global regexes
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;
  SSN_PATTERN.lastIndex = 0;

  if (URL_PATTERN.test(content)) {
    flags.push('url');
  }
  URL_PATTERN.lastIndex = 0;

  // Stricter checks for minors
  if (options?.isMinor && testPatterns(content, MINOR_EXTRA_PATTERNS)) {
    flags.push('minor_inappropriate');
  }

  const safe = flags.length === 0;
  const result: ContentSafetyResult = { safe, flags };

  if (!safe) {
    result.sanitizedContent = sanitizeContent(content);
  }

  return result;
}

/**
 * Basic CEFR level heuristic based on sentence length and word complexity.
 * This is a rough proxy — not a substitute for AI-powered analysis.
 *
 * @param content - The text to check.
 * @param targetLevel - The learner's target CEFR level (e.g., 'A1', 'B2').
 * @returns A `LevelCheckResult` with detected vs target level and any issues.
 */
export function checkLevel(content: string, targetLevel: string): LevelCheckResult {
  const issues: string[] = [];

  // Tokenize
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = content.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return { appropriate: true, detectedLevel: targetLevel, targetLevel, issues: [] };
  }

  const avgWordLen = words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0) / words.length;
  const avgSentenceLen = sentences.length > 0 ? words.length / sentences.length : words.length;

  // Estimate detected level
  let detectedLevel = 'A1';
  for (const level of CEFR_LEVELS) {
    const thresholds = LEVEL_THRESHOLDS[level];
    if (avgWordLen <= thresholds.maxAvgWordLen && avgSentenceLen <= thresholds.maxSentenceLen) {
      detectedLevel = level;
      break;
    }
    detectedLevel = level; // If we exceed all thresholds, it's C2
  }

  const detectedIdx = cefrIndex(detectedLevel);
  const targetIdx = cefrIndex(targetLevel);

  // Flag if detected level is more than 1 step above target
  if (targetIdx >= 0 && detectedIdx > targetIdx + 1) {
    issues.push('vocabulary_too_advanced');
  }
  if (targetIdx >= 0 && avgSentenceLen > (LEVEL_THRESHOLDS[targetLevel]?.maxSentenceLen ?? 100) * 1.3) {
    issues.push('grammar_above_level');
  }

  return {
    appropriate: issues.length === 0,
    detectedLevel,
    targetLevel,
    issues,
  };
}

/**
 * Strip detected PII patterns from content.
 * Replaces emails, phone numbers, and SSN-like patterns with placeholder text.
 *
 * @param content - The text to sanitize.
 * @returns Sanitized text with PII replaced by placeholders.
 */
// ─── Backwards-Compatible Wrapper ───────────────────────────────────
// Several Edge Functions and validated-generate.ts import
// `validateContentSafety` / `SafetyCheck`. This async wrapper adapts
// the synchronous `validateContent` into the expected shape.

export interface SafetyCheck {
  safe: boolean;
  reasons: string[];
  /** True when best-effort model moderation could not run. */
  degraded?: boolean;
}

async function moderateContent(content: string, apiKey: string): Promise<ModerationVerdict | null> {
  try {
    const inputs: string[] = [];
    for (let offset = 0; offset < content.length; offset += MAX_MODERATION_CHARS) {
      inputs.push(content.slice(offset, offset + MAX_MODERATION_CHARS));
    }
    if (inputs.length === 0) inputs.push('');

    const response = await providerFetch(
      MODERATION_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODERATION_MODEL,
          input: inputs.length === 1 ? inputs[0] : inputs,
        }),
      },
      { provider: 'openai-moderation', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
    );
    if (!response.ok) return null;

    const body = await response.json();
    const results = body?.results;
    if (!Array.isArray(results) || results.length !== inputs.length) return null;
    if (results.some((result) => typeof result?.flagged !== 'boolean')) return null;

    const flagged = results.some((result) => result.flagged === true);
    const categories = [...new Set(results.flatMap((result) =>
      Object.entries(result.categories ?? {})
        .filter(([, categoryFlagged]) => categoryFlagged === true)
        .map(([category]) => category)
    ))];
    return { flagged, categories };
  } catch {
    return null;
  }
}

/**
 * Async wrapper around `validateContent` that maps `ContentSafetyResult`
 * into the `SafetyCheck` shape expected by callers (grade-writing,
 * validated-generate, tests).
 */
export async function validateContentSafety(
  content: string,
  options?: {
    userAge?: number;
    language?: string;
    fn?: string;
    /** Required for model output, best-effort for user input, skip for trusted fallback text. */
    moderation?: ModerationMode;
    /** Test seam and explicit credential for isolated callers. */
    moderationApiKey?: string | null;
  },
): Promise<SafetyCheck> {
  // The product does not currently collect verified age. Unknown users receive
  // the safer policy; an explicit adult age is the only opt-out.
  const isMinor = options?.userAge == null || options.userAge < 18;
  const result = validateContent(content, { isMinor });
  if (!result.safe) return { safe: false, reasons: result.flags };

  const mode = options?.moderation ?? 'best-effort';
  if (mode === 'skip') return { safe: true, reasons: [] };

  const apiKey = options?.moderationApiKey === undefined
    ? moderationApiKeyFromEnvironment()
    : options.moderationApiKey;
  if (!apiKey) {
    return mode === 'required'
      ? { safe: false, reasons: ['moderation_unavailable'] }
      : { safe: true, reasons: [], degraded: true };
  }

  const verdict = await moderateContent(content, apiKey);
  if (verdict === null) {
    return mode === 'required'
      ? { safe: false, reasons: ['moderation_unavailable'] }
      : { safe: true, reasons: [], degraded: true };
  }

  return verdict.flagged
    ? {
        safe: false,
        reasons: verdict.categories.length > 0
          ? verdict.categories.map((category) => `moderation:${category}`)
          : ['moderation:flagged'],
      }
    : { safe: true, reasons: [] };
}

export function sanitizeContent(content: string): string {
  let sanitized = content;
  sanitized = sanitized.replace(EMAIL_PATTERN, '[EMAIL REMOVED]');
  EMAIL_PATTERN.lastIndex = 0;
  sanitized = sanitized.replace(PHONE_PATTERN, '[PHONE REMOVED]');
  PHONE_PATTERN.lastIndex = 0;
  sanitized = sanitized.replace(SSN_PATTERN, '[SSN REMOVED]');
  SSN_PATTERN.lastIndex = 0;
  sanitized = sanitized.replace(URL_PATTERN, '[URL REMOVED]');
  URL_PATTERN.lastIndex = 0;
  return sanitized;
}
