/**
 * The rule these pin: a ceiling is a sales moment BELOW the top tier and an
 * honest status message ON it. Showing "upgrade" to someone already paying
 * the most is the failure mode worth a test.
 */
import { limitCopy, describeReset, nextDailyReset, TOP_TIER } from './limit-messaging';

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
