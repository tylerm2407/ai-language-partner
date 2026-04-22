/**
 * CEFR Level Checker (Stream 3).
 *
 * Heuristic-only v1 — good enough for WARN-only posture (the user has
 * decided mismatches should log and pass, not block). Replace with a
 * trained classifier later if/when we want to gate production on this.
 *
 * Heuristics combined (research.md §1.3 / §6.1):
 *   - Average word length (characters).
 *   - Average sentence length (words).
 *   - Function-word ratio (top-50 frequency lemmas / total tokens).
 *
 * Threshold bands below are derived from published CEFR readability
 * research summarized in research.md §6.1. The mapping is intentionally
 * coarse — we only need reliable differentiation of A1 vs C1+, not
 * precise A2-vs-B1 resolution (warn-only posture).
 *
 * Non-Latin scripts (ja, ko, zh, ar, hi, ru): the word-length metric is
 * invalid. We degrade gracefully by weighting sentence-length higher and
 * using character counts as a proxy. See `nonLatinAssess()` below. This
 * is a known limitation; a real implementation would need per-language
 * tokenizers (MeCab, KoNLPy, jieba) which are out of scope for an edge
 * function.
 */

export type CEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LevelAssessment = {
  detectedLevel: CEFR;
  confidence: number;
  metrics: {
    avgWordLen: number;
    avgSentenceLen: number;
    functionWordRatio: number;
  };
};

export type LevelValidation = {
  inRange: boolean;
  detected: CEFR;
  /** CEFR sub-level delta. Positive = detected is harder than target. */
  delta: number;
};

const CEFR_ORDER: CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function sublevelIndex(l: CEFR): number {
  return CEFR_ORDER.indexOf(l);
}

// ───────── Function-word lists (top-50 per language) ─────────
// Hand-picked high-frequency words. Drives the "texture" heuristic — A1
// text tends to be saturated with function words; C1+ drops a larger
// share of noun/verb mass into content words.

const FUNCTION_WORDS_EN = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'is', 'are', 'was', 'were', 'been',
]);

const FUNCTION_WORDS_ES = new Set([
  'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se',
  'no', 'haber', 'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le',
  'lo', 'todo', 'pero', 'más', 'mas', 'hacer', 'o', 'poder', 'decir', 'este',
  'ir', 'otro', 'ese', 'la', 'si', 'me', 'ya', 'ver', 'porque', 'dar',
  'cuando', 'él', 'el', 'muy', 'sin', 'vez', 'mucho', 'saber', 'qué', 'que',
  'es', 'son', 'fue', 'era',
]);

const FUNCTION_WORDS_FR = new Set([
  'le', 'de', 'un', 'être', 'et', 'à', 'a', 'il', 'avoir', 'ne',
  'je', 'son', 'que', 'se', 'qui', 'ce', 'dans', 'en', 'du', 'elle',
  'au', 'pour', 'pas', 'que', 'vous', 'par', 'sur', 'faire', 'plus', 'dire',
  'me', 'on', 'mon', 'lui', 'nous', 'comme', 'mais', 'pouvoir', 'avec', 'tout',
  'y', 'aller', 'voir', 'en', 'bien', 'où', 'ou', 'sans', 'tu', 'autre',
]);

const FUNCTION_WORDS_DE = new Set([
  'der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich',
  'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als',
  'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach',
  'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über',
  'einen', 'so', 'zum', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur',
]);

const FUNCTION_WORDS_IT = new Set([
  'il', 'di', 'che', 'e', 'la', 'a', 'in', 'un', 'per', 'è',
  'non', 'con', 'si', 'da', 'una', 'su', 'le', 'sono', 'come', 'lo',
  'mi', 'ma', 'al', 'essere', 'hanno', 'anche', 'nel', 'della', 'avere', 'ti',
  'dei', 'ci', 'suo', 'se', 'più', 'piu', 'lei', 'del', 'lui', 'loro',
  'cosa', 'questo', 'ho', 'alla', 'ne', 'gli', 'molto', 'dove', 'quando', 'o',
]);

const FUNCTION_WORDS_PT = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para',
  'com', 'não', 'nao', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais',
  'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'à', 'seu', 'sua',
  'ou', 'quando', 'muito', 'nos', 'já', 'ja', 'eu', 'também', 'tambem', 'só',
  'so', 'pelo', 'pela', 'até', 'ate', 'isso', 'ela', 'entre', 'depois', 'sem',
]);

function functionSetFor(lang: string): Set<string> {
  const code = lang.toLowerCase().slice(0, 2);
  switch (code) {
    case 'es': return FUNCTION_WORDS_ES;
    case 'fr': return FUNCTION_WORDS_FR;
    case 'de': return FUNCTION_WORDS_DE;
    case 'it': return FUNCTION_WORDS_IT;
    case 'pt': return FUNCTION_WORDS_PT;
    default: return FUNCTION_WORDS_EN;
  }
}

// ───────── Script detection ─────────

const NON_LATIN_CODES = new Set(['ja', 'ko', 'zh', 'ar', 'hi', 'ru', 'th']);

function isNonLatin(lang: string): boolean {
  const code = lang.toLowerCase().slice(0, 2);
  // For full-name inputs (e.g. "Japanese"), map to code first.
  const fullNameMap: Record<string, string> = {
    japanese: 'ja', korean: 'ko', chinese: 'zh', arabic: 'ar',
    hindi: 'hi', russian: 'ru', thai: 'th',
  };
  const name = lang.toLowerCase();
  const effective = fullNameMap[name] ?? code;
  return NON_LATIN_CODES.has(effective);
}

