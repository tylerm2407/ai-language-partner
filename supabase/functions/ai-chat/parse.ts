/**
 * Response parsing for ai-chat.
 *
 * Split out of index.ts for the same reason prompt.ts was: index.ts calls
 * serve() at module scope, so importing it from a test would stand up an HTTP
 * listener. This file is pure — no Deno APIs, no network — so parse.test.ts can
 * exercise every shape the model has ever actually returned.
 */

export type CorrectionErrorType =
  | 'grammar' | 'vocabulary' | 'spelling' | 'word_order' | 'tense' | 'gender' | 'other';
export type CorrectionSeverity = 'minor' | 'moderate' | 'critical';

export interface CorrectionDetail {
  shortLabel: string;
  explanation: string;
  original: string;
  corrected: string;
  errorType: CorrectionErrorType;
  severity: CorrectionSeverity;
  example?: string | null;
  repetitionCount?: number;
}

export interface ParsedAIResponse {
  reply: string;
  correction: CorrectionDetail | null;
  vocabularyHighlights: VocabHighlight[];
  /**
   * Native-language gloss of `reply`, generated in the SAME model call.
   *
   * Null whenever the model did not supply one, and that is a normal state,
   * not an error: the safety fallback reply has no gloss, output the model
   * truncated has no gloss, and a cached/queued turn generated before this
   * field existed has no gloss either. The client falls back to the `translate`
   * function in exactly those cases, so a missing gloss costs a round trip —
   * it never costs the feature.
   */
  gloss: string | null;
}

/**
 * Hard cap on the gloss we will relay.
 *
 * The prompt asks for one sentence of at most 25 words; this is the backstop
 * for a model that ignores it. It is a caption under a chat bubble, so past
 * this point it is not a gloss any more and there is no reason to ship it.
 */
export const MAX_GLOSS_CHARS = 300;

export function normalizeGloss(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_GLOSS_CHARS ? trimmed.slice(0, MAX_GLOSS_CHARS).trim() : trimmed;
}

export function normalizeCorrection(raw: unknown): CorrectionDetail | null {
  if (raw == null) return null;
  // Legacy / fallback: AI sometimes emits a plain string in the correction
  // field despite the schema instructions.
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      shortLabel: trimmed.slice(0, 60),
      explanation: trimmed,
      original: '',
      corrected: '',
      errorType: 'other',
      severity: 'moderate',
      example: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const explanation = typeof obj.explanation === 'string' ? obj.explanation : '';
  const shortLabel =
    typeof obj.shortLabel === 'string' && obj.shortLabel.trim()
      ? obj.shortLabel.slice(0, 80)
      : explanation.slice(0, 80) || 'Correction';
  const original = typeof obj.original === 'string' ? obj.original : '';
  const corrected = typeof obj.corrected === 'string' ? obj.corrected : '';
  const errorTypeRaw = obj.errorType;
  const errorType: CorrectionErrorType =
    typeof errorTypeRaw === 'string' &&
    ['grammar','vocabulary','spelling','word_order','tense','gender','other'].includes(errorTypeRaw)
      ? (errorTypeRaw as CorrectionErrorType)
      : 'other';
  const severityRaw = obj.severity;
  const severity: CorrectionSeverity =
    typeof severityRaw === 'string' && ['minor','moderate','critical'].includes(severityRaw)
      ? (severityRaw as CorrectionSeverity)
      : 'moderate';
  const example = obj.example == null || obj.example === '' ? null : String(obj.example);
  if (!explanation && !original && !corrected) return null;
  return { shortLabel, explanation, original, corrected, errorType, severity, example };
}

/** Cap on a highlighted word/translation, moved here with normalizeVocabulary. */
const MAX_VOCAB_CHARS = 60;

export interface VocabHighlight {
  word: string;
  translation: string;
}

export function normalizeVocabulary(raw: unknown): VocabHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: VocabHighlight[] = [];
  for (const entry of raw.slice(0, 8)) {
    if (typeof entry === 'string') {
      const word = entry.trim();
      if (word && word.length <= MAX_VOCAB_CHARS) out.push({ word, translation: '' });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const word = String((entry as Record<string, unknown>).word ?? '').trim();
      const translation = String((entry as Record<string, unknown>).translation ?? '').trim();
      if (word && word.length <= MAX_VOCAB_CHARS) {
        out.push({ word, translation: translation.slice(0, 200) });
      }
    }
  }
  return out;
}

export function parseAIResponse(text: string): ParsedAIResponse {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: parsed.reply ?? text,
      correction: normalizeCorrection(parsed.correction),
      vocabularyHighlights: normalizeVocabulary(parsed.vocabularyHighlights),
      gloss: normalizeGloss(parsed.gloss),
    };
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        return {
          reply: parsed.reply ?? text,
          correction: normalizeCorrection(parsed.correction),
          vocabularyHighlights: normalizeVocabulary(parsed.vocabularyHighlights),
          gloss: normalizeGloss(parsed.gloss),
        };
      } catch {
        // fall through
      }
    }
    // Neither shape parsed as JSON. Everything below is pre-JSON-era output,
    // which never carried a gloss — so gloss stays null and the client
    // translates on demand, exactly as it did before this field existed.
    const correctionMarker = '[CORRECTION]:';
    const index = text.indexOf(correctionMarker);
    if (index === -1) {
      return { reply: text.trim(), correction: null, vocabularyHighlights: [], gloss: null };
    }
    const reply = text.substring(0, index).trim();
    const correction = text.substring(index + correctionMarker.length).trim();
    return {
      reply,
      correction: normalizeCorrection(correction),
      vocabularyHighlights: [],
      gloss: null,
    };
  }
}
