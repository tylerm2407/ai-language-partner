import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../stores/useAppStore';
import { useSchoolStore } from '../stores/useSchoolStore';
import { useNotifications, scheduleStreakSaveReminder } from '../hooks/useNotifications';
import { View, ActivityIndicator, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

export default function RootLayout() {
  const { session, loading: authLoading } = useAuth();
  const { profile, dailyStats, loading: dataLoading, loadUserData } = useAppStore();
  const { roles, activeRole, loadRoles } = useSchoolStore();
  const segments = useSegments() as string[];
  const router = useRouter();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Mount notification listeners + read current permission status.
  // No system prompt is fired here — that's deferred to the
  // PrePermissionSheet post-first-lesson.
  const { permissionGranted } = useNotifications({ userId: session?.user?.id });

  // Re-arm the streak-save reminder whenever the inputs change
  // (streak/xp/permission). Silent no-op if permission isn't granted yet
  // or if XP was already earned today.
  useEffect(() => {
    if (!profile || !permissionGranted) return;
    scheduleStreakSaveReminder({
      streak: profile.streak ?? 0,
      xpEarnedToday: dailyStats?.xpEarned ?? 0,
      preferredHour: 21,
    }).catch(() => {});
  }, [profile, dailyStats?.xpEarned, permissionGranted]);

  // Also re-arm on background — covers edge cases where the user
  // backgrounds before the schedule-on-change useEffect has resolved.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && profile && permissionGranted) {
        scheduleStreakSaveReminder({
          streak: profile.streak ?? 0,
          xpEarnedToday: dailyStats?.xpEarned ?? 0,
          preferredHour: 21,
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [profile, dailyStats?.xpEarned, permissionGranted]);

  // Load user data when session becomes available
  useEffect(() => {
    if (session?.user?.id && !dataLoaded) {
      loadUserData(session.user.id).then(() => setDataLoaded(true));
    }
    if (!session) {
      setDataLoaded(false);
    }
  }, [session?.user?.id, dataLoaded, loadUserData, session]);

  // Load user roles after data is loaded
  useEffect(() => {
    if (session?.user?.id && dataLoaded && !rolesLoaded) {
      loadRoles(session.user.id).then(() => setRolesLoaded(true));
    }
    if (!session) {
      setRolesLoaded(false);
    }
  }, [session?.user?.id, dataLoaded, rolesLoaded, loadRoles, session]);

  // Route guard
  useEffect(() => {
    if (authLoading || !fontsLoaded) return;
    if (session && !dataLoaded) return; // Wait for data to load
    if (session && dataLoaded && !rolesLoaded) return; // Wait for roles

    const inAuthGroup = segments[0] === '(app)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inOnboarding = segments[1] === 'onboarding';

    if (session && dataLoaded && (!profile || !profile.onboardingCompleted) && !inOnboarding) {
      // Signed in but onboarding not finished — go to onboarding
      router.replace('/(public)/onboarding');
    } else if (session && dataLoaded && profile?.onboardingCompleted) {
      // Role-based routing
      if (roles.includes('teacher') && activeRole === 'teacher' && !inTeacherGroup) {
        router.replace('/(teacher)' as any);
      } else if (activeRole === 'learner' && !inAuthGroup) {
        router.replace('/(app)');
      }
    } else if (!session && (inAuthGroup || inTeacherGroup)) {
      // Not signed in — go to public
      router.replace('/(public)');
    }
  }, [session, authLoading, fontsLoaded, dataLoaded, rolesLoaded, profile, segments, router, roles, activeRole]);

  if (authLoading || !fontsLoaded || (session && (!dataLoaded || !rolesLoaded))) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-dark">
          <ActivityIndicator size="large" color="#38BDF8" />
          <StatusBar style="light" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
