/**
 * The word-lookup chain behind tapping a word in the reader.
 *
 * Pure and RN-free — every dependency is injected — so the tier order and the
 * quota-exhaustion behaviour can be tested without AsyncStorage or a network
 * (see word-lookup.test.ts). The hook that wires the real dependencies in is
 * hooks/useWordLookup.ts.
 *
 * Four tiers, first hit wins, cheapest first:
 *
 *   1. session      — an in-memory Map for the current reader. Re-tapping the
 *                     same word is instant and never leaves the device.
 *   2. annotations  — `book_annotations` rows, already loaded with the book.
 *                     Free, and the only source of part of speech and audio.
 *                     Covers the 28 AI-generated stories; the 10,231 imported
 *                     Gutenberg books have none, which is the whole reason the
 *                     tiers below exist.
 *   3. device cache — AsyncStorage via lib/read-cache.ts, keyed on
 *                     (source, target, word) and deliberately NOT on the book
 *                     or the user: a word learned in one book is free in every
 *                     other, and there is nothing personal in it.
 *   4. network      — the `translate` edge function with purpose 'word_lookup'.
 *                     Server-side it hits a `translation_cache` shared by every
 *                     learner, and only a miss there spends quota.
 */

import { readCacheKey } from './read-cache';
import { normalizeWord } from './reading-text';
import type { AnnotationCardSource } from './supabase-queries';
import type { BookAnnotation, WordLookup } from '../types';

/** Where a lookup came from. Surfaced so the tooltip can show audio and part
 *  of speech only when they actually exist. */
export type LookupSource = WordLookup['source'];

export interface WordLookupDeps {
  /** Session-scoped memo. Mutated in place; the caller owns its lifetime. */
  session: Map<string, WordLookup>;
  /** Annotations already loaded with the book, keyed by normalised word. */
  annotations: Map<string, BookAnnotation>;
  getCached: (key: string) => Promise<WordLookup | null>;
  setCached: (key: string, value: WordLookup) => Promise<void>;
  translate: (word: string) => Promise<string>;
}

export interface WordLookupRequest {
  /** The raw tapped token, punctuation and all. */
  raw: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export type WordLookupResult =
  | { ok: true; lookup: WordLookup }
  /** The word normalised to nothing — punctuation, a dash, a stray numeral. */
  | { ok: false; reason: 'not_a_word' }
  /** Out of lookups for today. Settled until midnight; do not retry. */
  | { ok: false; reason: 'quota'; message: string }
  /** Anything else. Worth a retry. */
  | { ok: false; reason: 'failed'; message: string };

/** Server codes that mean "this will not succeed again today". */
const QUOTA_CODES = new Set([
  'DAILY_WORD_LOOKUP_LIMIT_REACHED',
  'DAILY_TRANSLATION_LIMIT_REACHED',
]);

export function isQuotaError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && QUOTA_CODES.has(code);
}

/** Device-cache key. Not book- or user-scoped, on purpose — see the header. */
export function wordCacheKey(
  sourceLanguage: string,
  targetLanguage: string,
  word: string,
): string {
  return readCacheKey('wordxl', sourceLanguage, targetLanguage, word);
}

/**
 * Run the chain for one tapped token.
 *
 * A failure is never written to any cache: caching "couldn't translate" would
 * make one bad minute permanent for that word on that device.
 */
export async function lookupWord(
  { raw, sourceLanguage, targetLanguage }: WordLookupRequest,
  deps: WordLookupDeps,
): Promise<WordLookupResult> {
  const word = normalizeWord(raw);
  if (!word) return { ok: false, reason: 'not_a_word' };

  const fromSession = deps.session.get(word);
  if (fromSession) return { ok: true, lookup: fromSession };

  const annotation = deps.annotations.get(word);
  if (annotation) {
    const lookup: WordLookup = {
      word,
      translation: annotation.translation,
      partOfSpeech: annotation.partOfSpeech,
      audioUrl: annotation.audioUrl,
      source: 'annotation',
    };
    deps.session.set(word, lookup);
    return { ok: true, lookup };
  }

  const key = wordCacheKey(sourceLanguage, targetLanguage, word);
  const cached = await deps.getCached(key);
  if (cached) {
    deps.session.set(word, cached);
    return { ok: true, lookup: cached };
  }

  let translation: string;
  try {
    translation = await deps.translate(word);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return isQuotaError(err)
      ? { ok: false, reason: 'quota', message }
      : { ok: false, reason: 'failed', message };
  }

  const trimmed = translation.trim();
  if (!trimmed) {
    return { ok: false, reason: 'failed', message: 'No translation available.' };
  }

  const lookup: WordLookup = {
    word,
    translation: trimmed,
    partOfSpeech: null,
    audioUrl: null,
    source: 'translated',
  };
  deps.session.set(word, lookup);
  await deps.setCached(key, lookup);
  return { ok: true, lookup };
}

/** Build the annotation map the chain expects from the rows already loaded. */
export function annotationMap(annotations: BookAnnotation[]): Map<string, BookAnnotation> {
  const map = new Map<string, BookAnnotation>();
  for (const a of annotations) {
    const key = normalizeWord(a.wordOrPhrase);
    // Single words only. `book_annotations` also carries phrases, which the
    // old reader matched with a longest-phrase-first scan; a per-word tap has
    // no way to select a phrase, so those are simply not reachable here.
    if (key && !/\s/.test(key)) map.set(key, a);
  }
  return map;
}

/**
 * Adapt a lookup for `addCardFromAnnotation`, so a tapped word can become an
 * SRS card by the same path — and under the same daily new-card cap — as an
 * annotation always could.
 */
export function cardSourceFromLookup(lookup: WordLookup): AnnotationCardSource {
  return {
    wordOrPhrase: lookup.word,
    translation: lookup.translation,
    audioUrl: lookup.audioUrl,
    partOfSpeech: lookup.partOfSpeech,
  };
}
