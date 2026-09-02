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
   * Word/phrase translations per day (migration 093). Charged on cache MISS
   * only — a cache hit costs nothing to serve, so billing it would penalise
   * re-reading a passage while ignoring the long-tail text that actually
   * spends money.
   */
  dailyTranslations: number;
  /** Personalised goal-track generations per day (migration 103). ~$0.023 each. */
  dailyGoalTracks: number;
  /** Book chapters sent for narration per day (migration 103). Cached and
   *  shared per book, so this bounds the RATE; the catalogue bounds the total. */
  dailyAudiobookChapters: number;
  /**
   * Single-word lookups from the reader per day (migration 094), metered on
   * `daily_usage.word_lookups`. Charged on cache MISS only, like
   * `dailyTranslations`.
   *
   * Deliberately a separate, far larger counter. `dailyTranslations` is sized
   * for the chat Translate button, where one call carries up to 1500
   * characters; a reading lookup is one word, roughly a fiftieth of the
   * tokens, and a learner meeting a new page taps far more than ten times.
   * The `translate` function only charges this counter for input it accepted
   * as a single token, so the cheaper meter cannot be used to translate a
   * paragraph. Both paths share one `translation_cache`, so a hit is free
   * either way and each warms the other.
   *
   * `vip` is 9999, the same unlimited sentinel `dailyNewCards` and
   * `dailyHints` use.
   */
  dailyWordLookups: number;
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
  /**
   * Hints served by `get-hint` per day, metered on `daily_usage.hints_generated`
   * (migration 090).
   *
   * Free users are deliberately still served: their hints are generic, so they
   * come back from `hint_cache` and cost essentially nothing. Entitled learners
   * get a hint shaped by their own recent mistakes, which cannot be written to a
   * cache keyed on (card_id, exercise_type) without handing one learner's
   * profile to every other learner on that card — so those calls skip the cache
   * and are live every time. This meter exists for that path.
   *
   * `vip` is 9999, the same unlimited sentinel `dailyNewCards` uses. Do not
   * introduce a second shape for "no limit"; every comparison site would have
   * to learn it.
   */
  dailyHints: number;

  /**
   * SRS cards created per day from vocabulary a conversation introduced.
   *
   * A separate budget from `dailyNewCards` on purpose. That counter is the
   * free tier's real boundary and is spent on the curriculum the learner
   * opened the app for; a word the tutor happened to use is incidental, and
   * letting the two compete would mean a chatty session silently eats the
   * day's lessons. They are also metered by different primitives —
   * `dailyNewCards` by `try_consume_new_card_slot` against
   * `daily_stats.cards_learned`, this by `consume_daily_quota` against
   * `daily_usage.chat_cards`.
   *
   * Small numbers deliberately. These cards arrive without the learner
   * asking, so the cap is a limit on how much unrequested review a
   * conversation may add to tomorrow — not a paywall.
   */
  dailyChatCards: number;
  offlineMode: boolean;
}

// Avatar and lesson-TTS caps were cut 2026-08-31 after costing the whole
// system against vendor prices. Two findings drove it:
//   * gpt-image-2 at 1024x1024 is ~$0.211/image on 'high'. Ten a day was ~$63
//     a month of cost on a $29.99 plan, for a profile picture.
//     REVISED 2026-09-01: quality is back to 'high' and the cap is 1/day on
//     EVERY paid tier. The earlier 'medium' cut optimised the wrong variable —
//     nobody wants four mediocre portraits, they want one good one. Spending
//     the budget on quality and buying it back with quantity is the right
//     trade for this feature. The 1/day cap is load-bearing: at ~$0.211 an
//     image it is ~$6.33/month worst case, most of the net revenue on basic.
//   * fish.audio bills $15 per 1M UTF-8 BYTES, and Japanese/Chinese/Korean
//     run ~3 bytes per character, so CJK synthesis costs ~3x Spanish for the
//     same sentence. The old 200/day cap was priced as if every learner were
//     Spanish.
// These caps bound the tail; they are far above what a normal learner reaches.
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
  starter:   { dailyTextMessages: 0,  dailyVoiceMinutes: 0,  dailyTranslations: 10, dailyWordLookups: 60,  dailyWritingGrades: 0,  dailyPronunciationScores: 0, dailyLessonTtsPlays: 5,   dailyAvatarGenerations: 0, dailyNewCards: 5,    dailyHints: 5,   dailyGoalTracks: 1, dailyAudiobookChapters: 0, dailyChatCards: 3,    offlineMode: false },
  basic:     { dailyTextMessages: 25, dailyVoiceMinutes: 6,  dailyTranslations: 30, dailyWordLookups: 300, dailyWritingGrades: 3,  dailyPronunciationScores: 3, dailyLessonTtsPlays: 25,  dailyAvatarGenerations: 1, dailyNewCards: 20,   dailyHints: 30,  dailyGoalTracks: 2, dailyAudiobookChapters: 0, dailyChatCards: 15,   offlineMode: false },
  premium:   { dailyTextMessages: 50, dailyVoiceMinutes: 12, dailyTranslations: 60, dailyWordLookups: 600, dailyWritingGrades: 7,  dailyPronunciationScores: 5, dailyLessonTtsPlays: 50, dailyAvatarGenerations: 1, dailyNewCards: 9999, dailyHints: 75,  dailyGoalTracks: 3, dailyAudiobookChapters: 3, dailyChatCards: 30,   offlineMode: true },
  vip:       { dailyTextMessages: 75, dailyVoiceMinutes: 18, dailyTranslations: 90, dailyWordLookups: 800, dailyWritingGrades: 12, dailyPronunciationScores: 7, dailyLessonTtsPlays: 80, dailyAvatarGenerations: 1, dailyNewCards: 9999, dailyHints: 150, dailyGoalTracks: 3, dailyAudiobookChapters: 5, dailyChatCards: 50, offlineMode: true },
};

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier as PlanTier] ?? PLAN_LIMITS.starter;
}

