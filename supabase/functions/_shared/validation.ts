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
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru',
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese', 'Russian',
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

/**
 * Exercise types accepted from clients. Mirrors `ExerciseType` in types/index.ts.
 * Anything used as a cache key must be validated against this — an unvalidated
 * value lets a caller force unlimited cache misses and unbounded table growth.
 */
export const VALID_EXERCISE_TYPES = [
  'multiple_choice', 'listening_choice', 'listening_type', 'translate_to_target',
  'translate_to_native', 'speaking', 'fill_blank', 'free_production',
  'cloze_deletion', 'sentence_construction', 'dictation', 'error_correction',
  'collocation_match', 'word_form', 'sentence_transformation', 'mini_dialogue',
] as const;

export function isValidExerciseType(value: string): boolean {
  return VALID_EXERCISE_TYPES.includes(value as typeof VALID_EXERCISE_TYPES[number]);
}

/**
 * Where a scored pronunciation attempt came from. Mirrors the CHECK constraint
 * on `public.pronunciation_scores.source` (migration 089) and
 * `PronunciationSource` in types/index.ts. An unvalidated value would be
 * rejected by Postgres and silently cost the learner the record of an attempt
 * they have already paid quota for.
 */
export const VALID_PRONUNCIATION_SOURCES = [
  'lesson', 'checkpoint', 'read_aloud', 'practice',
] as const;

export function isValidPronunciationSource(value: string): boolean {
  return VALID_PRONUNCIATION_SOURCES.includes(
    value as typeof VALID_PRONUNCIATION_SOURCES[number]
  );
}

/** Limit string length to prevent prompt injection payloads. */
export function sanitizeText(text: string, maxLength: number): string {
  return text.slice(0, maxLength).trim();
}

/** Max base64 audio size: 10MB */
export const MAX_AUDIO_BASE64_SIZE = 10 * 1024 * 1024;
