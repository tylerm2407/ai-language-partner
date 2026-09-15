/**
 * Turning the model's JSON into the phrase list the client renders.
 *
 * Pure — no Deno APIs — so normalize.test.ts can run every shape the model
 * has produced: a clean array, an array inside code fences, an array wrapped
 * in an object, prose around the array, and entries with a half missing.
 *
 * Strict where it matters: an entry missing either half is dropped, not
 * patched, because a phrase without its meaning teaches nothing and a
 * meaning without its phrase is not a phrase. Over-long entries are dropped
 * too — an 80-character "phrase" is a sentence, and the warm-up card has
 * room for a line. The CALLER decides whether what survives is enough
 * (`MIN_PHRASES`); this only guarantees shape.
 */

export interface MissionPhrase {
  phrase: string;
  meaning: string;
}

/** Fewer than this after normalisation is not a warm-up, and the function
 *  answers 502 rather than caching a thin list forever. */
export const MIN_PHRASES = 4;
export const MAX_PHRASES = 6;
export const MAX_PHRASE_CHARS = 80;
export const MAX_MEANING_CHARS = 120;

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

/** The array, from wherever the model put it. Null when there is none. */
function extractArray(text: string): unknown[] | null {
  const cleaned = stripFences(text);
  const candidates = [cleaned];
  const first = cleaned.indexOf('[');
  const last = cleaned.lastIndexOf(']');
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1));
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(cleaned.slice(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { phrases?: unknown }).phrases)) {
        return (parsed as { phrases: unknown[] }).phrases;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export function normalizePhrases(raw: string): MissionPhrase[] {
  const entries = extractArray(typeof raw === 'string' ? raw : '');
  if (!entries) return [];

  const out: MissionPhrase[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const phrase = typeof obj.phrase === 'string' ? obj.phrase.trim() : '';
    const meaning = typeof obj.meaning === 'string' ? obj.meaning.trim() : '';
    if (!phrase || !meaning) continue;
    if (phrase.length > MAX_PHRASE_CHARS || meaning.length > MAX_MEANING_CHARS) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ phrase, meaning });
    if (out.length >= MAX_PHRASES) break;
  }
  return out;
}
