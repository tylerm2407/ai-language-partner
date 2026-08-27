/**
 * Adult mode — the gamification opt-out.
 *
 * Fluenci's positioning is adults who want to actually speak a language. The
 * single most-cited complaint about the category leader is that the game
 * mechanics have taken over the learning: daily point totals with no
 * conversational ability. Adult mode is the product answer — no league
 * standings, no XP confetti. Progress is expressed as CEFR competence instead (see
 * `lib/cefr-proficiency.ts`).
 *
 * This module is the single source of truth for what the mode suppresses.
 * Surfaces must read these flags rather than testing `profile.adultMode`
 * directly, so a future change to the policy lands in one place instead of
 * drifting across a dozen screens.
 *
 * What adult mode does NOT do: stop the underlying values accruing. XP
 * continues to be tracked server-side while the mode is on.
 * Hiding is reversible; discarding a learner's history is not.
 */

export interface GamificationVisibility {
  /** Whether adult mode is active. Prefer the specific flags below. */
  adultMode: boolean;
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
    showLeague: !adultMode,
    showXpCelebration: !adultMode,
    showDailyChallenges: !adultMode,
  };
}

/** Visibility for a learner whose profile has not loaded yet. */
export const DEFAULT_GAMIFICATION_VISIBILITY: GamificationVisibility =
  gamificationVisibility(false);
