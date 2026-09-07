import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useUi2Theme } from '../../hooks/useUi2Theme';

function TabBarBackground() {
  const { c } = useUi2Theme();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* UI 2.0 grounds on flat colour — the hairline is the card border, not a
          gradient. */}
      <View style={{ height: 1, backgroundColor: c.cardBorder }} />
      {/* Opaque card fill — matching the learner FloatingTabBar. The old
          rgba(12,15,20,.95) was keyed to the pre-glow base and read as a
          lighter grey band once the base deepened. */}
      <View style={{ flex: 1, backgroundColor: c.card }} />
    </View>
  );
}

export default function TeacherLayout() {
  const { c } = useUi2Theme();
  const { roles } = useSchoolStore();
  const isAdmin = roles.includes('school_admin');

  return (
    <ErrorBoundary>
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.idle,
          tabBarStyle: {
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            position: 'absolute',
          },
          tabBarBackground: () => <TabBarBackground />,
          tabBarLabelStyle: {
            fontSize: 12,
            fontFamily: 'Nunito_600SemiBold',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="classes"
          options={{
            title: 'Classes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="school-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="assignments"
          options={{
            title: 'Assignments',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-outline" size={size} color={color} />
            ),
            href: isAdmin ? undefined : null,
          }}
        />
      </Tabs>
    </View>
    </ErrorBoundary>
  );
}
