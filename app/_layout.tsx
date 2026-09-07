import '../global.css';
import * as Sentry from '@sentry/react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthDeepLinks } from '../hooks/useAuthDeepLinks';
import { useAppStore } from '../stores/useAppStore';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useSchoolStore } from '../stores/useSchoolStore';
import { SCHOOL_ENABLED } from '../config/app';
import { useNotifications, scheduleDailyPracticeReminder } from '../hooks/useNotifications';
import {
  configurePurchases,
  identifyPurchaser,
  resetPurchaser,
  addEntitlementListener,
} from '../lib/purchases';
import { identifyUser, resetAnalytics } from '../lib/analytics';
import { startAnalytics } from '../lib/analytics-posthog';
import { hydrateMotionPreference } from '../lib/motion-preference';
import { View, ActivityIndicator, AppState, Text, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { redactTutorSecrets } from '../lib/tutor-api';
import { useUi2Theme } from '../hooks/useUi2Theme';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 0.2,
  // Only enable in production builds that actually have a DSN configured.
  enabled: !__DEV__ && !!SENTRY_DSN,
  // Set per EAS build profile (eas.json → EXPO_PUBLIC_APP_ENV) so preview
  // builds do not pollute the production issue stream or its alert rules.
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
  // Strip the live tutor's ephemeral OpenAI credential out of anything we send.
  //
  // `startTutorSession` returns a short-lived `clientSecret` that the device
  // uses to open a WebRTC session directly with OpenAI. It is deliberately
  // never persisted and never logged, but a crash report is the one path that
  // serialises arbitrary state without anyone asking it to — an unhandled
  // rejection carrying the start response, or a breadcrumb from the fetch that
  // produced it, would put a working credential in a third-party dashboard.
  //
  // `redactTutorSecrets` lives in lib/tutor-api.ts, next to the shape it
  // redacts, so this wiring does not have to know that shape.
  beforeSend: (event) => redactTutorSecrets(event),
  beforeBreadcrumb: (breadcrumb) => redactTutorSecrets(breadcrumb),
});

