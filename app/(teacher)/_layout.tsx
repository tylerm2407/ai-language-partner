import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS } from '../../config/gradients';
import { useSchoolStore } from '../../stores/useSchoolStore';

function TabBarBackground() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        colors={[`${GRADIENT_COLORS[0]}4D`, `${GRADIENT_COLORS[1]}4D`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height: 1 }}
      />
      <View style={{ flex: 1, backgroundColor: 'rgba(12, 15, 20, 0.95)' }} />
    </View>
  );
}

export default function TeacherLayout() {
  const { roles } = useSchoolStore();
  const isAdmin = roles.includes('school_admin');

  return (
    <View className="flex-1 bg-dark">
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
  );
}
