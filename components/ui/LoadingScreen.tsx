import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Full-screen spinner. The ground and the message colour come from
 * `useUi2Theme()`: this covers a whole screen, so a fixed dark ground here is
 * the most visible way to break light mode there is.
 */
export function LoadingScreen({ message }: LoadingScreenProps) {
  const { c, type } = useUi2Theme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
        {message && (
          <Text style={{ fontSize: 13, lineHeight: 18, marginTop: 16, fontFamily: type.ui, color: c.idle }}>{message}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
