import { useEffect, useRef, useState } from 'react';
import { View, Platform, AppState } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body } from '../ui2/Ui2Text';

/**
 * How often to re-check while we believe we are offline.
 *
 * Only runs WHILE the banner is showing, so the common case (online) costs
 * nothing. This is the part that makes a wrong reading self-heal.
 */
const RECHECK_WHILE_OFFLINE_MS = 10_000;

/** How long the reachability probe waits before giving up on the network. */
const PROBE_TIMEOUT_MS = 4_000;

/**
 * Ask the network directly whether it works, rather than asking NetInfo.
 *
 * NetInfo's `isInternetReachable` is derived from the OS, and on the iOS
 * Simulator it reports `false` for whole sessions while every request to
 * Supabase succeeds — the banner then accuses a connection that is fine. A
 * real request is the only signal that cannot be wrong about this.
 *
 * Any HTTP response at all counts as reachable, including 401 and 404: the
 * question is whether bytes move, not whether this particular endpoint likes
 * us. Only a thrown error or the timeout means unreachable.
 *
 * Returns null when there is nothing to probe (no configured URL), which
 * means "no opinion" and leaves NetInfo's reading standing.
 */
export async function probeReachable(): Promise<boolean | null> {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${baseUrl}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
      // The banner must reflect the network now, not what it looked like
      // when the last response was cached.
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
  const { c } = useUi2Theme();
  const [isOffline, setIsOffline] = useState(false);
  // Read inside the interval callback without making it a dependency, so the
  // timer is not torn down and rebuilt on every state change.
  const isOfflineRef = useRef(false);
  isOfflineRef.current = isOffline;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    // Each apply gets a ticket; a probe that finishes after a newer reading
    // has already landed must not overwrite it.
    let generation = 0;

    const apply = async (state: NetInfoState) => {
      const mine = ++generation;
      if (cancelled) return;

      if (!looksOffline(state)) {
        setIsOffline(false);
        return;
      }

      // NetInfo thinks we are offline. Before saying so out loud, ask the
      // network. On the Simulator this is routinely how a false reading gets
      // caught; on a phone in a dead spot the probe fails too and the banner
      // shows as it should.
      const reachable = await probeReachable();
      if (cancelled || mine !== generation) return;
      setIsOffline(reachable === false || reachable === null);
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
      // A failed read tells us nothing about connectivity. Stay quiet
      // rather than accusing the learner's connection.
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      void apply(state);
    });

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
    <View style={{ backgroundColor: c.error, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Body size="sm" weight="semibold" tone="onPrimary" style={{ textAlign: 'center' }}>
        You're offline. Some features may not work.
      </Body>
    </View>
  );
}