/**
 * Get the effective limits for a user, considering school/org overrides.
 * Calls the `get_effective_limits` RPC which merges plan limits with
 * any organization contract_config overrides.
 *
 * `tier` is optional and is the floor this falls back to — for the keys the
 * RPC does not return, and for every error path. Pass it when the caller has
 * already looked the tier up; omit it and the floor is the free tier, which
 * is the safe guess when nothing is known.
 *
 * This parameter exists because `tts` needs both halves at once: the RPC is
 * the only thing that knows a school's `dailyVoiceMinutes` override, and the
 * only thing that does NOT know `dailyLessonTtsPlays`. Coming through here
 * without a tier would have fixed voice minutes for classroom learners by
 * cutting every paid learner's lesson audio from 25-80 plays down to 5.
 */
export async function getEffectiveLimits(
  userId: string,
  supabase: any,
  tier?: string,
): Promise<PlanLimits> {
  const base = getPlanLimits(tier ?? 'starter');
  try {
    const { data, error } = await supabase.rpc('get_effective_limits', {
      p_user_id: userId,
    });

    if (error || !data) {
      return base;
    }

    // data may be a single JSONB object or an array with one element
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return base;

    return {
      dailyTextMessages: typeof row.dailyTextMessages === 'number' ? row.dailyTextMessages : (row.daily_text_messages ?? base.dailyTextMessages),
      dailyVoiceMinutes: typeof row.dailyVoiceMinutes === 'number' ? row.dailyVoiceMinutes : (row.daily_voice_minutes ?? base.dailyVoiceMinutes),
      dailyWritingGrades: typeof row.dailyWritingGrades === 'number' ? row.dailyWritingGrades : (row.daily_writing_grades ?? base.dailyWritingGrades),
      dailyPronunciationScores: typeof row.dailyPronunciationScores === 'number' ? row.dailyPronunciationScores : (row.daily_pronunciation_scores ?? base.dailyPronunciationScores),
      // Added by migration 093, so the RPC DOES return it — but fall back to
      // the starter value rather than a plan default if an older deployment
      // of the function is still live. Under-serving a limit is recoverable;
      // handing out an unmetered paid call is not.
      dailyTranslations: typeof row.dailyTranslations === 'number' ? row.dailyTranslations : base.dailyTranslations,
      // Added by migration 094, same reasoning as dailyTranslations above.
      dailyWordLookups: typeof row.dailyWordLookups === 'number' ? row.dailyWordLookups : base.dailyWordLookups,
      // get_effective_limits predates these two keys and does not return them,
      // so each falls through to a plan default. School contract overrides
      // intentionally do not apply to either.
      //
      // Both fall back to `base` — the caller's tier when it passed one,
      // the free tier otherwise. `tts` does its own tier lookup and now
      // passes it in, which is what this note used to ask for.
      dailyLessonTtsPlays: typeof row.dailyLessonTtsPlays === 'number' ? row.dailyLessonTtsPlays : base.dailyLessonTtsPlays,
      dailyAvatarGenerations: typeof row.dailyAvatarGenerations === 'number' ? row.dailyAvatarGenerations : base.dailyAvatarGenerations,
      // These two the RPC does return — `dailyNewCards` since migration 084 and
      // `dailyHints` since 090 — school override included. `dailyNewCards` was
      // simply missing from this object, which `tsc` never caught because
      // supabase/functions is excluded from the app tsconfig; `deno check` has
      // been reporting it.
      dailyNewCards: typeof row.dailyNewCards === 'number' ? row.dailyNewCards : base.dailyNewCards,
      dailyHints: typeof row.dailyHints === 'number' ? row.dailyHints : base.dailyHints,
      // Added by migration 095, same reasoning as dailyTranslations above.
      dailyChatCards: typeof row.dailyChatCards === 'number' ? row.dailyChatCards : base.dailyChatCards,
      // Added to PlanLimits after this mapper was written. `get_effective_limits`
      // does not return either key, so both fall through to the tier floor —
      // the same treatment dailyLessonTtsPlays gets, and for the same reason.
      dailyGoalTracks: typeof row.dailyGoalTracks === 'number' ? row.dailyGoalTracks : base.dailyGoalTracks,
      dailyAudiobookChapters:
        typeof row.dailyAudiobookChapters === 'number'
          ? row.dailyAudiobookChapters
          : base.dailyAudiobookChapters,
      offlineMode: row.offlineMode === true || row.offline_mode === true || false,
    };
  } catch {
    return base;
  }
}
