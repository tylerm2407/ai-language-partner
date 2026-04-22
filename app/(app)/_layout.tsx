import { Tabs } from 'expo-router';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';

export default function AppLayout() {
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
          <Tabs.Screen name="review" options={{ href: null }} />
          <Tabs.Screen name="practice" options={{ href: null }} />
          <Tabs.Screen name="assignments" options={{ href: null }} />
        </Tabs>
      </View>
    </ErrorBoundary>
  );
}