// ───────── Metric extraction ─────────

function splitSentences(text: string): string[] {
  // Basic sentence splitter: split on [.?!。！？] followed by whitespace or end.
  return text
    .split(/[.?!。！？]+(?:\s+|$)/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function tokenizeLatin(text: string): string[] {
  // Preserve Unicode letters (covers é, ß, etc.) but drop punctuation/digits.
  return text
    .toLowerCase()
    .split(/[^\p{L}'’-]+/u)
    .filter((t) => t.length > 0);
}

function assessLatin(text: string, language: string): LevelAssessment {
  const sentences = splitSentences(text);
  const tokens = tokenizeLatin(text);
  const fnSet = functionSetFor(language);

  const avgWordLen = tokens.length
    ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length
    : 0;
  const avgSentenceLen = sentences.length
    ? tokens.length / sentences.length
    : tokens.length;
  const fnCount = tokens.filter((t) => fnSet.has(t)).length;
  const functionWordRatio = tokens.length ? fnCount / tokens.length : 0;

  // ── Scoring (0..1 per metric, higher = harder) ────────────
  //
  // Thresholds informed by research.md §6.1 readability bands:
  //   avgWordLen: A1 ≤4.5, A2 4.5-4.8, B1 4.8-5.2, B2 5.2-5.5, C1 5.5-5.8, C2 ≥5.8
  //   avgSentLen: A1 ≤8,   A2 8-11,    B1 11-15,   B2 15-18,   C1 18-22,   C2 ≥22
  //   fnRatio:    A1 ≥0.48, A2 0.45-0.48, B1 0.42-0.45, B2 0.38-0.42, C1 0.33-0.38, C2 ≤0.33
  //
  // Easier text → higher fnRatio, lower avgWordLen, lower avgSentLen.

  const wordLenScore = clamp01((avgWordLen - 4.2) / (6.0 - 4.2));
  const sentLenScore = clamp01((avgSentenceLen - 6) / (24 - 6));
  const fnScore = clamp01((0.5 - functionWordRatio) / (0.5 - 0.3));

  // Weighted combine — sentence length is the strongest single signal per
  // research.md §6.1 Table 3; word length a close second; fn-ratio tiebreaker.
  const combined = wordLenScore * 0.35 + sentLenScore * 0.45 + fnScore * 0.2;

  const detectedLevel = scoreToCefr(combined);

  // Confidence: how far we are from the nearest band boundary.
  // Boundaries at 0.17, 0.33, 0.5, 0.67, 0.83.
  const boundaries = [0.17, 0.33, 0.5, 0.67, 0.83];
  const minDist = Math.min(...boundaries.map((b) => Math.abs(b - combined)));
  const confidence = clamp01(minDist / 0.17);

  return {
    detectedLevel,
    confidence,
    metrics: { avgWordLen, avgSentenceLen, functionWordRatio },
  };
}

/**
 * Non-Latin fallback. Word-length is meaningless; we lean on sentence length
 * and total character count as a density proxy.
 */
function assessNonLatin(text: string): LevelAssessment {
  const sentences = splitSentences(text);
  const chars = Array.from(text.replace(/\s+/g, '')).length;
  const avgSentenceLen = sentences.length ? chars / sentences.length : chars;

  // For CJK: A1 ≈ ≤15 chars/sentence, C1+ ≈ ≥50. Coarse.
  const sentLenScore = clamp01((avgSentenceLen - 12) / (55 - 12));
  const combined = sentLenScore;

  return {
    detectedLevel: scoreToCefr(combined),
    // Lower confidence: we're ignoring 2 of 3 features.
    confidence: clamp01(Math.min(...[0.17, 0.33, 0.5, 0.67, 0.83].map((b) => Math.abs(b - combined))) / 0.17) * 0.6,
    metrics: {
      avgWordLen: 0,
      avgSentenceLen,
      functionWordRatio: 0,
    },
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function scoreToCefr(score: number): CEFR {
  // 6 equal bands — A1 at bottom, C2 at top.
  if (score < 0.17) return 'A1';
  if (score < 0.33) return 'A2';
  if (score < 0.5) return 'B1';
  if (score < 0.67) return 'B2';
  if (score < 0.83) return 'C1';
  return 'C2';
}

// ───────── Public API ─────────

export function assessContentLevel(text: string, language: string): LevelAssessment {
  if (!text || text.trim().length === 0) {
    return {
      detectedLevel: 'A1',
      confidence: 0,
      metrics: { avgWordLen: 0, avgSentenceLen: 0, functionWordRatio: 0 },
    };
  }

  if (isNonLatin(language)) {
    return assessNonLatin(text);
  }
  return assessLatin(text, language);
}

export function validateContentLevel(
  text: string,
  language: string,
  targetLevel: CEFR,
  opts?: { functionName?: string; warnDelta?: number },
): LevelValidation {
  const assessment = assessContentLevel(text, language);
  const detected = assessment.detectedLevel;
  const delta = sublevelIndex(detected) - sublevelIndex(targetLevel);
  // Warn-only posture: always "in range" from a control-flow perspective.
  // The consumer should ignore this flag for blocking — we only emit a warn.
  const inRange = Math.abs(delta) <= 1;

  const warnDelta = opts?.warnDelta ?? 2;
  if (Math.abs(delta) >= warnDelta) {
    console.warn(JSON.stringify({
      evt: 'level_warn',
      fn: opts?.functionName,
      language,
      targetLevel,
      detected,
      delta,
      ts: new Date().toISOString(),
    }));
  }

  return { inRange, detected, delta };
}
