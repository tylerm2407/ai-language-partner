import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS } from '../../config/gradients';

function TabBarBackground() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Gradient top line */}
      <LinearGradient
        colors={[`${GRADIENT_COLORS[0]}4D`, `${GRADIENT_COLORS[1]}4D`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height: 1 }}
      />
      {/* Semi-transparent dark fill */}
      <View style={{ flex: 1, backgroundColor: 'rgba(12, 15, 20, 0.95)' }} />
    </View>
  );
}

export default function AppLayout() {
  return (
    <ErrorBoundary>
      <View className="flex-1 bg-dark">
        <OfflineBanner />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#38BDF8',
            tabBarInactiveTintColor: '#64748B',
            tabBarStyle: {
              borderTopWidth: 0,
              backgroundColor: 'transparent',
              position: 'absolute',
            },
            tabBarBackground: () => <TabBarBackground />,
            tabBarLabelStyle: {
              fontSize: 12,
              fontFamily: 'Inter_600SemiBold',
            },
            tabBarIconStyle: {
              shadowColor: '#38BDF8',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="learn"
            options={{
              title: 'Learn',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: 'AI Chat',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubbles" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="news"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </ErrorBoundary>
  );
}
