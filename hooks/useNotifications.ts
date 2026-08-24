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
 * Streak-save reminder content is bucketed by streak length:
 *   - 0–1:   gentle nudge, no loss-aversion framing (Lally 2010 fragile window)
 *   - 2–6:   "keep it going" framing
 *   - 7+:    streak-at-risk framing (loss aversion now load-bearing)
 *   - 30+:   streak-at-risk + humor so long-streak users don't feel guilted
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
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

interface UseNotificationsOptions {
  userId?: string | undefined;
}

export function useNotifications({ userId }: UseNotificationsOptions = {}) {
  const [pushToken, setPushToken] = useState<string | null>(null);
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
          // If permission was granted in a prior session, we can safely
          // re-fetch the push token (no system UI involved).
          if (status === 'granted') {
            Notifications.getExpoPushTokenAsync()
              .then((tokenData) => {
                setPushToken(tokenData.data);
                if (userId) savePushToken(userId, tokenData.data);
              })
              .catch(() => {
                // Token fetch can fail on simulators / missing FCM config — silent.
              });
          }
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
  }, [userId]);

  /**
   * Explicit user-initiated permission request. Triggers the iOS system
   * prompt. Only call after a pre-prompt has explained the value.
   */
  const requestPermissionsExplicit = async (): Promise<Notifications.PermissionStatus> => {
    if (Platform.OS === 'web') return 'denied' as Notifications.PermissionStatus;
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        setPushToken(tokenData.data);
        if (userId) await savePushToken(userId, tokenData.data);
      } catch {
        // Token fetch optional.
      }
    }
    return status;
  };

  return {
    pushToken,
    permissionStatus,
    permissionGranted: permissionStatus === 'granted',
    requestPermissionsExplicit,
    scheduleStreakSaveReminder,
  };
}

// ─── Scheduling ──────────────────────────────────────────────────────────

/**
 * Stable notification identifiers.
 *
 * These exist because scheduling used to end with
 * `cancelAllScheduledNotificationsAsync()` — fine while the daily streak
 * reminder was the only scheduled notification, but it silently destroys any
 * other one. Naming each notification lets a scheduler replace only its own.
 */
export const NOTIFICATION_ID_STREAK_SAVE = 'streak-save-reminder';
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

/** Cancel one notification by id. Absent ids are not an error. */
async function cancelById(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Nothing scheduled under that id — nothing to do.
  }
}

interface ScheduleStreakSaveReminderParams {
  streak: number;
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

function streakSaveContent(
  streak: number,
  idealL2Self?: string | null,
): { title: string; body: string } {
  const hasVision = typeof idealL2Self === 'string' && idealL2Self.trim().length > 0;
  const visionBody = hasVision
    ? `The you who will ${idealSelfFragment(idealL2Self as string)} — don't lose today.`
    : null;

  // Research-backed milestones (research.md §12): 30 days = meaningful
  // milestone, 66 days = habit is automatic (Lally et al.), 100 days = rare
  // territory. Celebrate these, then fall through to normal streak copy.
  if (streak === 100) {
    return {
      title: '100 days 🎉 You are officially that person',
      body: hasVision
        ? `Still on track to ${idealSelfFragment(idealL2Self as string)}. Keep going.`
        : "100 straight days. That's who you are now.",
    };
  }
  if (streak === 66) {
    return {
      title: '66 days — your habit is automatic',
      body: hasVision
        ? `Every day of the last 66 got you closer to ${idealSelfFragment(idealL2Self as string)}.`
        : "Science says habits lock in around day 66. You're locked in.",
    };
  }
  if (streak === 30) {
    return {
      title: '30-day streak 🔥 Major milestone',
      body: hasVision
        ? `One month closer to ${idealSelfFragment(idealL2Self as string)}.`
        : 'You just crossed the hardest threshold. Keep the streak.',
    };
  }

  if (streak >= 30) {
    return {
      title: `Your ${streak}-day streak is on the line 🔥`,
      body: visionBody ?? "Lumi's watching. Two minutes saves it.",
    };
  }
  if (streak >= 7) {
    return {
      title: `Your ${streak}-day streak is on the line 🔥`,
      body: visionBody ?? 'Two minutes saves it. Tap to practice.',
    };
  }
  if (streak >= 2) {
    return {
      title: `Day ${streak} — keep it going 🔥`,
      body: visionBody ?? 'A quick lesson locks in your streak.',
    };
  }
  return {
    title: "Time for today's practice",
    body: visionBody ?? '5 minutes keeps the habit going.',
  };
}

/**
 * Schedule a DAILY reminder tuned to the learner's streak bucket. Idempotent:
 * cancels all prior scheduled notifications first. Silent no-op when:
 *   - Platform is web
 *   - Permission not granted
 *   - User already earned XP today (no reason to nag)
 */
export async function scheduleStreakSaveReminder({
  streak,
  xpEarnedToday,
  preferredHour = 21,
  idealL2Self,
}: ScheduleStreakSaveReminderParams): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelLegacyScheduledOnce();
  // Replace only THIS reminder. A blanket cancel here would wipe pending
  // lesson-expiry warnings every time the home screen re-scheduled.
  await cancelById(NOTIFICATION_ID_STREAK_SAVE);

  if (xpEarnedToday > 0) return;

  const hour = Math.max(18, Math.min(preferredHour, 22));
  const { title, body } = streakSaveContent(streak, idealL2Self);

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID_STREAK_SAVE,
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

async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase
      .from('user_profiles')
      .update({ push_token: token })
      .eq('user_id', userId);
  } catch {
    // Silently fail — push token is nice-to-have, not critical.
  }
}
