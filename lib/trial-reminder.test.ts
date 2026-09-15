import {
  NO_TRIAL,
  TRIAL_REMINDER_HOUR,
  TRIAL_REMINDER_MIN_LEAD_MS,
  trialReminderContent,
  trialReminderFireAt,
  trialStateFromEntitlements,
} from './trial-reminder';
import { REMINDER_LEAD_DAYS } from './trial-timeline';

const DAY = 24 * 60 * 60 * 1000;

/** A local-time Date, so the 10:00 rule is tested in the zone jest runs in. */
function at(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

describe('trialStateFromEntitlements', () => {
  it('is NO_TRIAL when nothing is active or nothing is a trial', () => {
    expect(trialStateFromEntitlements([])).toEqual(NO_TRIAL);
    expect(
      trialStateFromEntitlements([
        { isActive: true, periodType: 'NORMAL', expirationDate: '2026-10-01T00:00:00Z' },
        { isActive: false, periodType: 'TRIAL', expirationDate: '2026-09-20T00:00:00Z' },
      ]),
    ).toEqual(NO_TRIAL);
  });

  it('reads the trial expiry and keeps the earliest of several', () => {
    const state = trialStateFromEntitlements([
      { isActive: true, periodType: 'TRIAL', expirationDate: '2026-09-20T10:00:00Z' },
      { isActive: true, periodType: 'TRIAL', expirationDate: '2026-09-18T10:00:00Z' },
    ]);
    expect(state.isTrial).toBe(true);
    expect(state.expiresAt).toBe('2026-09-18T10:00:00.000Z');
  });

  it('ignores an unparseable expiry rather than scheduling on garbage', () => {
    expect(
      trialStateFromEntitlements([{ isActive: true, periodType: 'TRIAL', expirationDate: 'soon' }]),
    ).toEqual(NO_TRIAL);
  });
});

describe('trialReminderFireAt', () => {
  const now = at(2026, 9, 11, 9);

  it('lands two days before expiry at the reminder hour', () => {
    const expiry = at(2026, 9, 18, 15).toISOString();
    const fire = trialReminderFireAt(expiry, now);
    expect(fire).not.toBeNull();
    expect(fire!.getHours()).toBe(TRIAL_REMINDER_HOUR);
    expect(fire!.getDate()).toBe(18 - REMINDER_LEAD_DAYS);
  });

  it('moves to the next morning when the ideal slot has passed', () => {
    // Trial ends tomorrow at 15:00; the two-day-lead slot is in the past.
    const expiry = at(2026, 9, 12, 15).toISOString();
    const fire = trialReminderFireAt(expiry, now);
    expect(fire!.getDate()).toBe(11);
    expect(fire!.getHours()).toBe(TRIAL_REMINDER_HOUR);
    expect(fire!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('falls back to one hour from now when no morning fits', () => {
    const late = at(2026, 9, 11, 20);
    const expiry = new Date(late.getTime() + 5 * 60 * 60 * 1000).toISOString();
    const fire = trialReminderFireAt(expiry, late);
    expect(fire!.getTime()).toBe(late.getTime() + TRIAL_REMINDER_MIN_LEAD_MS);
  });

  it('is null when the charge is under an hour away, already past, or unknown', () => {
    expect(trialReminderFireAt(new Date(now.getTime() + 30 * 60 * 1000).toISOString(), now)).toBeNull();
    expect(trialReminderFireAt(new Date(now.getTime() - DAY).toISOString(), now)).toBeNull();
    expect(trialReminderFireAt(null, now)).toBeNull();
    expect(trialReminderFireAt('not a date', now)).toBeNull();
  });
});

describe('trialReminderContent', () => {
  const now = at(2026, 9, 11, 9);

  it('says when, and points at the App Store rather than at a price', () => {
    const { title, body } = trialReminderContent(at(2026, 9, 13, 9).toISOString(), now);
    expect(title).toMatch(/^Your free trial ends on /);
    expect(body).toMatch(/App Store/);
    expect(body).not.toMatch(/\$|\d+\.\d\d/);
  });

  it('uses "tomorrow" and "today" at the edge', () => {
    expect(trialReminderContent(at(2026, 9, 12, 9).toISOString(), now).title).toBe(
      'Your free trial ends tomorrow',
    );
    expect(trialReminderContent(at(2026, 9, 11, 23).toISOString(), now).title).toBe(
      'Your free trial ends today',
    );
  });

  it('carries no loss framing or urgency words', () => {
    const { title, body } = trialReminderContent(at(2026, 9, 13, 9).toISOString(), now);
    expect(`${title} ${body}`).not.toMatch(/lose|hurry|last chance|don't miss|only \d/i);
  });
});
