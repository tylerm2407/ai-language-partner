/**
 * Parsing the phrase-help model reply. Pure, so parse.test.ts covers the
 * shapes the model produces: a clean object, one inside code fences, one
 * with prose around it, and one with a half missing.
 *
 * Both halves are required and both are capped. Over the cap is null rather
 * than truncated: a 120-character "phrase" is a paragraph, not one way to say
 * the thing, and a gloss cut mid-word reads as a bug. The caller answers 502
 * on null and the learner can ask again with a shorter request.
 */

export interface PhraseHelp {
  phrase: string;
  gloss: string;
}

export const MAX_PHRASE_CHARS = 120;
export const MAX_GLOSS_CHARS = 160;

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parsePhraseHelp(text: string): PhraseHelp | null {
  if (typeof text !== 'string') return null;
  const cleaned = stripFences(text);
  let obj = tryParse(cleaned);
  if (!obj) {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) obj = tryParse(cleaned.slice(first, last + 1));
  }
  if (!obj) return null;

  const phrase = typeof obj.phrase === 'string' ? obj.phrase.trim() : '';
  const gloss = typeof obj.gloss === 'string' ? obj.gloss.trim() : '';
  if (!phrase || !gloss) return null;
  if (phrase.length > MAX_PHRASE_CHARS || gloss.length > MAX_GLOSS_CHARS) return null;
  return { phrase, gloss };
}
