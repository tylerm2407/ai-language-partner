import type { ProficiencyLevel } from '../types';

export const SRS_DEFAULTS = {
  initialEaseFactor: 2.5,
  minimumEaseFactor: 1.3,
  newCardsPerDay: 20,
} as const;

export const DAILY_GOALS = [5, 10, 15, 20, 30] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'es' as const, name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr' as const, name: 'French', flag: '🇫🇷' },
  { code: 'de' as const, name: 'German', flag: '🇩🇪' },
  { code: 'it' as const, name: 'Italian', flag: '🇮🇹' },
  { code: 'pt' as const, name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja' as const, name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko' as const, name: 'Korean', flag: '🇰🇷' },
  { code: 'zh' as const, name: 'Chinese', flag: '🇨🇳' },
  { code: 'ru' as const, name: 'Russian', flag: '🇷🇺' },
] as const;

// ─── Daily News tiers ────────────────────────────────────────────────────
// Articles are generated in two difficulty tiers per language per day.
// `easy` covers CEFR A1–B1 (beginner → intermediate); `hard` covers
// B2–C1 (upper-intermediate → advanced). Keeping two tiers instead of
// per-CEFR gives a 110× Claude-token reduction vs. per-user generation
// while still keeping content roughly level-appropriate.
export type NewsTier = 'easy' | 'hard';

export function levelToNewsTier(level: ProficiencyLevel): NewsTier {
  return level === 'upper_intermediate' || level === 'advanced' ? 'hard' : 'easy';
}
