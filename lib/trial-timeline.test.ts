/**
 * Unit tests for lib/trial-timeline.ts.
 *
 * The load-bearing property is that the timeline never shows a reminder on or
 * before day 0, and never after the charge — a timeline that misstates the
 * billing sequence is worse than no timeline at all, because the whole point is
 * that the user can trust it.
 */
import { trialTimelineSteps, trialDaysFromPeriod, REMINDER_LEAD_DAYS } from './trial-timeline';

describe('trialTimelineSteps', () => {
  it('puts the reminder two days before the charge on a 7-day trial', () => {
    const steps = trialTimelineSteps(7, '$59.99');
    expect(steps.map((s) => s.day)).toEqual([0, 5, 7]);
    expect(steps[2].detail).toContain('$59.99');
  });

  it('always renders exactly three steps in chronological order', () => {
    for (const days of [1, 2, 3, 7, 14, 30, 365]) {
      const steps = trialTimelineSteps(days, '$1');
      expect(steps).toHaveLength(3);
      expect(steps[0].day).toBeLessThanOrEqual(steps[1].day);
      expect(steps[1].day).toBeLessThanOrEqual(steps[2].day);
    }
  });

  it('never places the reminder on or before day 0, even on a 1-day trial', () => {
    for (const days of [1, 2, 3]) {
      const steps = trialTimelineSteps(days, '$1');
      expect(steps[1].day).toBeGreaterThanOrEqual(1);
    }
  });

  it('never places the reminder after the charge', () => {
    for (const days of [1, 2, 3, 7, 30]) {
      const steps = trialTimelineSteps(days, '$1');
      expect(steps[1].day).toBeLessThanOrEqual(steps[2].day);
    }
  });

  it('ends on the real trial length', () => {
    expect(trialTimelineSteps(14, '$1')[2].day).toBe(14);
    expect(trialTimelineSteps(14, '$1')[1].day).toBe(14 - REMINDER_LEAD_DAYS);
  });

  it('clamps nonsense input rather than emitting negative days', () => {
    for (const bad of [0, -5, 0.4]) {
      const steps = trialTimelineSteps(bad, '$1');
      expect(steps[2].day).toBe(1);
      expect(steps.every((s) => s.day >= 0)).toBe(true);
    }
  });

  it('states that no charge happens today', () => {
    expect(trialTimelineSteps(7, '$1')[0].detail).toMatch(/not charged/i);
  });
});

describe('trialDaysFromPeriod', () => {
  it('converts each period unit to days', () => {
    expect(trialDaysFromPeriod('DAY', 7)).toBe(7);
    expect(trialDaysFromPeriod('WEEK', 1)).toBe(7);
    expect(trialDaysFromPeriod('MONTH', 1)).toBe(30);
    expect(trialDaysFromPeriod('YEAR', 1)).toBe(365);
  });

  it('accepts lowercase units', () => {
    expect(trialDaysFromPeriod('day', 3)).toBe(3);
  });

  it('returns null when there is no usable period', () => {
    expect(trialDaysFromPeriod(null, 7)).toBeNull();
    expect(trialDaysFromPeriod('DAY', null)).toBeNull();
    expect(trialDaysFromPeriod('DAY', 0)).toBeNull();
    expect(trialDaysFromPeriod('DAY', -1)).toBeNull();
    expect(trialDaysFromPeriod('FORTNIGHT', 1)).toBeNull();
  });
});
