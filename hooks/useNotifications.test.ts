/**
 * Tests for the lesson-expiry reminder and the identifier-scoped cancelling
 * it depends on.
 *
 * The thing most worth pinning here is that scheduling the daily streak
 * reminder no longer wipes every other scheduled notification. It used to end
 * with cancelAllScheduledNotificationsAsync(), which was harmless while it was
 * the only scheduler and would have silently deleted every expiry warning the
 * moment a second one existed.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LESSON_EXPIRY_WARNING_LEAD_MS,
  NOTIFICATION_ID_STREAK_SAVE,
  cancelLessonExpiryReminder,
  lessonExpiryNotificationId,
  scheduleLessonExpiryReminder,
  scheduleStreakSaveReminder,
} from './useNotifications';

const TTL_MS = 24 * 60 * 60 * 1000;
const LESSON = 'lesson-abc';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
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

describe('streak reminder no longer wipes other notifications', () => {
  it('cancels only its own identifier', async () => {
    await AsyncStorage.setItem('notifications:legacy-cancelled:v1', '1'); // migration already done
    await scheduleStreakSaveReminder({ streak: 3, xpEarnedToday: 0 });

    expect(mockCancelOne).toHaveBeenCalledWith(NOTIFICATION_ID_STREAK_SAVE);
    expect(mockCancelOne).not.toHaveBeenCalledWith(lessonExpiryNotificationId(LESSON));
    expect(mockCancelAll).not.toHaveBeenCalled();
    expect(mockSchedule.mock.calls[0][0].identifier).toBe(NOTIFICATION_ID_STREAK_SAVE);
  });

  it('runs the blanket legacy cancel exactly once per install', async () => {
    // Upgrading installs hold reminders under auto-generated ids that can't be
    // cancelled by name; they get one sweep, and never another.
    await scheduleStreakSaveReminder({ streak: 1, xpEarnedToday: 0 });
    expect(mockCancelAll).toHaveBeenCalledTimes(1);

    await scheduleStreakSaveReminder({ streak: 2, xpEarnedToday: 0 });
    await scheduleLessonExpiryReminder({
      lessonId: LESSON, lessonTitle: 'x', startedAt: startedSoWarningFiresAt(14), ttlMs: TTL_MS,
    });
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });
});
