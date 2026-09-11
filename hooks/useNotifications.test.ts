/**
 * Tests for the reminder scheduler and the lesson-expiry warning, and the
 * identifier-scoped cancelling both depend on.
 *
 * Two things are most worth pinning. First, scheduling never wipes every other
 * scheduled notification: it used to end with
 * cancelAllScheduledNotificationsAsync(), harmless while it was the only
 * scheduler and silently fatal to every expiry warning the moment a second one
 * existed. Second, `syncScheduledNotifications` is idempotent — it runs on
 * every prefs change and every foreground, so a run that left a duplicate
 * behind would compound all day.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LESSON_EXPIRY_WARNING_LEAD_MS,
  NOTIFICATION_ID_DAILY_PRACTICE,
  NOTIFICATION_IDS,
  REVIEWS_DUE_THRESHOLD,
  cacheWeekSummary,
  cancelLessonExpiryReminder,
  lessonExpiryNotificationId,
  notificationContent,
  scheduleLessonExpiryReminder,
  syncScheduledNotifications,
  type NotificationContext,
} from './useNotifications';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../lib/notification-prefs';

const TTL_MS = 24 * 60 * 60 * 1000;
const LESSON = 'lesson-abc';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date', WEEKLY: 'weekly' },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete store[k]; }),
      clear: jest.fn(async () => { store = {}; }),
    },
  };
});

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancelOne = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockCancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
const mockPerms = Notifications.getPermissionsAsync as jest.Mock;

/** A start time whose warning lands at a given hour today or tomorrow. */
function startedSoWarningFiresAt(hour: number): number {
  const fire = new Date();
  fire.setHours(hour, 0, 0, 0);
  if (fire.getTime() <= Date.now() + 60_000) fire.setDate(fire.getDate() + 1);
  return fire.getTime() - TTL_MS + LESSON_EXPIRY_WARNING_LEAD_MS;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPerms.mockResolvedValue({ status: 'granted' });
});

