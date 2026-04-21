import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../stores/useAppStore';
import { useSchoolStore } from '../stores/useSchoolStore';
import { useNotifications } from '../hooks/useNotifications';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

export default function RootLayout() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, loadUserData } = useAppStore();
  const { roles, activeRole, loadRoles } = useSchoolStore();
  const segments = useSegments();
  const router = useRouter();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
  });

  // Register for push notifications
  const { scheduleDailyReminder } = useNotifications({ userId: session?.user?.id });

  // Schedule daily reminder once profile is loaded
  useEffect(() => {
    if (profile) {
      scheduleDailyReminder();
    }
  }, [profile, scheduleDailyReminder]);

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
