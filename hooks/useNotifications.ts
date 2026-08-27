/**
 * useNotifications — push-notification surface + scheduling.
 *
 * Key behavior change from the original: we no longer cold-fire the iOS
 * system permission prompt on app mount. The prompt is deferred until the
 * learner has seen value (post-first-lesson, via the PrePermissionSheet)
 * and explicitly accepts. This follows research showing pre-prompt patterns
 * lift opt-in rates ~2-3× (conversion-research.md §Invisible Details →
 * permission pre-prompts).
 *
 * The hook only READS the current permission status on mount. Requesting
 * the system prompt is an explicit action via `requestPermissionsExplicit()`.
 *
 * NOTE: no push token is fetched or stored. Every notification here is a
 * LOCAL scheduled one, which needs no token, and nothing server-side sends
 * remote push. Collecting a device identifier we never use is a privacy
 * liability (App Store data disclosure + GDPR minimisation), so the token
 * plumbing was removed. Re-add it in the same change that builds sending —
 * not before.
 *
 * The daily reminder carries NO streak or loss-aversion framing. Fluenci does
 * not track streaks, and "you're about to lose something" is precisely the
 * mechanic that decision is meant to avoid. The reminder's only personal hook
 * is the learner's Ideal L2 Self — a reason to practice, never a penalty for
 * not having.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Read CURRENT permission state only — never triggers a system prompt.
    if (Platform.OS !== 'web') {
      Notifications.getPermissionsAsync()
        .then(({ status }) => {
          setPermissionStatus(status);
        })
        .catch(() => {});
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground notification — handled by setNotificationHandler above.
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // User tapped notification — downstream navigation hook goes here.
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  /**
   * Explicit user-initiated permission request. Triggers the iOS system
   * prompt. Only call after a pre-prompt has explained the value.
   */
  const requestPermissionsExplicit = async (): Promise<Notifications.PermissionStatus> => {
    if (Platform.OS === 'web') return 'denied' as Notifications.PermissionStatus;
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    return status;
  };

  return {
    permissionStatus,
    permissionGranted: permissionStatus === 'granted',
    requestPermissionsExplicit,
    scheduleDailyPracticeReminder,
  };
}

// ─── Scheduling ──────────────────────────────────────────────────────────

/**
 * Stable notification identifiers.
 *
 * These exist because scheduling used to end with
 * `cancelAllScheduledNotificationsAsync()` — fine while the daily reminder was
 * the only scheduled notification, but it silently destroys any other one.
 * Naming each notification lets a scheduler replace only its own.
 */
export const NOTIFICATION_ID_DAILY_PRACTICE = 'daily-practice-reminder';

/**
 * The id this reminder shipped under while streaks existed. Installs upgrading
 * across that change still have one scheduled under the old name, and it can
 * only be cancelled by its original id — so keep cancelling it.
 */
const LEGACY_ID_STREAK_SAVE = 'streak-save-reminder';
export function lessonExpiryNotificationId(lessonId: string): string {
  return `lesson-expiry:${lessonId}`;
}

/**
 * One-time cleanup for installs that scheduled notifications under
 * auto-generated ids, before the identifiers above existed. Those can't be
 * cancelled by name, so without this a learner upgrading would keep a
 * duplicate daily reminder forever.
 */
const LEGACY_CANCEL_FLAG = 'notifications:legacy-cancelled:v1';

async function cancelLegacyScheduledOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(LEGACY_CANCEL_FLAG)) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(LEGACY_CANCEL_FLAG, '1');
  } catch (err) {
    console.warn('[notifications] legacy cancel failed:', err);
  }
}

/**
 * Cancel every scheduled notification for this device.
 *
 * Used on sign-out. The daily practice reminder embeds the learner's own
 * `idealL2Self` text, so leaving it scheduled means the next person to use the
 * device gets someone else's personal statement on their lock screen.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Cancel one notification by id. Absent ids are not an error. */
async function cancelById(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Nothing scheduled under that id — nothing to do.
  }
}

interface ScheduleDailyPracticeReminderParams {
  xpEarnedToday: number;
  /** Local hour (0-23). Clamped to [18, 22] — evening-only, before quiet hours. */
  preferredHour?: number;
  /** Learner's Ideal L2 Self (Dörnyei L2MSS). When present, enriches the
   * reminder body with a concrete, personalized reason to practice —
   * the strongest predictor of sustained effort per the research. */
  idealL2Self?: string | null;
}

