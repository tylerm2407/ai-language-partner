import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-dark">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#38BDF8" />
        {message && (
          <Text className="text-sm text-text-tertiary mt-4 font-sans">{message}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
