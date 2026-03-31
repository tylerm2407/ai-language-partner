import { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import * as Network from 'expo-network';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;

    const checkConnection = async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) setIsOffline(!state.isConnected);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
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
