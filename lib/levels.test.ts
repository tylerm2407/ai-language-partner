/**
 * Level-up detection.
 *
 * These exist because of a real, shipped bug: `useLevel` seeded its "previous
 * level" to the literal `1` on every mount, so every learner above level 1 was
 * detected as having just levelled up. Opening a lesson rendered a full-screen
 * "LEVEL UP!" card over question one, dismissing it did nothing (the next mount
 * re-derived the same false positive), and because `LevelUpModal` is a React
 * Native `<Modal>` it rendered at the window root — so it followed the learner
 * across navigation and could sit on top of the paywall's purchase button.
 *
 * The hook itself is not rendered here: it pulls in the auth/session stack, and
 * this repo's convention (see hooks/usePhonemeDrill.test.ts) is to test the
 * load-bearing logic as a pure function instead.
 */
import { detectLevelUp, getLeagueTier } from './levels';

describe('detectLevelUp', () => {
  it('reports nothing when there is no baseline yet', () => {
    // THE regression. A freshly mounted screen has observed nothing, which is
    // not the same fact as "the learner was on level 1".
    expect(detectLevelUp(null, 2)).toBeNull();
    expect(detectLevelUp(null, 40)).toBeNull();
    expect(detectLevelUp(null, 1)).toBeNull();
  });

  it('reports nothing when the level has not moved', () => {
    expect(detectLevelUp(2, 2)).toBeNull();
    expect(detectLevelUp(40, 40)).toBeNull();
  });

  it('reports nothing when the level went down', () => {
    // Shouldn't happen — XP only accrues — but a corrected server value must
    // never be celebrated as progress.
    expect(detectLevelUp(5, 4)).toBeNull();
  });

  it('reports a level-up on a genuine transition', () => {
    expect(detectLevelUp(1, 2)).toEqual({
      newLevel: 2,
      newTier: 'bronze',
      tierChanged: false,
    });
  });

  it('flags a tier change only when the tier actually changed', () => {
    // 10 -> 11 crosses bronze into silver.
    expect(getLeagueTier(10)).toBe('bronze');
    expect(getLeagueTier(11)).toBe('silver');
    expect(detectLevelUp(10, 11)).toEqual({
      newLevel: 11,
      newTier: 'silver',
      tierChanged: true,
    });

    // 11 -> 12 stays inside silver.
    expect(detectLevelUp(11, 12)).toMatchObject({ tierChanged: false });
  });

  it('handles a multi-level jump as one level-up at the new tier', () => {
    // A large idempotent XP grant can skip levels; the celebration should name
    // where the learner landed, not each rung.
    expect(detectLevelUp(9, 12)).toEqual({
      newLevel: 12,
      newTier: 'silver',
      tierChanged: true,
    });
  });

  it('never treats level 1 as a magic baseline', () => {
    // The old code's comparison was `prev > 0 && next > prev` with prev seeded
    // to 1, which is exactly this call — and it must not fire.
    const asIfFreshlyMounted = detectLevelUp(null, 2);
    const asIfGenuinelyAtLevelOne = detectLevelUp(1, 2);
    expect(asIfFreshlyMounted).toBeNull();
    expect(asIfGenuinelyAtLevelOne).not.toBeNull();
  });
});
