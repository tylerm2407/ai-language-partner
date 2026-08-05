/**
 * Adult mode — the gamification opt-out.
 *
 * Fluenci's positioning is adults who want to actually speak a language. The
 * single most-cited complaint about the category leader is that the game
 * mechanics have taken over the learning: 1,000-day streaks with no
 * conversational ability. Adult mode is the product answer — no hearts
 * blocking you mid-lesson, no streak guilt, no league standings, no XP
 * confetti. Progress is expressed as CEFR competence instead (see
 * `lib/cefr-proficiency.ts`).
 *
 * This module is the single source of truth for what the mode suppresses.
 * Surfaces must read these flags rather than testing `profile.adultMode`
 * directly, so a future change to the policy lands in one place instead of
 * drifting across a dozen screens.
 *
 * What adult mode does NOT do: stop the underlying values accruing. XP,
 * streak and hearts continue to be tracked server-side while the mode is on.
 * Hiding is reversible; discarding a learner's history is not.
 */

export interface GamificationVisibility {
  /** Whether adult mode is active. Prefer the specific flags below. */
  adultMode: boolean;
  /** Show the hearts meter in headers and stat bars. */
  showHearts: boolean;
  /** Hearts can block a lesson when exhausted. */
  heartsGateLessons: boolean;
  /** Show streak counters, flames and streak-repair prompts. */
  showStreak: boolean;
  /** Show league tier and standings. */
  showLeague: boolean;
  /** Play XP popups and celebration overlays on success. */
  showXpCelebration: boolean;
  /** Show the daily-challenge board. */
  showDailyChallenges: boolean;
}

/**
 * Derive what the UI should show.
 *
 * @param adultMode The learner's preference, from `UserProfile.adultMode`.
 */
export function gamificationVisibility(adultMode: boolean): GamificationVisibility {
  return {
    adultMode,
    showHearts: !adultMode,
    heartsGateLessons: !adultMode,
    showStreak: !adultMode,
    showLeague: !adultMode,
    showXpCelebration: !adultMode,
    showDailyChallenges: !adultMode,
  };
}

/** Visibility for a learner whose profile has not loaded yet. */
export const DEFAULT_GAMIFICATION_VISIBILITY: GamificationVisibility =
  gamificationVisibility(false);
