import { localDayKey, localToday } from './dates';

describe('localDayKey', () => {
  it('formats from local calendar fields', () => {
    expect(localDayKey(new Date(2026, 2, 6, 21, 30, 0))).toBe('2026-03-06');
  });

  it('zero-pads month and day', () => {
    expect(localDayKey(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05');
  });

  it('stays on the local date late at night, unlike the UTC key', () => {
    // 23:30 local. In any zone at least an hour west of UTC the UTC date
    // has already rolled over — the local key must not.
    const d = new Date(2026, 6, 1, 23, 30, 0);
    expect(localDayKey(d)).toBe('2026-07-01');
    if (d.getTimezoneOffset() >= 60) {
      expect(d.toISOString().split('T')[0]).not.toBe('2026-07-01');
    }
  });

  it('stays on the local date just after local midnight', () => {
    const d = new Date(2026, 6, 2, 0, 15, 0);
    expect(localDayKey(d)).toBe('2026-07-02');
  });
});

describe('localToday', () => {
  it('uses the injected now', () => {
    expect(localToday(new Date(2025, 11, 31, 23, 59, 59))).toBe('2025-12-31');
  });

  it('defaults to the current time', () => {
    expect(localToday()).toBe(localDayKey(new Date()));
  });
});
