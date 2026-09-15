/**
 * useNotifications — notification surface + scheduling.
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
 * WHAT GETS SCHEDULED IS NOW THE LEARNER'S CHOICE
 *
 * There used to be exactly one reminder, fired unless XP had been earned that
 * day. XP is not shown to learners any more (CLAUDE.md §1), so gating a
 * reminder on it meant the trigger and the thing the learner sees had nothing
 * to do with each other. The four kinds in `lib/notification-prefs.ts` replace
 * it, each with its own switch and time, and the daily one is now gated on the
 * actual daily goal — minutes practised against `daily_goal_minutes`.
 *
 * NONE of them carries streak or loss-aversion framing. Fluenci has no streaks
 * and "you're about to lose something" is precisely the mechanic that decision
 * was meant to avoid. The personal hooks are the learner's Ideal L2 Self, the
 * mistake they keep making, and the work actually waiting for them — reasons to
 * practice, never penalties for not having.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { idealSelfFragment, reminderCopy } from '../lib/insights';
import { cefrLabel } from '../lib/cefr-labels';
import { goalProgress, displayMinutes } from '../lib/active-time';
import {
  loadNotificationPrefs,
  NOTIFICATION_KINDS,
  isWeeklyKind,
  SUNDAY,
  type NotificationKind,
  type NotificationPref,
  type NotificationPrefs,
} from '../lib/notification-prefs';
import {
  TRIAL_REMINDER_ID,
  trialReminderContent,
  trialReminderFireAt,
  type TrialState,
} from '../lib/trial-reminder';

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
    syncScheduledNotifications,
  };
}

// ─── Identifiers ─────────────────────────────────────────────────────────

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
 * One id per kind. `dailyGoal` deliberately keeps the old practice-reminder id:
 * an upgrading install already has one scheduled under that name, and reusing
 * it replaces that reminder in place instead of leaving it firing beside the
 * new one forever.
 */
export const NOTIFICATION_IDS: Record<NotificationKind, string> = {
  dailyGoal: NOTIFICATION_ID_DAILY_PRACTICE,
  reviewsDue: 'reviews-due-reminder',
  idealMoment: 'ideal-moment-reminder',
  weeklyRecap: 'weekly-recap-reminder',
};

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
 * Used on sign-out. The reminders embed the learner's own `idealL2Self` text,
 * so leaving them scheduled means the next person to use the device gets
 * someone else's personal statement on their lock screen.
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

// ─── Week summary cache ──────────────────────────────────────────────────

export interface WeekSummary {
  /** Minutes practised Monday-to-today. */
  minutes: number;
  /** New cards learned Monday-to-today. */
  words: number;
}

let cachedWeekSummary: WeekSummary | null = null;

/**
 * Hand the scheduler this week's totals.
 *
 * Same arrangement as `readCachedTopMistake`: Home already fetches the week for
 * the strip, and the root layout — which re-arms the reminders on foreground —
 * has no business running that query again just to word a notification. Home
 * publishes what it loaded; the scheduler reads it if it is there and falls
 * back to copy that needs no numbers if it is not.
 */
export function cacheWeekSummary(summary: WeekSummary | null): void {
  cachedWeekSummary = summary;
}

// ─── Scheduling ──────────────────────────────────────────────────────────

/**
 * Cards due before the review reminder is worth sending. Below this the queue
 * clears itself in the next ordinary session, and a notification about three
 * cards trains people to ignore the ones that matter.
 */
export const REVIEWS_DUE_THRESHOLD = 10;

export interface NotificationContext {
  /** Loaded from AsyncStorage when omitted. */
  prefs?: NotificationPrefs;
  /** `daily_stats.minutes_practiced` for today. */
  minutesToday: number;
  /** `user_profiles.daily_goal_minutes`. */
  goalMinutes: number;
  /** SRS cards due right now. */
  dueCount: number;
  /** Learner's Ideal L2 Self (Dörnyei L2MSS) — the strongest personal hook. */
  idealL2Self?: string | null;
  /** The mistake the learner keeps making, from the insights read cache. */
  topMistakeLabel?: string | null;
  /** CEFR band for the weekly recap. Never rendered bare — see `cefrLabel`. */
  band?: string | null;
  /** Overrides the cached week totals; mainly for tests. */
  weekSummary?: WeekSummary | null;
}

