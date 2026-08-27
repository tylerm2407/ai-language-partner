/**
 * The new-card allowance is what meters the free tier (migration 084). It
 * replaced hearts, which metered mistakes and — because nothing ever blocked
 * at zero — gated nothing at all while being sold on the paywall.
 *
 * These pin the parts that are easy to break silently:
 *   - the tier ladder itself, which the paywall copy is written against;
 *   - that review is never what gets capped;
 *   - that the client cannot assert its own cap.
 */
// plan-pricing pulls in lib/purchases, which loads the RevenueCat native
// module. Same treatment as lib/plan-pricing.test.ts — these are pure values,
// so stubbing the SDK just keeps the module importable under jest.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 1 },
}));

import { PLANS, UNLIMITED_NEW_CARDS, isUnlimitedNewCards } from './plans';
import { STEP_ADDS } from './plan-pricing';

describe('new-card allowance ladder', () => {
  it('gives the free tier a usable but slower allowance, never zero', () => {
    // Zero would make a free account a demo rather than a product. The point
    // of this mechanic is that a free learner can still learn every day.
    expect(PLANS.starter.dailyNewCards).toBe(5);
    expect(PLANS.starter.dailyNewCards).toBeGreaterThan(0);
  });

  it('sets basic to the research-backed default of 20/day', () => {
    // research.md §5.2 — also the value SRS_DEFAULTS still carries as its
    // pre-load fallback. If this moves, that comment is wrong too.
    expect(PLANS.basic.dailyNewCards).toBe(20);
  });

  it('is monotonic across the tier ladder', () => {
    // A higher tier must never buy you less. This is the check that catches a
    // careless paste between tier blocks.
    const ladder = [
      PLANS.starter.dailyNewCards,
      PLANS.basic.dailyNewCards,
      PLANS.premium.dailyNewCards,
      PLANS.vip.dailyNewCards,
    ];
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThanOrEqual(ladder[i - 1]);
    }
  });

  it('treats the paid top tiers as uncapped', () => {
    expect(isUnlimitedNewCards(PLANS.premium.dailyNewCards)).toBe(true);
    expect(isUnlimitedNewCards(PLANS.vip.dailyNewCards)).toBe(true);
    expect(isUnlimitedNewCards(PLANS.starter.dailyNewCards)).toBe(false);
    expect(isUnlimitedNewCards(PLANS.basic.dailyNewCards)).toBe(false);
  });

  it('uses a sentinel that survives the school GREATEST() merge', () => {
    // get_effective_limits merges a classroom contract with GREATEST(), so
    // `null` or `-1` would lose to any real number and silently DOWNGRADE an
    // unlimited learner to their school's cap.
    expect(UNLIMITED_NEW_CARDS).toBeGreaterThan(PLANS.basic.dailyNewCards);
    expect(Number.isInteger(UNLIMITED_NEW_CARDS)).toBe(true);
    expect(UNLIMITED_NEW_CARDS).toBeGreaterThan(0);
  });
});

describe('what the tiers are allowed to claim', () => {
  it('never advertises hearts — the mechanic is gone', () => {
    // "Unlimited hearts" was sold on Basic while hearts blocked nothing. The
    // whole reason this file exists is to stop that shape of claim returning.
    const everyClaim = [
      ...Object.values(PLANS).flatMap((p) => [p.name]),
      ...Object.values(STEP_ADDS),
    ].join(' ').toLowerCase();
    expect(everyClaim).not.toContain('heart');
    expect(everyClaim).not.toContain('streak');
  });

  it("names basic's real new-word allowance in its step line", () => {
    // The paywall's per-tier line has to match PLANS or it is selling a
    // number the server will not honour.
    expect(STEP_ADDS.basic).toContain(String(PLANS.basic.dailyNewCards));
  });
});
