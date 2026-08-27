import { Tabs } from 'expo-router';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useOfflineQueueFlush } from '../../hooks/useOfflineQueueFlush';
import { useLessonSessionSweep } from '../../hooks/useLessonSessionSweep';
import { useOnboardingReconciliation } from '../../hooks/useOnboardingReconciliation';
import { useTimezoneSync } from '../../hooks/useProfile';

export default function AppLayout() {
  // Replay queued offline writes on mount / reconnect / foreground.
  useOfflineQueueFlush();
  useLessonSessionSweep();
  // Reconcile the onboarding checklist against what the learner actually did.
  // Lives here rather than in the FAB because the FAB only exists on Home, and
  // someone who finishes a lesson and never opens Home still finished it.
  useOnboardingReconciliation();
  // Keep the profile's timezone tracking the device. Mounted here rather than
  // on Home: every server-side "today" (quotas, daily challenges, the new-card
  // cap) is derived from that column, and a learner who deep-links into a
  // lesson or a notification never opens Home at all.
  useTimezoneSync();


  // ─── The paywall is no longer a gate ─────────────────────────────────
  // A free tier exists again (lib/plans.ts `starter`), so an unsubscribed
  // learner is a legitimate, supported user of this app rather than someone
  // who has not paid yet. The redirect that used to live here — every route
  // in the group bouncing to /plans once the first lesson landed — would now
  // lock those learners out of the product they are entitled to.
  //
  // What replaced it:
  //   • the paywall is SHOWN once, right after sign-up and the free avatar
  //     (app/(app)/avatar-setup.tsx replaces into it), with a visible way out;
  //   • the free tier's AI quotas are all 0 server-side (_shared/plan-limits.ts),
  //     so nothing behind this layout can spend money on a free account;
  //   • paid surfaces upsell in place when tapped, at the moment of want.
  //
  // The server-side zeros are the part that actually holds. Deleting a client
  // redirect cannot grant quota, which is exactly why the gate could be a
  // product decision rather than a security one.
  //
  // `effectiveTier` and the store's `hasCompletedLesson` are still read
  // elsewhere (the profile subscription screen, the upsell surfaces); nothing
  // in this file needs them any more.

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
          <Tabs.Screen name="avatar-setup" options={{ href: null }} />
          <Tabs.Screen name="news" options={{ href: null }} />
          <Tabs.Screen name="practice" options={{ href: null }} />
          <Tabs.Screen name="assignments" options={{ href: null }} />
        </Tabs>
      </View>
    </ErrorBoundary>
  );
}
