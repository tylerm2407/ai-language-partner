import { formatRelativeDay, localDayKey, localToday } from './dates';

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

describe('formatRelativeDay', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) =>
    new Date(y, m, d, h, min, 0);
  const iso = (d: Date) => d.toISOString();

  it('names today and yesterday', () => {
    const now = at(2026, 7, 26, 8, 32);
    expect(formatRelativeDay(iso(at(2026, 7, 26, 1, 5)), now)).toBe('Today');
    expect(formatRelativeDay(iso(at(2026, 7, 25, 23, 59)), now)).toBe('Yesterday');
  });

  it('counts calendar days, not elapsed 24h blocks', () => {
    // The bug this replaces: 3 PM Monday read as "Yesterday" until 3 PM
    // Wednesday, because 1.86 elapsed days floors to 1.
    const now = at(2026, 7, 26, 8, 32);
    expect(formatRelativeDay(iso(at(2026, 7, 24, 14, 53)), now)).toBe('2 days ago');
    expect(formatRelativeDay(iso(at(2026, 7, 23, 13, 29)), now)).toBe('3 days ago');
  });

  it('treats a one-minute-old crossing of midnight as yesterday', () => {
    const now = at(2026, 7, 26, 0, 0);
    expect(formatRelativeDay(iso(at(2026, 7, 25, 23, 59)), now)).toBe('Yesterday');
  });

  it('switches to an absolute date after a week', () => {
    const now = at(2026, 7, 26, 8, 0);
    expect(formatRelativeDay(iso(at(2026, 7, 20, 8, 0)), now)).toBe('6 days ago');
    // 7 days out is the first absolute one; assert the shape, not the locale.
    const weekOld = formatRelativeDay(iso(at(2026, 7, 19, 8, 0)), now);
    expect(weekOld).not.toMatch(/ago|Today|Yesterday/);
    expect(weekOld).not.toMatch(/2026/);
  });

  it('adds the year only for a different calendar year', () => {
    const now = at(2026, 7, 26, 8, 0);
    expect(formatRelativeDay(iso(at(2024, 3, 23, 8, 0)), now)).toMatch(/2024/);
  });

  it('floors a future timestamp to today rather than counting up', () => {
    const now = at(2026, 7, 26, 8, 0);
    expect(formatRelativeDay(iso(at(2026, 7, 28, 8, 0)), now)).toBe('Today');
  });

  it('does not throw on an unparseable timestamp', () => {
    expect(formatRelativeDay('not-a-date', at(2026, 7, 26))).toBe('Unknown date');
  });
});
