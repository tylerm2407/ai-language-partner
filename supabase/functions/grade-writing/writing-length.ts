/**
 * Length of a piece of learner writing, in units the language actually has.
 *
 * TWIN: lib/writing-length.ts (the client copy). The edge function cannot
 * import from lib/ (tsconfig excludes supabase/functions and Deno has no path
 * into the app tree), so the counting logic is duplicated here. Everything
 * below this header must stay byte-identical in the two files; the
 * `writing-length.test.ts` beside each copy reads both files and fails if it
 * is not. Deno ships full ICU, so on the server `method` is `intl_segmenter`
 * for ja/zh and `whitespace` otherwise; `unavailable` is kept so the fallback
 * path is the same code the client runs.
 */
export type WritingLengthUnit = 'word' | 'segment' | 'character';
export type WritingCountMethod = 'whitespace' | 'intl_segmenter' | 'unavailable';

export interface WritingLengthCount {
  count: number;
  unit: WritingLengthUnit;
  method: WritingCountMethod;
}

/**
 * Languages written without inter-word spaces, where whitespace counting is
 * wrong. Keyed by primary subtag, so every region and script variant lands
 * here. A Map rather than an object literal: `'constructor' in {}` is true, and
 * an inherited key must never look like a supported language.
 */
const SEGMENTED_LOCALES = new Map<string, string>([
  ['ja', 'ja'],
  ['zh', 'zh'],
]);

/**
 * Primary subtag, lowercased. `zh-CN`, `zh_Hans_CN` and `JA` name the same
 * languages as `zh` and `ja`; matching the raw code sent them down the
 * whitespace path instead, which returns 1 for a whole Chinese paragraph — the
 * exact number this module exists to stop reporting. Normalising here means
 * every caller gets it, whatever shape of code it holds.
 */
export function normalizeLanguageCode(language: string | null | undefined): string | null {
  if (typeof language !== 'string') return null;
  const primary = language.trim().split(/[-_]/, 1)[0].toLowerCase();
  return primary.length > 0 ? primary : null;
}

interface WordSegment {
  segment: string;
  isWordLike?: boolean;
}
interface WordSegmenter {
  segment(text: string): Iterable<WordSegment>;
}
type WordSegmenterCtor = new (locale: string, options: { granularity: 'word' }) => WordSegmenter;

const segmenterCache = new Map<string, WordSegmenter>();

/** Resolved at call time, never at import, so a runtime without the API and a
 * test that removes it both take the honest path. */
function findSegmenter(): WordSegmenterCtor | null {
  const intl: { Segmenter?: unknown } = Intl;
  return typeof intl.Segmenter === 'function' ? (intl.Segmenter as WordSegmenterCtor) : null;
}

function segmenterFor(locale: string): WordSegmenter | null {
  const Ctor = findSegmenter();
  if (!Ctor) return null;
  const cached = segmenterCache.get(locale);
  if (cached) return cached;
  const segmenter = new Ctor(locale, { granularity: 'word' });
  segmenterCache.set(locale, segmenter);
  return segmenter;
}

export function isSegmentedLanguage(language: string | null | undefined): boolean {
  const code = normalizeLanguageCode(language);
  return code !== null && SEGMENTED_LOCALES.has(code);
}

function countWhitespaceWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Letters, marks and digits only: punctuation and spaces are not length. */
function countCharacters(text: string): number {
  return (text.match(/[\p{L}\p{M}\p{N}]/gu) ?? []).length;
}

export function countWritingUnits(text: string, language: string | null | undefined): WritingLengthCount {
  const locale = SEGMENTED_LOCALES.get(normalizeLanguageCode(language) ?? '');
  if (locale === undefined) {
    return { count: countWhitespaceWords(text), unit: 'word', method: 'whitespace' };
  }
  const segmenter = segmenterFor(locale);
  if (!segmenter) {
    return { count: countCharacters(text), unit: 'character', method: 'unavailable' };
  }
  let count = 0;
  for (const part of segmenter.segment(text)) {
    if (part.isWordLike) count += 1;
  }
  return { count, unit: 'segment', method: 'intl_segmenter' };
}
