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
  userId: string | undefined;
  dailyReminderHour?: number; // 24h format, default 19 (7 PM)
  dailyReminderMinute?: number;
}

export function useNotifications({ userId, dailyReminderHour = 19, dailyReminderMinute = 0 }: UseNotificationsOptions) {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) {
        setPushToken(token);
        setPermissionGranted(true);
        // Save token to user profile
        if (userId) {
          savePushToken(userId, token);
        }
      }
    });

    // Listen for incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received in foreground — no-op, handled by setNotificationHandler
    });

    // Listen for user tapping on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // User tapped notification — could navigate to relevant screen
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userId]);

  const scheduleDailyReminder = async () => {
    // Cancel any existing daily reminders
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule streak reminder for the evening
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your streak! 🔥",
        body: "You haven't practiced today. A quick 5-minute lesson keeps your streak alive!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: dailyReminderHour,
        minute: dailyReminderMinute,
      },
    });
  };

  const scheduleAchievementNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  };

  return {
    pushToken,
    permissionGranted,
    scheduleDailyReminder,
    scheduleAchievementNotification,
  };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase
      .from('user_profiles')
      .update({ push_token: token })
      .eq('user_id', userId);
  } catch {
    // Silently fail — push token is nice-to-have, not critical
  }
}
