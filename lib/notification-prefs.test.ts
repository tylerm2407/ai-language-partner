/**
 * These prefs are written by onboarding, edited in Settings, and read by the
 * scheduler — three places, one blob, and the only thing standing between a
 * drifted shape and a reminder that fires at 27:00 is `validateNotificationPrefs`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_KINDS,
  SUNDAY,
  isWeeklyKind,
  loadNotificationPrefs,
  saveNotificationPrefs,
  validateNotificationPrefs,
  type NotificationPrefs,
} from './notification-prefs';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
});

describe('defaults', () => {
  it('matches the shipped decision', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.dailyGoal).toEqual({ enabled: true, hour: 19, minute: 0 });
    expect(DEFAULT_NOTIFICATION_PREFS.reviewsDue).toEqual({ enabled: true, hour: 8, minute: 30 });
    expect(DEFAULT_NOTIFICATION_PREFS.idealMoment).toEqual({
      enabled: true, hour: 18, minute: 0, weekday: SUNDAY,
    });
    // The one that reports rather than invites stays off until asked for.
    expect(DEFAULT_NOTIFICATION_PREFS.weeklyRecap.enabled).toBe(false);
  });

  it('gives a weekday to the weekly kinds and none to the daily ones', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const pref = DEFAULT_NOTIFICATION_PREFS[kind];
      expect(pref.weekday === undefined).toBe(!isWeeklyKind(kind));
    }
  });
});

describe('validateNotificationPrefs', () => {
  it('returns the defaults for junk', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      expect(validateNotificationPrefs(junk)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    }
  });

  it('keeps valid values', () => {
    const stored = {
      ...DEFAULT_NOTIFICATION_PREFS,
      reviewsDue: { enabled: false, hour: 6, minute: 45 },
    };
    expect(validateNotificationPrefs(stored).reviewsDue).toEqual({
      enabled: false, hour: 6, minute: 45,
    });
  });

  it('falls back PER FIELD, so one bad value does not reset the rest', () => {
    const result = validateNotificationPrefs({
      dailyGoal: { enabled: false, hour: 27, minute: 15 },
    });
    expect(result.dailyGoal).toEqual({
      enabled: false, // kept
      hour: DEFAULT_NOTIFICATION_PREFS.dailyGoal.hour, // 27 rejected
      minute: 15, // kept
    });
  });

  it('rejects out-of-range hours, minutes and weekdays', () => {
    const result = validateNotificationPrefs({
      dailyGoal: { hour: -1, minute: 60 },
      idealMoment: { weekday: 8 },
      weeklyRecap: { weekday: 0 },
    });
    expect(result.dailyGoal.hour).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.hour);
    expect(result.dailyGoal.minute).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.minute);
    expect(result.idealMoment.weekday).toBe(SUNDAY);
    expect(result.weeklyRecap.weekday).toBe(SUNDAY);
  });

  it('rejects a non-boolean enabled rather than coercing it', () => {
    // `enabled: 0` from a drifted blob must not silently read as "off" — or as
    // "on", which is what a truthiness check on the string "false" would give.
    expect(validateNotificationPrefs({ dailyGoal: { enabled: 0 } }).dailyGoal.enabled).toBe(true);
    expect(validateNotificationPrefs({ weeklyRecap: { enabled: 'true' } }).weeklyRecap.enabled).toBe(false);
  });

  it('strips a weekday off the daily kinds and adds one to the weekly kinds', () => {
    const result = validateNotificationPrefs({
      dailyGoal: { enabled: true, hour: 19, minute: 0, weekday: 3 },
      idealMoment: { enabled: true, hour: 18, minute: 0 },
    });
    expect(result.dailyGoal.weekday).toBeUndefined();
    expect(result.idealMoment.weekday).toBe(SUNDAY);
  });

  it('rounds a fractional hour rather than storing one a trigger cannot use', () => {
    expect(validateNotificationPrefs({ dailyGoal: { hour: 19.4 } }).dailyGoal.hour).toBe(19);
  });
});

describe('load / save', () => {
  it('returns the defaults when nothing is stored', async () => {
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns the defaults when the stored blob is unparseable', async () => {
    mockGet.mockResolvedValue('{not json');
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns the defaults when the read itself throws', async () => {
    mockGet.mockRejectedValue(new Error('storage unavailable'));
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('round-trips what was saved', async () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      dailyGoal: { enabled: false, hour: 7, minute: 5 },
      weeklyRecap: { enabled: true, hour: 20, minute: 30, weekday: 6 },
    };
    await saveNotificationPrefs(prefs);
    mockGet.mockResolvedValue(mockSet.mock.calls[0][1]);
    await expect(loadNotificationPrefs()).resolves.toEqual(prefs);
  });

  it('validates on the way IN, so a bad value never reaches storage', async () => {
    await saveNotificationPrefs({
      ...DEFAULT_NOTIFICATION_PREFS,
      dailyGoal: { enabled: true, hour: 99, minute: 0 },
    });
    const written = JSON.parse(mockSet.mock.calls[0][1]);
    expect(written.dailyGoal.hour).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.hour);
  });

  it('surfaces a write failure instead of pretending the toggle saved', async () => {
    mockSet.mockRejectedValue(new Error('disk full'));
    await expect(saveNotificationPrefs(DEFAULT_NOTIFICATION_PREFS)).rejects.toThrow('disk full');
  });
});
