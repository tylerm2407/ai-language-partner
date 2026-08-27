/**
 * Single source of truth for plan limits across all Edge Functions.
 * Mirrors lib/plans.ts on the client — keep in sync.
 */

export type PlanTier = 'starter' | 'basic' | 'premium' | 'vip';

export interface PlanLimits {
  dailyTextMessages: number;
  /** Always a finite number of minutes. No plan tier (or school contract
   *  override) grants unlimited voice — do not compare against an
   *  'unlimited' sentinel. */
  dailyVoiceMinutes: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  /**
   * Lesson-exercise TTS syntheses per day, metered on
   * `daily_usage.lesson_tts_plays` (migration 077).
   *
   * Deliberately NOT `dailyVoiceMinutes`. Listening and dictation exercises
   * are voiced by the `tts` function, so a free tier with 0 voice minutes
   * would ship visibly broken lessons rather than a smaller product. Keeping
   * the counters apart is what stops that allowance being spent on chat
   * playback or voice practice instead.
   */
  dailyLessonTtsPlays: number;
  /** Photo-to-avatar generations per day. Paid tiers only; `starter` is 0,
   *  which the generate-avatar function rejects before quota is consulted.
   *  Each generation is a paid image-model call, so these stay deliberately
   *  small — they are re-roll budgets, not a feature to sit and play with. */
  dailyAvatarGenerations: number;
  /**
   * Previously-unseen SRS cards a learner may introduce per day.
   *
   * This is the free tier's real boundary since migration 084 — it replaced
   * hearts, which metered mistakes and blocked nothing. Enforced in Postgres by
   * `try_consume_new_card_slot`, which reads it from `get_effective_limits`
   * rather than taking it from the caller. Review of already-learned material
   * is uncapped on every tier.
   */
  dailyNewCards: number;
  offlineMode: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  // `starter` = the free plan: signed up, never subscribed, and fully entitled
  // to everything that costs nothing per learner. Every per-call AI quota is 0
  // and each function refuses before spending a token — these zeros ARE the
  // free tier's boundary, and they are the only copy that enforces anything.
  // The client's lib/plans.ts is a mirror for display; deleting a check there
  // must never grant quota here.
  //
  // Two exceptions, both deliberate:
  //   • `dailyLessonTtsPlays` — lesson audio, so free lessons work at all.
  //   • `dailyAvatarGenerations` stays 0, but generate-avatar grants one
  //     LIFETIME free generation via consume_free_avatar (migration 077),
  //     which is a different thing from a daily allowance and is checked
  //     before this quota is ever consulted.
  //
  // Classroom students are unaffected — their org's contract_config is merged
  // in by get_effective_limits with GREATEST(), so a 0 personal quota still
  // resolves to the school's allowance.
  starter:   { dailyTextMessages: 0,  dailyVoiceMinutes: 0,  dailyWritingGrades: 0,  dailyPronunciationScores: 0, dailyLessonTtsPlays: 5,   dailyAvatarGenerations: 0, dailyNewCards: 5,    offlineMode: false },
  basic:     { dailyTextMessages: 25, dailyVoiceMinutes: 10, dailyWritingGrades: 3,  dailyPronunciationScores: 3, dailyLessonTtsPlays: 50,  dailyAvatarGenerations: 2, dailyNewCards: 20,   offlineMode: false },
  premium:   { dailyTextMessages: 50, dailyVoiceMinutes: 20, dailyWritingGrades: 7,  dailyPronunciationScores: 5, dailyLessonTtsPlays: 100, dailyAvatarGenerations: 5, dailyNewCards: 9999, offlineMode: true },
  vip:       { dailyTextMessages: 75, dailyVoiceMinutes: 30, dailyWritingGrades: 12, dailyPronunciationScores: 7, dailyLessonTtsPlays: 200, dailyAvatarGenerations: 10, dailyNewCards: 9999, offlineMode: true },
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier as PlanTier] ?? PLAN_LIMITS.starter;
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
      return getPlanLimits('starter');
    }

    // data may be a single JSONB object or an array with one element
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return getPlanLimits('starter');

    return {
      dailyTextMessages: typeof row.dailyTextMessages === 'number' ? row.dailyTextMessages : (row.daily_text_messages ?? PLAN_LIMITS.starter.dailyTextMessages),
      dailyVoiceMinutes: typeof row.dailyVoiceMinutes === 'number' ? row.dailyVoiceMinutes : (row.daily_voice_minutes ?? PLAN_LIMITS.starter.dailyVoiceMinutes),
      dailyWritingGrades: typeof row.dailyWritingGrades === 'number' ? row.dailyWritingGrades : (row.daily_writing_grades ?? PLAN_LIMITS.starter.dailyWritingGrades),
      dailyPronunciationScores: typeof row.dailyPronunciationScores === 'number' ? row.dailyPronunciationScores : (row.daily_pronunciation_scores ?? PLAN_LIMITS.starter.dailyPronunciationScores),
      // get_effective_limits predates both of these keys and does not return
      // them, so each falls through to a plan default. School contract
      // overrides intentionally do not apply to either.
      //
      // Both fall back to `starter`. This function has no tier to fall back
      // to — it exists precisely because the RPC is the thing that knows one —
      // and the only caller (ai-chat) reads neither key, so a low default here
      // cannot under-serve anyone today. The tts function does its own tier
      // lookup and calls getPlanLimits directly rather than coming through
      // here; if that ever changes, pass the tier in rather than guessing it.
      dailyLessonTtsPlays: typeof row.dailyLessonTtsPlays === 'number' ? row.dailyLessonTtsPlays : PLAN_LIMITS.starter.dailyLessonTtsPlays,
      dailyAvatarGenerations: typeof row.dailyAvatarGenerations === 'number' ? row.dailyAvatarGenerations : PLAN_LIMITS.starter.dailyAvatarGenerations,
      offlineMode: row.offlineMode === true || row.offline_mode === true || false,
    };
  } catch {
    return getPlanLimits('starter');
  }
}
