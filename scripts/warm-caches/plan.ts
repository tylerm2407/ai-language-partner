/**
 * Turning curriculum rows into a list of things to generate — and, crucially,
 * into a much shorter list once everything already cached is removed.
 *
 * Pure: rows in, work items out. No network, no Supabase. That is what makes
 * the resume behaviour testable, and resume is the whole safety property of
 * this script. It must be re-runnable after new curriculum lands without
 * re-paying for the old curriculum, and it must be re-runnable after a crash
 * halfway through without re-paying for the half that succeeded.
 */

import { normalizeWord } from '../../lib/reading-text';
import {
  checkSpan,
  hintCacheKey,
  lessonAudioPath,
  lessonFishVoiceId,
  translationCacheKey,
  explanationCacheKey,
  type FishVoiceMap,
} from './keys';
import { utf8Bytes } from './cost';

export type CacheName = 'translation' | 'hint' | 'tts' | 'explanation';

/** Every cache this script knows how to warm, in the order it reports them. */
export const ALL_CACHES: readonly CacheName[] = ['translation', 'hint', 'tts', 'explanation'];

export interface WorkItem {
  cache: CacheName;
  /** Identity within the cache. Dedupes a run and matches the skip set. */
  key: string;
  /** One line for the dry run — what would be generated, in what language. */
  label: string;
}

export interface TranslationItem extends WorkItem {
  cache: 'translation';
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** Which caller's form this is: the literal card text, or the reader's
   *  normalised tap form. Both hash to different keys; both get asked for. */
  form: 'literal' | 'normalized';
}

export interface HintItem extends WorkItem {
  cache: 'hint';
  cardId: string;
  exerciseType: string;
  targetLanguage: string;
  card: {
    target_text: string;
    native_text: string;
    part_of_speech: string | null;
    example_sentence: string | null;
    cefr_level: string | null;
  };
}

export interface TtsItem extends WorkItem {
  cache: 'tts';
  /** The bucket path. Also the key. */
  path: string;
  /** Exactly what goes to fish.audio — citation form already applied. */
  sentText: string;
  language: string;
  voiceId: string;
  /** UTF-8 bytes of `sentText`. The fish.audio billing unit. */
  bytes: number;
}

export interface ExplanationItem extends WorkItem {
  cache: 'explanation';
  span: string;
  language: string;
  nativeLanguage: string;
  cefrLevel: string;
}

// ─── Resume ──────────────────────────────────────────────────────────────

export interface SkipResult<T extends WorkItem> {
  /** What is left to generate, in input order, each key appearing once. */
  items: T[];
  /** Dropped because the cache already holds them. */
  alreadyCached: number;
  /** Dropped because an earlier candidate in this same run has the same key. */
  duplicates: number;
}

/**
 * The resume rule, in one place: drop anything already cached, then drop
 * anything this run has already planned.
 *
 * `seen` is only written for items that are KEPT, which is what makes the two
 * counters mean what an operator reads them as: `alreadyCached` counts every
 * candidate the cache can already serve, and `duplicates` counts only the
 * repeats this run would otherwise have paid for twice. A pair of identical
 * candidates that are both already cached is two cache hits and no duplicate,
 * which is the honest description of that pair.
 *
 * It is a named function rather than a `filter` at each of the four call
 * sites because this is the entire safety property of a re-runnable spending
 * script, and four copies of it would be four chances to get it wrong.
 */
export function dedupeAndSkip<T extends WorkItem>(
  candidates: readonly T[],
  existing: ReadonlySet<string>,
): SkipResult<T> {
  const items: T[] = [];
  const seen = new Set<string>();
  let alreadyCached = 0;
  let duplicates = 0;

  for (const candidate of candidates) {
    if (existing.has(candidate.key)) {
      alreadyCached++;
      continue;
    }
    if (seen.has(candidate.key)) {
      duplicates++;
      continue;
    }
    seen.add(candidate.key);
    items.push(candidate);
  }

  return { items, alreadyCached, duplicates };
}

// ─── Candidate builders ──────────────────────────────────────────────────

export interface CardRow {
  id: string;
  language: string | null;
  target_text: string;
  native_text: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  cefr_level: string | null;
}

/**
 * Translations of curriculum vocabulary into the learner's native language.
 *
 * Two forms per card, because two callers ask for two different strings and
 * the cache key is the string:
 *
 *   - `literal`    — `target_text` trimmed, which is what a chat-side
 *                    translate of that exact line would hash to. The edge
 *                    function slices to 1500 chars and trims before hashing,
 *                    so this mirrors that.
 *   - `normalized` — `normalizeWord(target_text)`, which is what the READER
 *                    sends when a learner taps that word (lib/word-lookup.ts
 *                    normalises before calling). Without this the reader never
 *                    hits a single warmed row, whatever the literal form cost.
 *
 * The normalised form is only offered for single-token cards: the reader taps
 * one token, so a lowercased multi-word phrase is a string nothing will ever
 * request. Identical forms collapse in `dedupeAndSkip` and cost nothing.
 *
 * Cards already in the native language are dropped — `translate` short-circuits
 * when source equals target and never writes a row for them.
 */
