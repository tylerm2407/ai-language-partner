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
  offlineMode: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free:      { dailyTextMessages: 5,  dailyVoiceMinutes: 5,  dailyWritingGrades: 1,  dailyPronunciationScores: 2, offlineMode: false },
  basic:     { dailyTextMessages: 25, dailyVoiceMinutes: 10, dailyWritingGrades: 3,  dailyPronunciationScores: 3, offlineMode: false },
  premium:   { dailyTextMessages: 50, dailyVoiceMinutes: 20, dailyWritingGrades: 7,  dailyPronunciationScores: 5, offlineMode: true },
  vip:       { dailyTextMessages: 75, dailyVoiceMinutes: 30, dailyWritingGrades: 12, dailyPronunciationScores: 7, offlineMode: true },
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier as PlanTier] ?? PLAN_LIMITS.free;
}

/**
 * Get the effective limits for a user, considering school/org overrides.
 * Calls the `get_effective_limits` RPC which merges plan limits with
 * any organization contract_config overrides.
 * Falls back to free-tier limits on error.
 */
export async function getEffectiveLimits(userId: string, supabase: any): Promise<PlanLimits> {
  try {
    const { data, error } = await supabase.rpc('get_effective_limits', {
      p_user_id: userId,
    });

    if (error || !data) {
      return getPlanLimits('free');
    }

    // data may be a single JSONB object or an array with one element
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return getPlanLimits('free');

    return {
      dailyTextMessages: typeof row.dailyTextMessages === 'number' ? row.dailyTextMessages : (row.daily_text_messages ?? PLAN_LIMITS.free.dailyTextMessages),
      dailyVoiceMinutes: typeof row.dailyVoiceMinutes === 'number' ? row.dailyVoiceMinutes : (row.daily_voice_minutes ?? PLAN_LIMITS.free.dailyVoiceMinutes),
      dailyWritingGrades: typeof row.dailyWritingGrades === 'number' ? row.dailyWritingGrades : (row.daily_writing_grades ?? PLAN_LIMITS.free.dailyWritingGrades),
      dailyPronunciationScores: typeof row.dailyPronunciationScores === 'number' ? row.dailyPronunciationScores : (row.daily_pronunciation_scores ?? PLAN_LIMITS.free.dailyPronunciationScores),
      offlineMode: row.offlineMode === true || row.offline_mode === true || false,
    };
  } catch {
    return getPlanLimits('free');
  }
}