function RootLayout() {
  const { c, scheme } = useUi2Theme();
  const { session, loading: authLoading } = useAuth();
  const { profile, dailyStats, loadUserData, setEntitledTier, error: profileError } = useAppStore();
  const { roles, activeRole, loadRoles } = useSchoolStore();
  const segments = useSegments() as string[];
  const router = useRouter();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // Supabase auth deep links: password recovery + email confirmation.
  useAuthDeepLinks();

  // Read the stored "Reduce motion" preference before the first animated frame
  // can run. Every `useMotion()` caller re-reads it on mount, so a late resolve
  // still propagates.
  useEffect(() => {
    hydrateMotionPreference().catch(() => {});
  }, []);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    // UI 2.0 heading face (config/theme.ts §ui2Type).
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Mount notification listeners + read current permission status.
  // No system prompt is fired here — that's deferred to the
  // PrePermissionSheet post-first-lesson.
  const { permissionGranted } = useNotifications();

  // Re-arm the daily practice reminder whenever the inputs change
  // (xp/permission). Silent no-op if permission isn't granted yet
  // or if XP was already earned today.
  useEffect(() => {
    if (!profile || !permissionGranted) return;
    scheduleDailyPracticeReminder({
      xpEarnedToday: dailyStats?.xpEarned ?? 0,
      preferredHour: 21,
      idealL2Self: profile.idealL2Self ?? null,
    }).catch(() => {});
  }, [profile, dailyStats?.xpEarned, permissionGranted]);

  // Also re-arm on background — covers edge cases where the user
  // backgrounds before the schedule-on-change useEffect has resolved.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && profile && permissionGranted) {
        scheduleDailyPracticeReminder({
          xpEarnedToday: dailyStats?.xpEarned ?? 0,
          preferredHour: 21,
          idealL2Self: profile.idealL2Self ?? null,
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [profile, dailyStats?.xpEarned, permissionGranted]);

  // Register the analytics provider once, before anything tries to track.
  // No-ops without EXPO_PUBLIC_POSTHOG_KEY, which is the normal state for a
  // developer build.
  useEffect(() => {
    startAnalytics();
  }, []);

  // Tie purchases, analytics, and crash reports to the signed-in user.
  // Idempotent; analytics/IAP no-op until a provider/keys are configured.
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    configurePurchases(userId);
    if (userId) {
      identifyPurchaser(userId);
      identifyUser(userId);
      Sentry.setUser({ id: userId });
    } else {
      resetPurchaser();
      resetAnalytics();
      Sentry.setUser(null);
    }
  }, [session?.user?.id]);

  // Track the device's live RevenueCat entitlement. This is half of the paywall
  // gate (app/(app)/_layout.tsx) — without it, a learner who has just paid is
  // redirected back to the paywall until the revenuecat-webhook writes their
  // `subscriptions` row, which can be seconds away or, if RevenueCat runs out
  // of retries, never. Re-registered per user so a sign-out drops the previous
  // account's entitlement instead of leaking it to the next one.
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId) {
      setEntitledTier(null);
      return;
    }
    const unsubscribe = addEntitlementListener(setEntitledTier);
    return unsubscribe;
  }, [session?.user?.id, setEntitledTier]);

  // Load user data when session becomes available
  useEffect(() => {
    if (session?.user?.id && !dataLoaded) {
      loadUserData(session.user.id).then(() => setDataLoaded(true));
    }
    if (!session) {
      setDataLoaded(false);
    }
  }, [session?.user?.id, dataLoaded, loadUserData, session]);

  // Load user roles after data is loaded (skip when school features disabled)
  useEffect(() => {
    if (!SCHOOL_ENABLED) {
      setRolesLoaded(true);
      return;
    }
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

    // Password recovery in progress — useAuthDeepLinks routed the user to the
    // reset screen with a live session; don't route them away until they've
    // set a new password (the screen navigates onward itself).
    if (segments[1] === 'reset-password') return;

    const inAuthGroup = segments[0] === '(app)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inOnboarding = segments[1] === 'onboarding';

    // A failed profile load also leaves profile === null. Routing on that would
    // send an existing user into the placement test and overwrite their level,
    // so when the load errored we hold position and show a retry instead.
    if (session && dataLoaded && !profile && profileError) return;

    if (session && dataLoaded && (!profile || !profile.onboardingCompleted) && !inOnboarding) {
      // Signed in but onboarding not finished — go to onboarding
      router.replace('/(public)/onboarding');
    } else if (session && dataLoaded && profile?.onboardingCompleted) {
      // Role-based routing (teacher routing only when school features enabled)
      if (SCHOOL_ENABLED && roles.includes('teacher') && activeRole === 'teacher' && !inTeacherGroup) {
        router.replace('/(teacher)' as any);
      } else if ((!SCHOOL_ENABLED || activeRole === 'learner') && !inAuthGroup) {
        router.replace('/(app)');
      }
    } else if (!session && (inAuthGroup || inTeacherGroup)) {
      // Not signed in — go to public
      router.replace('/(public)');
    }
  }, [session, authLoading, fontsLoaded, dataLoaded, rolesLoaded, profile, profileError, segments, router, roles, activeRole]);

  if (authLoading || !fontsLoaded || (session && (!dataLoaded || !rolesLoaded))) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
          <ActivityIndicator size="large" color={c.primary} />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // Profile load failed (offline, timeout, transient 5xx). Never fall through to
  // onboarding here — that would overwrite a real user's level. Offer a retry.
  if (session && dataLoaded && !profile && profileError) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: c.bg }}>
          <Text className="text-xl font-semibold text-center mb-2" style={{ color: c.ink }}>
            Couldn&apos;t load your profile
          </Text>
          <Text className="text-base text-center mb-6" style={{ color: c.muted }}>
            Check your connection and try again. Your progress is safe.
          </Text>
          <Pressable
            onPress={() => setDataLoaded(false)}
            className="px-6 py-3 rounded-2xl"
            style={{ backgroundColor: c.primary }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading your profile"
          >
            <Text className="text-base font-semibold" style={{ color: c.onPrimary }}>Try Again</Text>
          </Pressable>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Slot />
      </ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