export async function planTranslations(
  cards: readonly CardRow[],
  nativeLanguage: string,
): Promise<TranslationItem[]> {
  const out: TranslationItem[] = [];

  for (const card of cards) {
    const language = card.language;
    if (!language || language === nativeLanguage) continue;

    const literal = card.target_text.slice(0, 1500).trim();
    if (!literal) continue;

    const forms: [string, TranslationItem['form']][] = [[literal, 'literal']];
    if (!/\s/.test(literal)) {
      const normalized = normalizeWord(literal);
      if (normalized && normalized !== literal) forms.push([normalized, 'normalized']);
    }

    for (const [text, form] of forms) {
      out.push({
        cache: 'translation',
        key: await translationCacheKey(text, language, nativeLanguage),
        label: `${language}→${nativeLanguage} ${JSON.stringify(text)}`,
        text,
        sourceLanguage: language,
        targetLanguage: nativeLanguage,
        form,
      });
    }
  }

  return out;
}

export interface ExerciseCardRow {
  card_id: string;
  type: string;
  language: string;
  card: CardRow;
}

/**
 * Generic hints, one per (card, exercise type) — exactly the key `get-hint`
 * reads and writes.
 *
 * Only exercises that actually carry a `card_id` are candidates: `get-hint`
 * takes a cardId and validates it as a UUID, so an exercise without one can
 * never produce a request that would hit these rows.
 */
export function planHints(rows: readonly ExerciseCardRow[]): HintItem[] {
  return rows.map((row) => ({
    cache: 'hint' as const,
    key: hintCacheKey(row.card_id, row.type),
    label: `${row.language} ${row.type} ${JSON.stringify(row.card.target_text)}`,
    cardId: row.card_id,
    exerciseType: row.type,
    targetLanguage: row.language,
    card: {
      target_text: row.card.target_text,
      native_text: row.card.native_text,
      part_of_speech: row.card.part_of_speech,
      example_sentence: row.card.example_sentence,
      cefr_level: row.card.cefr_level,
    },
  }));
}

export interface AudioPromptRow {
  prompt: string;
  language: string;
  type: string;
}

export interface TtsPlan {
  items: TtsItem[];
  /** Languages fish has no vetted voice for. Reported, not silently dropped. */
  unwarmableLanguages: string[];
}

/**
 * Lesson-purpose clips for every prompt the app synthesises through
 * `lib/lesson-audio.ts` — which always asks for `voiceIndex: 0` and never a
 * gender, so there is exactly one canonical object per (language, prompt).
 */
export async function planTts(
  rows: readonly AudioPromptRow[],
  fishVoiceMap: FishVoiceMap,
  rate?: number,
): Promise<TtsPlan> {
  const items: TtsItem[] = [];
  const unwarmable = new Set<string>();

  for (const row of rows) {
    const prompt = row.prompt?.trim();
    if (!prompt) continue;

    const voiceId = lessonFishVoiceId(row.language, fishVoiceMap);
    if (!voiceId) {
      unwarmable.add(row.language);
      continue;
    }

    const { path, sentText } = await lessonAudioPath({
      text: prompt,
      language: row.language,
      voiceId,
      rate,
    });

    items.push({
      cache: 'tts',
      key: path,
      label: `${row.language} ${row.type} ${JSON.stringify(sentText)}`,
      path,
      sentText,
      language: row.language,
      voiceId,
      bytes: utf8Bytes(sentText),
    });
  }

  return { items, unwarmableLanguages: [...unwarmable].sort() };
}

export interface PassageParagraph {
  span: string;
  language: string;
  cefrLevel: string;
  passageTitle: string;
}

/**
 * Paragraph explanations for the published reading passages.
 *
 * The spans are produced by the reader's own `splitParagraphs` and filtered by
 * the edge function's own `checkSpan` — a paragraph the function would refuse
 * as too short or too long is not a paragraph anyone can ask about, so warming
 * it would buy a row no request can reach.
 */
export async function planExplanations(
  paragraphs: readonly PassageParagraph[],
  nativeLanguage: string,
): Promise<ExplanationItem[]> {
  const out: ExplanationItem[] = [];

  for (const p of paragraphs) {
    const span = checkSpan(p.span);
    if (!span.ok) continue;

    out.push({
      cache: 'explanation',
      key: await explanationCacheKey(p.language, nativeLanguage, p.cefrLevel, span.span),
      label: `${p.language} ${p.cefrLevel} ${JSON.stringify(p.passageTitle)} — ${span.span.slice(0, 60)}…`,
      span: span.span,
      language: p.language,
      nativeLanguage,
      cefrLevel: p.cefrLevel,
    });
  }

  return out;
}
