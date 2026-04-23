/**
 * Content safety validation for AI-generated content.
 * All AI outputs must pass through validateContent() before display to learners.
 * Required by COPPA compliance and CLAUDE.md architecture rules.
 *
 * This is a first-pass deterministic safety net using regex pattern matching.
 * It catches obviously unsafe content — not a replacement for human review
 * or AI-based moderation on sensitive edge cases.
 */

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

/** Violence-related patterns */
const VIOLENCE_PATTERNS = [
  /\b(kill|murder|stab|shoot|bomb|suicide|self[- ]?harm|massacre|slaughter|rape)\b/i,
  /\b(terrorist|terrorism|execution|torture|assault)\b/i,
];

/** Sexual content patterns */
const SEXUAL_PATTERNS = [
  /\b(porn|pornography|nude|naked|sex(?:ual|ting)|genitals|orgasm|masturbat)\b/i,
  /\b(erotic|xxx|nsfw)\b/i,
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
  /\b(drug|alcohol|beer|wine|vodka|whiskey|marijuana|weed|cocaine|heroin|meth)\b/i,
  /\b(gambling|casino|bet(?:ting)?|vaping|vape|cigarette|smoking)\b/i,
  /\b(dating|hookup|tinder|grindr)\b/i,
];

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
 * @param options - Optional flags. Set `isMinor: true` for stricter filtering (COPPA).
 * @returns A `ContentSafetyResult` indicating whether content is safe and any flags raised.
 */
export function validateContent(
  content: string,
  options?: { isMinor?: boolean }
): ContentSafetyResult {
  const flags: string[] = [];

  if (testPatterns(content, PROFANITY_PATTERNS)) flags.push('profanity');
  if (testPatterns(content, VIOLENCE_PATTERNS)) flags.push('violence');
  if (testPatterns(content, SEXUAL_PATTERNS)) flags.push('sexual_content');
  if (testPatterns(content, HATE_SPEECH_PATTERNS)) flags.push('hate_speech');

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
