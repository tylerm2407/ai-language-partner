import { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Event-driven rather than polled. The previous implementation called an
    // async probe without awaiting it, on a 5s interval, for the whole app
    // lifetime — so a rejected `getNetworkStateAsync()` was an unhandled
    // rejection every five seconds AND left `isOffline` false, hiding the
    // banner at exactly the moment it exists to appear.
    //
    // NetInfo is already a direct dependency and is used this way in
    // `useOfflineQueueFlush`.
    return NetInfo.addEventListener((state) => {
      // `=== false`, not `!state.isConnected`: NetInfo reports `null` for
      // "unknown", and an unknown state must not be announced as offline.
      setIsOffline(state.isConnected === false);
    });
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
