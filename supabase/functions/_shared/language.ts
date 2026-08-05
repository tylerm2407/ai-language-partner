/**
 * Language-code helpers shared by edge functions.
 *
 * Lives outside `transcribe/index.ts` so it can be unit tested — that module
 * calls `serve()` at import time and can't be imported from a test.
 */

/** The languages the app supports (mirrors `LanguageCode` in types/index.ts). */
const WHISPER_LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  arabic: 'ar',
  hindi: 'hi',
  russian: 'ru',
};

const SUPPORTED_CODES = new Set(Object.values(WHISPER_LANGUAGE_CODES));

/**
 * Normalise Whisper's detected language to an app language code.
 *
 * Whisper's `verbose_json` reports an English language *name* ("spanish"), but
 * has been observed returning a bare code too, so both are accepted. Returns
 * null for anything unrecognised — including languages the app doesn't teach —
 * so callers can fall back rather than pass an unsupported code downstream.
 */
export function toLanguageCode(detected: unknown): string | null {
  if (typeof detected !== 'string') return null;
  const key = detected.trim().toLowerCase();
  if (SUPPORTED_CODES.has(key)) return key;
  return WHISPER_LANGUAGE_CODES[key] ?? null;
}
