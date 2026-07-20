import type { LanguageCode, UserProfile } from '../types';

/**
 * The user's target language, or null when the profile hasn't loaded yet.
 *
 * Never default a missing profile to a specific language — a user whose
 * profile is still loading would silently get the wrong language's content
 * and grading. Callers must handle null explicitly (usually by gating the
 * fetch/action behind the screen's existing loading state).
 */
export function getTargetLanguage(
  profile: Pick<UserProfile, 'targetLanguage'> | null | undefined,
): LanguageCode | null {
  return profile?.targetLanguage ?? null;
}
