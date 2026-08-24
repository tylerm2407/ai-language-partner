import { Tabs, Redirect, useSegments } from 'expo-router';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useOfflineQueueFlush } from '../../hooks/useOfflineQueueFlush';
import { useLessonSessionSweep } from '../../hooks/useLessonSessionSweep';
import { useAppStore } from '../../stores/useAppStore';
import { SCHOOL_ENABLED } from '../../config/app';

export default function AppLayout() {
  // Replay queued offline writes on mount / reconnect / foreground.
  useOfflineQueueFlush();
  useLessonSessionSweep();

  const subscription = useAppStore((s) => s.subscription);
  const loading = useAppStore((s) => s.loading);
  const roles = useAppStore((s) => s.roles);
  const hasCompletedLesson = useAppStore((s) => s.hasCompletedLesson);
  const segments = useSegments();

  // ─── Hard paywall gate (design 7c) ────────────────────────────────────
  // The paywall is a gate, not a suggestion: an unsubscribed learner cannot
  // reach the tabs at all. Enforcing it here rather than with a push from the
  // lesson screen is what closes the deep-link and back-gesture holes — every
  // route in this group mounts under this layout.
  //
  // Four deliberate exemptions:
  //   1. `plans` itself, or the redirect would loop forever.
  //   2. While user data is still loading, `subscription` is null and would
  //      read as unsubscribed. Holding is correct; flashing the paywall at a
  //      paying subscriber on every cold start is not.
  //   3. School students, once SCHOOL_ENABLED — they are covered by an org
  //      contract and never buy a personal subscription. Inert today
  //      (the flag is false), but the server half already behaves this way:
  //      get_effective_limits merges contract_config with GREATEST().
  //   4. Learners who have not yet finished their first lesson. The approved
  //      funnel is onboarding -> Home -> first lesson -> paywall (commit
  //      14a8ccb moved the ask off the empty account and onto the learner's
  //      first real result). Gating the whole group on `tier` alone would
  //      redirect them off Home before that lesson ever happened and delete
  //      the reciprocity the design depends on. The gate closes the instant
  //      the completion lands (stores/useLessonProgressStore.markComplete),
  //      so it is free exactly once.
  //
  // The review-safety escape lives inside plans.tsx (`blocked`): if IAP is
  // unavailable or the offering is empty, that screen lets the learner past
  // rather than trapping them — a paywall with nothing to buy and no way out
  // is a 3.1.1 rejection.
  const tier = subscription?.tier ?? 'starter';
  const onPlans = segments[1] === 'plans';
  const schoolExempt = SCHOOL_ENABLED && (roles.includes('student') || roles.includes('teacher'));

  if (!loading && tier === 'starter' && hasCompletedLesson && !onPlans && !schoolExempt) {
    return <Redirect href="/(app)/plans" />;
  }

  return (
    <ErrorBoundary>
      <View className="flex-1 bg-dark">
        <OfflineBanner />
        <Tabs
          tabBar={(props) => <FloatingTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
            }}
          />
          <Tabs.Screen
            name="learn"
            options={{
              title: 'Learn',
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: 'AI Chat',
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
            }}
          />
          <Tabs.Screen name="news" options={{ href: null }} />
          <Tabs.Screen name="practice" options={{ href: null }} />
          <Tabs.Screen name="assignments" options={{ href: null }} />
        </Tabs>
      </View>
    </ErrorBoundary>
  );
}
