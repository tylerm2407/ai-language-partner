import '../global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../stores/useAppStore';
import { useNotifications } from '../hooks/useNotifications';
import { View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export default function RootLayout() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, loadUserData } = useAppStore();
  const segments = useSegments();
  const router = useRouter();
  const [dataLoaded, setDataLoaded] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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

  // Route guard
  useEffect(() => {
    if (authLoading || !fontsLoaded) return;
    if (session && !dataLoaded) return; // Wait for data to load

    const inAuthGroup = segments[0] === '(app)';
    const inOnboarding = segments[1] === 'onboarding';

    if (session && dataLoaded && (!profile || !profile.onboardingCompleted) && !inOnboarding) {
      // Signed in but onboarding not finished — go to onboarding
      router.replace('/(public)/onboarding');
    } else if (session && dataLoaded && profile?.onboardingCompleted && !inAuthGroup) {
      // Signed in with completed onboarding — go to app
      router.replace('/(app)');
    } else if (!session && inAuthGroup) {
      // Not signed in — go to public
      router.replace('/(public)');
    }
  }, [session, authLoading, fontsLoaded, dataLoaded, profile, segments, router]);

  if (authLoading || !fontsLoaded || (session && !dataLoaded)) {
    return (
      <View className="flex-1 items-center justify-center bg-dark">
        <ActivityIndicator size="large" color="#38BDF8" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <StatusBar style="light" />
    </>
  );
}
