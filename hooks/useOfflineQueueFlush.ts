import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './useAuth';
import { flush } from '../lib/offline-queue';
import { clearReadCache } from '../lib/read-cache';

/**
 * Flush the offline write queue (lib/offline-queue.ts) whenever
 * connectivity plausibly returned: once on mount, on network reconnect
 * (NetInfo), and when the app returns to the foreground. flush() is
 * single-flight per user, so overlapping triggers are cheap no-ops.
 *
 * Mounted once in app/(app)/_layout.tsx.
 */
export function useOfflineQueueFlush() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const tryFlush = () => {
      flush(userId)
        .then((processed) => {
          // Replayed writes changed server state — user-scoped cached reads
          // (review queue, progress tiles) are now stale; drop them so the
          // next load fetches fresh instead of re-showing answered reviews.
          if (processed > 0) return clearReadCache(userId);
        })
        .catch((err) => console.warn('[offline-queue] flush failed:', err));
    };

    tryFlush();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        tryFlush();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        tryFlush();
      }
    });

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [userId]);
}