describe('scheduleLessonExpiryReminder', () => {
  it('schedules a warning ahead of the reset, under a lesson-scoped id', async () => {
    const startedAt = startedSoWarningFiresAt(14);
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'Core Vocabulary', startedAt, ttlMs: TTL_MS,
    });

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const req = mockSchedule.mock.calls[0][0];
    expect(req.identifier).toBe(lessonExpiryNotificationId(LESSON));
    expect(req.content.body).toContain('Core Vocabulary');
    // Fires LEAD_MS before the session's own expiry, not at some fixed hour.
    expect(req.trigger.date.getTime()).toBe(startedAt + TTL_MS - LESSON_EXPIRY_WARNING_LEAD_MS);
  });

  it('does not schedule when the warning time has already passed', async () => {
    // Session started 23h ago: the 2h warning was due an hour ago.
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'Late', startedAt: Date.now() - 23 * 60 * 60 * 1000, ttlMs: TTL_MS,
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('stays silent during quiet hours', async () => {
    // Progress still expires on schedule — we just don't wake anyone at 3am.
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'Nightowl', startedAt: startedSoWarningFiresAt(3), ttlMs: TTL_MS,
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does nothing without notification permission', async () => {
    mockPerms.mockResolvedValue({ status: 'denied' });
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'x', startedAt: startedSoWarningFiresAt(14), ttlMs: TTL_MS,
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('cancels by lesson-scoped id', async () => {
    await cancelLessonExpiryReminder(LESSON);
    expect(mockCancelOne).toHaveBeenCalledWith(lessonExpiryNotificationId(LESSON));
  });
});

// ─── Reminder scheduling ─────────────────────────────────────────────────

/** Every kind on, so a test that cares about one kind can switch off the rest. */
const ALL_ON: NotificationPrefs = {
  dailyGoal: { enabled: true, hour: 19, minute: 0 },
  reviewsDue: { enabled: true, hour: 8, minute: 30 },
  idealMoment: { enabled: true, hour: 18, minute: 0, weekday: 1 },
  weeklyRecap: { enabled: true, hour: 18, minute: 0, weekday: 1 },
};

const BASE: NotificationContext = {
  prefs: ALL_ON,
  minutesToday: 0,
  goalMinutes: 10,
  dueCount: 0,
};

/** Only the kind under test, so assertions are about it and nothing else. */
function only(kind: keyof NotificationPrefs): NotificationPrefs {
  return Object.fromEntries(
    Object.entries(ALL_ON).map(([k, v]) => [k, { ...v, enabled: k === kind }]),
  ) as NotificationPrefs;
}

function scheduledIds(): string[] {
  return mockSchedule.mock.calls.map((call) => call[0].identifier);
}

describe('syncScheduledNotifications', () => {
  beforeEach(() => cacheWeekSummary(null));

  it('cancels only the ids it owns', async () => {
    await AsyncStorage.setItem('notifications:legacy-cancelled:v1', '1'); // migration already done
    await syncScheduledNotifications(BASE);

    for (const id of Object.values(NOTIFICATION_IDS)) {
      expect(mockCancelOne).toHaveBeenCalledWith(id);
    }
    // The streak-era reminder must still be retired by its original id, or
    // upgrading installs keep firing it forever.
    expect(mockCancelOne).toHaveBeenCalledWith('streak-save-reminder');
    expect(mockCancelOne).not.toHaveBeenCalledWith(lessonExpiryNotificationId(LESSON));
    expect(mockCancelAll).not.toHaveBeenCalled();
  });

  it('runs the blanket legacy cancel exactly once per install', async () => {
    // Upgrading installs hold reminders under auto-generated ids that can't be
    // cancelled by name; they get one sweep, and never another.
    await syncScheduledNotifications(BASE);
    expect(mockCancelAll).toHaveBeenCalledTimes(1);

    await syncScheduledNotifications(BASE);
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'x', startedAt: startedSoWarningFiresAt(14), ttlMs: TTL_MS,
    });
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });

  it('does nothing without permission', async () => {
    mockPerms.mockResolvedValue({ status: 'denied' });
    await syncScheduledNotifications(BASE);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules nothing a learner switched off, but still cancels it', async () => {
    const off = Object.fromEntries(
      Object.entries(ALL_ON).map(([k, v]) => [k, { ...v, enabled: false }]),
    ) as NotificationPrefs;
    await syncScheduledNotifications({ ...BASE, prefs: off });
    expect(mockSchedule).not.toHaveBeenCalled();
    // …the cancel is what makes switching one off actually remove it.
    expect(mockCancelOne).toHaveBeenCalledWith(NOTIFICATION_IDS.dailyGoal);
  });

  it('keeps the old daily-practice id, so an upgrade replaces rather than duplicates', () => {
    expect(NOTIFICATION_IDS.dailyGoal).toBe(NOTIFICATION_ID_DAILY_PRACTICE);
  });

  it('is idempotent — two runs leave one of each kind', async () => {
    await syncScheduledNotifications({ ...BASE, prefs: only('dailyGoal') });
    const first = scheduledIds();
    mockSchedule.mockClear();
    await syncScheduledNotifications({ ...BASE, prefs: only('dailyGoal') });
    expect(scheduledIds()).toEqual(first);
    expect(new Set(scheduledIds()).size).toBe(scheduledIds().length);
  });

  describe('dailyGoal', () => {
    it('fires at the chosen time, not a hardcoded hour', async () => {
      const prefs = only('dailyGoal');
      prefs.dailyGoal = { enabled: true, hour: 7, minute: 45 };
      await syncScheduledNotifications({ ...BASE, prefs });

      const req = mockSchedule.mock.calls[0][0];
      expect(req.identifier).toBe(NOTIFICATION_ID_DAILY_PRACTICE);
      expect(req.trigger).toEqual({ type: 'daily', hour: 7, minute: 45 });
    });

    it('is skipped once the goal is met — the call XP used to make', async () => {
      await syncScheduledNotifications({
        ...BASE, prefs: only('dailyGoal'), minutesToday: 10, goalMinutes: 10,
      });
      expect(scheduledIds()).not.toContain(NOTIFICATION_ID_DAILY_PRACTICE);
    });

    it('still fires while the goal is short', async () => {
      await syncScheduledNotifications({
        ...BASE, prefs: only('dailyGoal'), minutesToday: 9.5, goalMinutes: 10,
      });
      expect(scheduledIds()).toContain(NOTIFICATION_ID_DAILY_PRACTICE);
    });
  });

  describe('reviewsDue', () => {
    it('stays quiet below the threshold', async () => {
      await syncScheduledNotifications({
        ...BASE, prefs: only('reviewsDue'), dueCount: REVIEWS_DUE_THRESHOLD - 1,
      });
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('fires at the threshold, at its own time', async () => {
      await syncScheduledNotifications({
        ...BASE, prefs: only('reviewsDue'), dueCount: REVIEWS_DUE_THRESHOLD,
      });
      const req = mockSchedule.mock.calls[0][0];
      expect(req.identifier).toBe(NOTIFICATION_IDS.reviewsDue);
      expect(req.trigger).toEqual({ type: 'daily', hour: 8, minute: 30 });
      expect(req.content.body).toContain(String(REVIEWS_DUE_THRESHOLD));
    });
  });

  it('gives the weekly kinds a WEEKLY trigger carrying the chosen weekday', async () => {
    const prefs = only('idealMoment');
    prefs.idealMoment = { enabled: true, hour: 20, minute: 15, weekday: 4 };
    await syncScheduledNotifications({ ...BASE, prefs });

    expect(mockSchedule.mock.calls[0][0].trigger).toEqual({
      type: 'weekly', weekday: 4, hour: 20, minute: 15,
    });
  });

  it('reads prefs from storage when none are passed', async () => {
    // Defaults have weeklyRecap off; if the loader were skipped it would be on.
    expect(DEFAULT_NOTIFICATION_PREFS.weeklyRecap.enabled).toBe(false);
    await syncScheduledNotifications({ minutesToday: 0, goalMinutes: 10, dueCount: 0 });
    expect(scheduledIds()).not.toContain(NOTIFICATION_IDS.weeklyRecap);
    expect(scheduledIds()).toContain(NOTIFICATION_IDS.idealMoment);
  });
});

describe('notification copy', () => {
  beforeEach(() => cacheWeekSummary(null));

  it('never frames absence as loss', () => {
    const kinds = ['dailyGoal', 'reviewsDue', 'idealMoment', 'weeklyRecap'] as const;
    for (const kind of kinds) {
      const content = notificationContent(kind, {
        ...BASE, idealL2Self: 'order coffee in Lisbon', dueCount: 12,
      });
      const text = `${content?.title} ${content?.body}`.toLowerCase();
      for (const banned of ['streak', 'lose', 'lost', 'miss out', 'falling behind', 'heart']) {
        expect(text).not.toContain(banned);
      }
    }
  });

  it("builds the ideal-moment line from the learner's own reason", () => {
    const content = notificationContent('idealMoment', {
      ...BASE, idealL2Self: 'order coffee in Lisbon without switching to English',
    });
    expect(content?.body).toContain('order coffee in Lisbon');
  });

  it('falls back to a plain line when there is no goal and no week', () => {
    const content = notificationContent('idealMoment', BASE);
    expect(content?.body).toBe('Pick one thing you want to be able to say, and practise saying it.');
  });

  it("folds this week's words in when Home has published them", () => {
    cacheWeekSummary({ minutes: 42, words: 7 });
    const content = notificationContent('idealMoment', { ...BASE, idealL2Self: 'read a novel' });
    expect(content?.body).toContain('7 new words this week');
  });

  it('reports minutes, words and level in the weekly recap', () => {
    cacheWeekSummary({ minutes: 42.7, words: 7 });
    const content = notificationContent('weeklyRecap', { ...BASE, band: 'B1' });
    expect(content?.body).toContain('43 minutes practised');
    expect(content?.body).toContain('7 new words');
    // A bare band must never render on its own (CLAUDE.md §1).
    expect(content?.body).toContain('B1 ·');
  });

  it('says something true when the week is empty', () => {
    const content = notificationContent('weeklyRecap', BASE);
    expect(content?.body).toBe('A fresh week starts today.');
  });

  it('keeps every body inside the push length budget', () => {
    cacheWeekSummary({ minutes: 999, words: 999 });
    const long =
      'be able to hold a long technical conversation about distributed systems with colleagues in Buenos Aires without ever reaching for English';
    for (const kind of ['dailyGoal', 'reviewsDue', 'idealMoment', 'weeklyRecap'] as const) {
      const content = notificationContent(kind, {
        ...BASE, idealL2Self: long, topMistakeLabel: long, dueCount: 999, band: 'C2',
      });
      expect(content!.body.length).toBeLessThanOrEqual(178);
    }
  });
});
