/**
 * Input validation utilities for Edge Functions.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export const VALID_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export function isValidCefrLevel(level: string): boolean {
  return VALID_CEFR_LEVELS.includes(level as typeof VALID_CEFR_LEVELS[number]);
}

export const VALID_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh',
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese',
] as const;

export function isValidLanguage(lang: string): boolean {
  return VALID_LANGUAGES.includes(lang as typeof VALID_LANGUAGES[number]);
}

export const VALID_PROFICIENCY_LEVELS = [
  'beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced',
] as const;

export function isValidProficiencyLevel(level: string): boolean {
  return VALID_PROFICIENCY_LEVELS.includes(level as typeof VALID_PROFICIENCY_LEVELS[number]);
}

/** Limit string length to prevent prompt injection payloads. */
export function sanitizeText(text: string, maxLength: number): string {
  return text.slice(0, maxLength).trim();
}

/** Max base64 audio size: 10MB */
export const MAX_AUDIO_BASE64_SIZE = 10 * 1024 * 1024;