/**
 * Trim an ideal-self sentence to a fragment safe for notification body.
 * Push notifications cap around 178 chars; we budget ~60 for the user's
 * fragment after the enclosing copy. Word-boundary ellipsis.
 */
function idealSelfFragment(idealL2Self: string, maxLen = 60): string {
  const cleaned = idealL2Self.trim().replace(/\.$/, '');
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : maxLen).trimEnd()}…`;
}

function dailyPracticeContent(
  idealL2Self?: string | null,
): { title: string; body: string } {
  const hasVision = typeof idealL2Self === 'string' && idealL2Self.trim().length > 0;

  if (hasVision) {
    return {
      title: "Time for today's practice",
      body: `A few minutes toward being the you who will ${idealSelfFragment(idealL2Self as string)}.`,
    };
  }
  return {
    title: "Time for today's practice",
    body: '5 minutes is enough to keep moving.',
  };
}

/**
 * Schedule the DAILY practice reminder. Idempotent: replaces only its own
 * notification. Silent no-op when:
 *   - Platform is web
 *   - Permission not granted
 *   - User already earned XP today (no reason to nag)
 */
export async function scheduleDailyPracticeReminder({
  xpEarnedToday,
  preferredHour = 21,
  idealL2Self,
}: ScheduleDailyPracticeReminderParams): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelLegacyScheduledOnce();
  // Replace only THIS reminder. A blanket cancel here would wipe pending
  // lesson-expiry warnings every time the home screen re-scheduled.
  await cancelById(NOTIFICATION_ID_DAILY_PRACTICE);
  // Retire the streak-era reminder still scheduled on upgrading installs.
  await cancelById(LEGACY_ID_STREAK_SAVE);

  if (xpEarnedToday > 0) return;

  const hour = Math.max(18, Math.min(preferredHour, 22));
  const { title, body } = dailyPracticeContent(idealL2Self);

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID_DAILY_PRACTICE,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}

// ─── Lesson expiry warning ───────────────────────────────────────────────

/**
 * How long before a mid-lesson snapshot resets to warn the learner. Two hours
 * is enough to actually come back and finish, without being so early that the
 * reminder is forgotten by the time it matters.
 */
export const LESSON_EXPIRY_WARNING_LEAD_MS = 2 * 60 * 60 * 1000;

/** Quiet hours — a 3am "your lesson is about to reset" helps nobody. */
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;

function isQuietHour(date: Date): boolean {
  const hour = date.getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

interface ScheduleLessonExpiryReminderParams {
  lessonId: string;
  lessonTitle: string;
  /** Epoch ms when the lesson session started — the expiry reference. */
  startedAt: number;
  /** Full life of a session; injected so it stays tied to the storage TTL. */
  ttlMs: number;
}

/**
 * Warn the learner before an unfinished lesson resets.
 *
 * Silent no-op on web, without permission, when the warning time has already
 * passed, or when it would land in quiet hours — in the last case the
 * progress still expires on schedule, we just don't wake anyone to say so.
 * Replacing an existing warning for the same lesson is safe: the identifier
 * is derived from the lesson id.
 */
export async function scheduleLessonExpiryReminder({
  lessonId,
  lessonTitle,
  startedAt,
  ttlMs,
}: ScheduleLessonExpiryReminderParams): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelLegacyScheduledOnce();

  const fireAt = new Date(startedAt + ttlMs - LESSON_EXPIRY_WARNING_LEAD_MS);
  if (fireAt.getTime() <= Date.now()) return;
  if (isQuietHour(fireAt)) return;

  await Notifications.scheduleNotificationAsync({
    identifier: lessonExpiryNotificationId(lessonId),
    content: {
      title: 'Finish your lesson today',
      body: `"${lessonTitle}" resets in 2 hours. Pick up where you left off.`,
      sound: false,
      data: { type: 'lesson-expiry', lessonId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

/** Drop the warning — the lesson was finished, or its progress was cleared. */
export async function cancelLessonExpiryReminder(lessonId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelById(lessonExpiryNotificationId(lessonId));
}

