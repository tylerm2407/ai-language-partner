import { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, AppState } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * How often to re-check while we believe we are offline.
 *
 * Only runs WHILE the banner is showing, so the common case (online) costs
 * nothing. This is the part that makes a wrong reading self-heal.
 */
const RECHECK_WHILE_OFFLINE_MS = 10_000;

/**
 * True only when we are confident the device cannot reach the network.
 *
 * `isInternetReachable` is the honest signal — `isConnected` only means a
 * network interface exists, which on a simulator (and on a phone attached to
 * a captive wifi portal) is regularly true while nothing can actually be
 * reached, and occasionally false while everything works.
 *
 * Both fields are nullable and mean "unknown" when null. Unknown must never
 * be announced as offline, so this returns false unless a field positively
 * says otherwise. `useOfflineQueueFlush` reads the same two fields the same
 * way; they used to disagree, which is how the banner could claim offline
 * while the queue was happily flushing.
 */
export function looksOffline(state: NetInfoState): boolean {
  if (state.isInternetReachable === false) return true;
  if (state.isInternetReachable === true) return false;
  return state.isConnected === false;
}

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  // Read inside the interval callback without making it a dependency, so the
  // timer is not torn down and rebuilt on every state change.
  const isOfflineRef = useRef(false);
  isOfflineRef.current = isOffline;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const apply = (state: NetInfoState) => {
      if (!cancelled) setIsOffline(looksOffline(state));
    };

    // Seed from an explicit read rather than waiting for a change event.
    // addEventListener only fires when NetInfo's view of the world CHANGES,
    // so if the first thing it reports is a false negative — which iOS
    // simulators do during startup, before the network stack settles — there
    // may never be a second event to correct it. That is the bug this file
    // exists to fix: the banner claimed offline for the rest of the session
    // while every request was succeeding, and only a full app restart
    // cleared it.
    NetInfo.fetch().then(apply).catch(() => {
      // A failed probe tells us nothing about connectivity. Stay quiet
      // rather than accusing the learner's connection.
    });

    const unsubscribe = NetInfo.addEventListener(apply);

    // Re-verify while we believe we are offline. A stuck false negative
    // corrects itself within one interval instead of lasting the session.
    const recheck = setInterval(() => {
      if (!isOfflineRef.current) return;
      NetInfo.fetch().then(apply).catch(() => {});
    }, RECHECK_WHILE_OFFLINE_MS);

    // Returning to the foreground is the other moment the cached state is
    // most likely to be stale — the OS may have changed networks while the
    // app was suspended without us getting an event.
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') NetInfo.fetch().then(apply).catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(recheck);
      appState.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View className="bg-error px-4 py-2">
      <Text className="text-white text-sm text-center font-medium">
        You're offline. Some features may not work.
      </Text>
    </View>
  );
}
