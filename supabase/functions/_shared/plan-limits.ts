/**
 * Single source of truth for plan limits across all Edge Functions.
 * Mirrors lib/plans.ts on the client — keep in sync.
 */

export type PlanTier = 'free' | 'basic' | 'premium' | 'unlimited';

export interface PlanLimits {
  dailyTextConversations: number | 'unlimited';
  dailyVoiceMinutes: number | 'unlimited';
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free:      { dailyTextConversations: 5,           dailyVoiceMinutes: 5 },
  basic:     { dailyTextConversations: 20,          dailyVoiceMinutes: 20 },
  premium:   { dailyTextConversations: 'unlimited', dailyVoiceMinutes: 45 },
  unlimited: { dailyTextConversations: 'unlimited', dailyVoiceMinutes: 60 },
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier as PlanTier] ?? PLAN_LIMITS.free;
}
