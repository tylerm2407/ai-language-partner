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

/**
 * Time-of-day greeting in the learner's TARGET language, for the Home header.
 *
 * Greeting the learner in the language they're learning is a free dose of
 * comprehensible input on a string they'll see every day. Falls back to
 * English when the profile hasn't loaded or the language isn't mapped.
 *
 * Bands are morning (<12), afternoon (<19), evening — the split most of these
 * languages actually use. Japanese/Korean/Chinese/Russian are romanization-free
 * (native script) since the learner is studying the script.
 */
const GREETINGS: Record<LanguageCode, readonly [string, string, string]> = {
  es: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
  fr: ['Bonjour', 'Bon après-midi', 'Bonsoir'],
  de: ['Guten Morgen', 'Guten Tag', 'Guten Abend'],
  it: ['Buongiorno', 'Buon pomeriggio', 'Buonasera'],
  pt: ['Bom dia', 'Boa tarde', 'Boa noite'],
  ja: ['おはよう', 'こんにちは', 'こんばんは'],
  ko: ['좋은 아침', '안녕하세요', '좋은 저녁'],
  zh: ['早上好', '下午好', '晚上好'],
  ru: ['Доброе утро', 'Добрый день', 'Добрый вечер'],
  en: ['Good morning', 'Good afternoon', 'Good evening'],
};

const GREETINGS_EN: readonly [string, string, string] = [
  'Good morning',
  'Good afternoon',
  'Good evening',
];

export function targetLanguageGreeting(
  language: LanguageCode | null | undefined,
  hour: number = new Date().getHours(),
): string {
  const band = hour < 12 ? 0 : hour < 19 ? 1 : 2;
  const set = language ? GREETINGS[language] : undefined;
  return (set ?? GREETINGS_EN)[band];
}
