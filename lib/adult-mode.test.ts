/**
 * Unit tests for adult-mode visibility.
 *
 * These exist mostly as a regression guard: adult mode is the product promise
 * that the pressure mechanics are genuinely gone, so a flag quietly flipping
 * back to visible is a positioning bug, not just a UI bug.
 */

import {
  DEFAULT_GAMIFICATION_VISIBILITY,
  gamificationVisibility,
  type GamificationVisibility,
} from './adult-mode';

describe('gamificationVisibility', () => {
  it('shows every mechanic when adult mode is off', () => {
    const v = gamificationVisibility(false);
    expect(v).toEqual<GamificationVisibility>({
      adultMode: false,
      showLeague: true,
      showXpCelebration: true,
      showDailyChallenges: true,
    });
  });

  it('suppresses every pressure mechanic when adult mode is on', () => {
    const v = gamificationVisibility(true);
    expect(v).toEqual<GamificationVisibility>({
      adultMode: true,
      showLeague: false,
      showXpCelebration: false,
      showDailyChallenges: false,
    });
  });

  it('suppresses XP celebration in adult mode — the core promise', () => {
    expect(gamificationVisibility(true).showXpCelebration).toBe(false);
  });

  it('defaults to the full gamified experience before the profile loads', () => {
    expect(DEFAULT_GAMIFICATION_VISIBILITY.adultMode).toBe(false);
    expect(DEFAULT_GAMIFICATION_VISIBILITY.showXpCelebration).toBe(true);
  });
});
