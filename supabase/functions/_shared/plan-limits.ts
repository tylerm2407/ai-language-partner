/**
 * Single source of truth for plan limits across all Edge Functions.
 * Mirrors lib/plans.ts on the client — keep in sync.
 */

export type PlanTier = 'free' | 'basic' | 'premium' | 'vip';

export interface PlanLimits {
  dailyTextMessages: number;
  dailyVoiceMinutes: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free:      { dailyTextMessages: 5,  dailyVoiceMinutes: 5,  dailyWritingGrades: 1,  dailyPronunciationScores: 2 },
  basic:     { dailyTextMessages: 25, dailyVoiceMinutes: 10, dailyWritingGrades: 3,  dailyPronunciationScores: 3 },
  premium:   { dailyTextMessages: 50, dailyVoiceMinutes: 20, dailyWritingGrades: 7,  dailyPronunciationScores: 5 },
  vip:       { dailyTextMessages: 75, dailyVoiceMinutes: 30, dailyWritingGrades: 12, dailyPronunciationScores: 7 },
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier as PlanTier] ?? PLAN_LIMITS.free;
}
