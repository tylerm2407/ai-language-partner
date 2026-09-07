/**
 * The rule these pin: a ceiling is a sales moment BELOW the top tier and an
 * honest status message ON it. Showing "upgrade" to someone already paying
 * the most is the failure mode worth a test.
 */
import {
  limitCopy,
  describeReset,
  nextDailyReset,
  nextMonthlyReset,
  tutorLimitCopy,
  TOP_TIER,
} from './limit-messaging';
import { tutorMinutesPerMonth } from './plans';

const NOON = new Date('2026-09-02T12:00:00');

describe('limitCopy', () => {
  it('offers an upgrade below the top tier', () => {
    for (const tier of ['starter', 'basic', 'premium'] as const) {
      const c = limitCopy('messages', tier, NOON);
      expect(c.upgrade).toBeDefined();
      expect(c.message).toMatch(/upgrade/i);
      // Even the upsell tells them when it resets — the upgrade is an option,
      // not the only way out.
      expect(c.message).toMatch(/resets/i);
    }
  });

  it('never offers an upgrade on the top tier', () => {
    const c = limitCopy('messages', TOP_TIER, NOON);
    expect(c.upgrade).toBeUndefined();
    expect(c.message).not.toMatch(/upgrade/i);
    expect(c.resetsAt).toBeInstanceOf(Date);
  });

  it('names the feature in plain language, never a counter name', () => {
    const c = limitCopy('lesson audio', 'basic', NOON);
    expect(c.message).toContain('lesson audio');
    expect(c.message).not.toMatch(/lesson_tts_plays|_/);
  });

  it('treats an unknown or missing tier as upgradeable', () => {
    // Safer default: offering an upgrade to someone who cannot use it is a
    // mild annoyance; withholding the reset time from a paying VIP is worse.
    expect(limitCopy('messages', null, NOON).upgrade).toBeDefined();
    expect(limitCopy('messages', undefined, NOON).upgrade).toBeDefined();
  });
});

describe('nextDailyReset', () => {
  it('is the next local midnight, matching fluenci_user_today', () => {
    const r = nextDailyReset(NOON);
    expect(r.getHours()).toBe(0);
    expect(r.getDate()).toBe(NOON.getDate() + 1);
  });
});

describe('describeReset', () => {
  it('reports a duration, not a wall-clock time', () => {
    expect(describeReset(new Date('2026-09-02T15:00:00'), NOON)).toBe('in 3 hours');
    expect(describeReset(new Date('2026-09-02T12:25:00'), NOON)).toBe('in 25 minutes');
  });

  it('singularises', () => {
    expect(describeReset(new Date('2026-09-02T13:00:00'), NOON)).toBe('in 1 hour');
    expect(describeReset(new Date('2026-09-02T12:01:00'), NOON)).toBe('in 1 minute');
  });

  it('does not produce a negative duration when the clock has drifted past', () => {
    expect(describeReset(new Date('2026-09-02T11:00:00'), NOON)).toBe('in a moment');
  });
});

/**
 * The tutor has TWO clocks, and they come back at very different times. The
 * failure this guards is telling someone who exhausted their MONTH that their
 * allowance resets in three hours — a sentence they will believe and act on.
 */
describe('tutorLimitCopy', () => {
  it('reports the daily ceiling as a duration, like every other daily limit', () => {
    const c = tutorLimitCopy('DAILY_TUTOR_LIMIT_REACHED', 'premium', NOON);
    expect(c.message).toContain('live tutor time');
    expect(c.message).toMatch(/resets in \d+ hours?/);
    expect(c.upgrade).toBeDefined();
  });

  it('names the reset DATE for the monthly ceiling, never "next month"', () => {
    // `fluenci_user_month` resolves the learner's own LOCAL month, so "next
    // month" for someone at UTC+13 is not our next month. Only a date is true
    // everywhere, and a duration weeks out is useless.
    const c = tutorLimitCopy('MONTHLY_TUTOR_BUDGET_REACHED', 'premium', NOON);
    expect(c.message).toContain('1 October');
    expect(c.message).not.toMatch(/next month/i);
    expect(c.message).not.toMatch(/\bin \d+ (hours?|minutes?|days?)\b/);
  });

  it('quotes the monthly allowance in MINUTES, and never in money', () => {
    // The server meters this in cents. A learner on a flat monthly price did
    // not buy cents, and the cents figure is our cost rather than their price.
    for (const tier of ['basic', 'premium', 'vip'] as const) {
      const c = tutorLimitCopy('MONTHLY_TUTOR_BUDGET_REACHED', tier, NOON);
      expect(c.message).toContain(`${tutorMinutesPerMonth(tier)} minutes`);
      expect(c.message).not.toMatch(/[$£€¢]|cents?\b|credits?\b/i);
    }
  });

  it('does not upsell the top tier, and tells them when the minutes return', () => {
    const c = tutorLimitCopy('MONTHLY_TUTOR_BUDGET_REACHED', TOP_TIER, NOON);
    expect(c.upgrade).toBeUndefined();
    expect(c.message).not.toMatch(/upgrade/i);
    expect(c.message).toContain('1 October');
    expect(c.resetsAt).toBeInstanceOf(Date);
  });

  it('drops the number rather than promising "all 0 minutes" on an unknown tier', () => {
    const c = tutorLimitCopy('MONTHLY_TUTOR_BUDGET_REACHED', null, NOON);
    expect(c.message).not.toMatch(/\b0 minutes\b/);
    expect(c.message).toContain('live tutor time');
    expect(c.upgrade).toBeDefined();
  });

  it('offers no reset at all for an unentitled plan, because nothing resets', () => {
    // The trap: falling this through to the daily copy would say "your
    // allowance resets in 3 hours" to someone whose plan has never had one.
    const c = tutorLimitCopy('TUTOR_NOT_ENTITLED', 'starter', NOON);
    expect(c.resetsAt).toBeUndefined();
    expect(c.message).not.toMatch(/resets|comes back/i);
    expect(c.upgrade).toBeDefined();
  });
});

describe('nextMonthlyReset', () => {
  it('is the learner\'s next local 1st', () => {
    const r = nextMonthlyReset(NOON);
    expect(r.getDate()).toBe(1);
    expect(r.getMonth()).toBe(9); // October
    expect(r.getHours()).toBe(0);
  });

  it('rolls December into next January', () => {
    const r = nextMonthlyReset(new Date('2026-12-20T12:00:00'));
    expect(r.getFullYear()).toBe(2027);
    expect(r.getMonth()).toBe(0);
    expect(r.getDate()).toBe(1);
  });
});
