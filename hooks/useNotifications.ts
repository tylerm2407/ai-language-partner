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

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (xpEarnedToday > 0) return;

  const hour = Math.max(18, Math.min(preferredHour, 22));
  const { title, body } = streakSaveContent(streak, idealL2Self);

  await Notifications.scheduleNotificationAsync({
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
