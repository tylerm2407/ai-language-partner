import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useAppStore, effectiveTier } from '../stores/useAppStore';
import { autoTopUp, AUTO_TOPUP_MIN_INTERVAL_MS, offlinePacksEntitled } from '../lib/offline-packs';
import { levelToNewsTier } from '../config/app';
import { localToday } from '../lib/dates';

/** Wi-Fi with the internet reachable. Cellular never triggers a top-up. */
export function isWifiOnline(state: NetInfoState): boolean {
  return state.type === 'wifi' && state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Keep an entitled learner's device ahead of them, on Wi-Fi, in the
 * foreground, at most every AUTO_TOPUP_MIN_INTERVAL_MS. Mounted once in
 * app/(app)/_layout.tsx next to the offline-queue flush. Does nothing for
 * plans without offline mode and when the learner has turned auto-download
 * off in Settings › Offline downloads.
 */
export function useOfflineAutoTopUp() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const subscription = useAppStore((s) => s.subscription);
  const entitledTier = useAppStore((s) => s.entitledTier);
  const userId = user?.id;
  const targetLanguage = profile?.targetLanguage;
  const level = profile?.level;
  const entitled = offlinePacksEntitled(effectiveTier(subscription, entitledTier));
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!userId || !targetLanguage || !level || !entitled) return;

    const tryTopUp = (state: NetInfoState | null) => {
      if (!state || !isWifiOnline(state)) return;
      if (AppState.currentState !== 'active') return;
      const now = Date.now();
      if (now - lastRunRef.current < AUTO_TOPUP_MIN_INTERVAL_MS) return;
      lastRunRef.current = now;
      autoTopUp(userId, { targetLanguage, newsTier: levelToNewsTier(level), date: localToday() })
        .then((summary) => {
          if (summary.units + summary.books + summary.news > 0) {
            console.log('[offline-packs] top-up:', JSON.stringify(summary));
          }
        })
        .catch((err) => console.warn('[offline-packs] top-up failed:', err));
    };

    NetInfo.fetch().then(tryTopUp).catch(() => undefined);
    const unsubscribeNetInfo = NetInfo.addEventListener(tryTopUp);
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') NetInfo.fetch().then(tryTopUp).catch(() => undefined);
    });
    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [userId, targetLanguage, level, entitled]);
}