interface NotificationBody {
  title: string;
  body: string;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Copy for one kind, or null when there is nothing worth saying.
 *
 * Exported for tests — the wording is the product here, and a reminder that
 * quietly regresses into guilt framing is not something a type check catches.
 */
export function notificationContent(
  kind: NotificationKind,
  ctx: NotificationContext,
): NotificationBody | null {
  const goal = typeof ctx.idealL2Self === 'string' ? ctx.idealL2Self.trim() : '';
  const week = ctx.weekSummary ?? cachedWeekSummary;
  const words = week?.words ?? 0;

  switch (kind) {
    case 'dailyGoal':
      // The goal decides WHETHER this fires, not what it says: `reminderCopy`
      // already rotates through the learner's own reasons by calendar day, and
      // "you are 8 minutes short" is the shape of copy this app avoids.
      return reminderCopy({
        idealL2Self: ctx.idealL2Self,
        dueCount: ctx.dueCount,
        topMistakeLabel: ctx.topMistakeLabel,
      });

    case 'reviewsDue':
      return {
        title: 'Your reviews are ready',
        body: `${ctx.dueCount} ${plural(ctx.dueCount, 'word is', 'words are')} due. A few minutes clears the queue.`,
      };

    case 'idealMoment': {
      if (goal) {
        const tail = words > 0 ? ` ${words} new ${plural(words, 'word', 'words')} this week.` : '';
        return {
          title: 'Why you started',
          body: `Toward being the you who will ${idealSelfFragment(goal, 70)}.${tail}`,
        };
      }
      if (words > 0) {
        return {
          title: 'Your week in words',
          body: `${words} new ${plural(words, 'word', 'words')} this week. Pick one and say it out loud.`,
        };
      }
      return {
        title: 'A few minutes this week',
        body: 'Pick one thing you want to be able to say, and practise saying it.',
      };
    }

    case 'weeklyRecap': {
      const parts: string[] = [];
      const minutes = displayMinutes(week?.minutes ?? 0);
      if (minutes > 0) parts.push(`${minutes} ${plural(minutes, 'minute', 'minutes')} practised`);
      if (words > 0) parts.push(`${words} new ${plural(words, 'word', 'words')}`);
      // Never a bare band (CLAUDE.md §1): `cefrLabel` pairs it with its can-do
      // line, trimmed here to fit a notification body.
      const level = cefrLabel(ctx.band);
      if (level) parts.push(idealSelfFragment(level, 80));
      return {
        title: 'Your week',
        body: parts.length > 0 ? parts.join(' · ') : 'A fresh week starts today.',
      };
    }
  }
}

/** Does this kind have anything to say today? */
function shouldFire(kind: NotificationKind, ctx: NotificationContext): boolean {
  switch (kind) {
    // Replaces the old `xpEarnedToday > 0` rule with the thing the learner is
    // actually shown: the goal ring on Home. Met means no reminder.
    case 'dailyGoal':
      return !goalProgress(ctx.minutesToday, ctx.goalMinutes).met;
    case 'reviewsDue':
      return ctx.dueCount >= REVIEWS_DUE_THRESHOLD;
    case 'idealMoment':
    case 'weeklyRecap':
      return true;
  }
}

function triggerFor(
  kind: NotificationKind,
  pref: NotificationPref,
): Notifications.NotificationTriggerInput {
  if (isWeeklyKind(kind)) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: pref.weekday ?? SUNDAY,
      hour: pref.hour,
      minute: pref.minute,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: pref.hour,
    minute: pref.minute,
  };
}

/**
 * Cancel and re-schedule every kind from the learner's preferences.
 *
 * Idempotent by construction: each kind is cancelled by its own id and then
 * re-scheduled if (and only if) it is enabled and has something to say, so
 * calling this on every prefs change and every foreground converges on one
 * correct set rather than accumulating duplicates. It never touches ids it does
 * not own — a blanket cancel here would wipe the pending lesson-expiry warnings
 * every time Home re-armed.
 *
 * Silent no-op on web and without permission.
 */
export async function syncScheduledNotifications(ctx: NotificationContext): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelLegacyScheduledOnce();
  // Retire the streak-era reminder still scheduled on upgrading installs.
  await cancelById(LEGACY_ID_STREAK_SAVE);

  const prefs = ctx.prefs ?? (await loadNotificationPrefs());

  for (const kind of NOTIFICATION_KINDS) {
    const identifier = NOTIFICATION_IDS[kind];
    await cancelById(identifier);

    const pref = prefs[kind];
    if (!pref.enabled) continue;
    if (!shouldFire(kind, ctx)) continue;

    const content = notificationContent(kind, ctx);
    if (!content) continue;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: content.title, body: content.body, sound: true },
      trigger: triggerFor(kind, pref),
    });
  }
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

// ─── Trial-ending reminder ───────────────────────────────────────────────

/**
 * Keep the one trial-ending reminder in step with the learner's RevenueCat
 * trial state. The subscription screen's timeline has promised this since the
 * honest-paywall work (`lib/trial-timeline.ts`, "we remind you"); this is the
 * code that makes the promise true.
 *
 * Cancel-and-reschedule on every call, so a cancelled trial, an early
 * conversion or a restore on a new device all converge on the right state:
 * scheduled while a trial is running with more than an hour left, absent
 * otherwise. Silent no-op on web and without permission — the timeline copy
 * says "if notifications are on" for exactly that reason.
 */
export async function syncTrialEndingReminder(state: TrialState): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelLegacyScheduledOnce();
  await cancelById(TRIAL_REMINDER_ID);

  if (!state.isTrial || !state.expiresAt) return;
  const fireAt = trialReminderFireAt(state.expiresAt);
  if (!fireAt) return;

  const content = trialReminderContent(state.expiresAt, fireAt);
  await Notifications.scheduleNotificationAsync({
    identifier: TRIAL_REMINDER_ID,
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: { type: 'trial-ending' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}
