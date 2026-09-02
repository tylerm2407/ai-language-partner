/**
 * The cache keys, imported from the edge functions rather than reinvented.
 *
 * This is the single most failure-prone part of warming a cache, and the
 * failure is silent: a key that differs from the reader's by one byte writes
 * rows and objects that nothing will ever look for. Nothing errors. The cache
 * hit rate simply stays at zero and the bill never drops — which is precisely
 * the outcome the whole exercise exists to prevent.
 *
 * So every key below is either
 *   (a) an import of the exact function the edge function calls, or
 *   (b) where the edge function's copy is unreachable from Node (it lives
 *       inside a module that calls `serve()` and reads `Deno.env` at import
 *       time), a mirror that keys.test.ts pins against the edge function's
 *       SOURCE TEXT, so drift fails a test instead of failing in production.
 *
 * The imports are extensionless on purpose: `tsc` and jest both resolve them
 * to the `.ts` files, and the edge functions' own `.ts`-suffixed specifiers
 * would not typecheck here.
 */

// (a) Imported from the enforcing implementation ──────────────────────────

/** `translation_cache.hash` — supabase/functions/translate/cache-key.ts */
export { cacheKey as translationCacheKey } from '../../supabase/functions/translate/cache-key';

/** `explanation_cache.hash` and its span rules — explain-passage/explain-core.ts */
export {
  buildExplainSystemPrompt,
  checkSpan,
  explanationCacheKey,
  MAX_SPAN_CHARS,
  MIN_SPAN_CHARS,
  normalizeSpan,
} from '../../supabase/functions/explain-passage/explain-core';

/** tts-cache object naming — supabase/functions/tts/synthesis.ts */
export {
  asCitationForm,
  cachePathFor,
  DEFAULT_RATE,
  LESSON_PROFILE_VERSION,
  sha256Hex,
  SLOW_RATE,
  ttsContentKey,
} from '../../supabase/functions/tts/synthesis';

import { asCitationForm, cachePathFor, sha256Hex, ttsContentKey } from '../../supabase/functions/tts/synthesis';

// (b) Mirrors of logic inside a module Node cannot import ─────────────────

/**
 * `hint_cache` has no hash: the edge function reads and writes it with
 * `.eq('card_id', cardId).eq('exercise_type', exerciseType)`, so the key is
 * the column pair itself. `::` is a safe separator: a UUID contains no colon
 * and no exercise type does either. This string exists only to dedupe a run and
 * to look rows up in a skip set — it is never stored.
 */
export function hintCacheKey(cardId: string, exerciseType: string): string {
  return `${cardId}::${exerciseType}`;
}

export function parseHintCacheKey(key: string): { cardId: string; exerciseType: string } {
  const [cardId, exerciseType] = key.split('::');
  return { cardId, exerciseType };
}

export type FishVoiceMap = Record<string, Partial<Record<'male' | 'female', string[]>>>;

/**
 * The voice a LESSON clip is rendered with, mirroring tts/index.ts.
 *
 * Three of that function's decisions collapse into one answer here, and all
 * three matter to the key:
 *
 *   1. `lib/lesson-audio.ts` sends `voiceIndex: 0` and never a `voiceGender`.
 *      That is deliberate and documented there — one cached object per word
 *      for every learner, rather than one per learner's gender preference.
 *   2. With no gender asked for, the function picks `female ?? male` from
 *      FISH_VOICE_MAP for the language.
 *   3. fish is used when that list is non-empty; otherwise ElevenLabs, whose
 *      list comes from a VOICE_MAP that is not reachable from here.
 *
 * Returns null for a language fish has no voice for. Warming those would mean
 * reproducing VOICE_MAP as a fourth copy, and the ELEVENLABS_KEY is dead in
 * production anyway — so the script reports them as unwarmable rather than
 * guessing. All nine curriculum languages are in FISH_VOICE_MAP today, so the
 * null branch is currently empty.
 */
export function lessonFishVoiceId(language: string, map: FishVoiceMap): string | null {
  const forLanguage = map[language];
  if (!forLanguage) return null;
  const voices = forLanguage.female ?? forLanguage.male;
  if (!voices || voices.length === 0) return null;
  return voices[0];
}

/**
 * Where a warmed lesson clip must land in the `tts-cache` bucket.
 *
 * `asCitationForm` is applied BEFORE hashing because the edge function applies
 * it before hashing — the cache is keyed on what was actually sent to the
 * provider, not on what the caller passed in.
 */
export async function lessonAudioPath(opts: {
  text: string;
  language: string;
  voiceId: string;
  rate?: number;
}): Promise<{ path: string; sentText: string }> {
  const sentText = asCitationForm(opts.text.replace(/\*\*/g, '').trim());
  const hash = await sha256Hex(
    ttsContentKey({
      provider: 'fish',
      voiceId: opts.voiceId,
      language: opts.language,
      text: sentText,
    }),
  );
  return { path: cachePathFor({ hash, purpose: 'lesson', rate: opts.rate }), sentText };
}
