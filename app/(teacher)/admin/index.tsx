import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { useSchoolStore } from '../../../stores/useSchoolStore';

interface AdminAction {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const actions: AdminAction[] = [
  { title: 'Audit Log', subtitle: 'View all system activity', icon: 'document-text-outline', route: '/admin/audit-log' },
  { title: 'Data Export', subtitle: 'Export organization data', icon: 'download-outline', route: '/admin/data-management' },
  { title: 'Data Deletion', subtitle: 'Manage data retention', icon: 'trash-outline', route: '/admin/data-management' },
];

export default function AdminHubScreen() {
  const router = useRouter();
  const { organization } = useSchoolStore();

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Text
            className="text-[28px] text-text-primary mb-1"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Admin
          </Text>
          <Text
            className="text-base text-text-secondary mb-6"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {organization?.name ?? 'Organization'}
          </Text>

          {/* Org Info Card */}
          <GlassSurface style={{ marginBottom: 20 }} innerStyle={{ padding: 16 }}>
            <Text
              className="text-sm text-text-secondary mb-2"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Organization Details
            </Text>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>Status</Text>
              <Text style={{ color: '#22C55E', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Active</Text>
            </View>
          </GlassSurface>

          {/* Action Cards */}
          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.route as any)}
              accessibilityRole="button"
              accessibilityLabel={action.title}
            >
              <GlassSurface style={{ marginBottom: 12 }} innerStyle={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: action.icon === 'trash-outline' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.icon === 'trash-outline' ? '#EF4444' : '#38BDF8'}
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base text-text-primary" style={{ fontFamily: 'Inter_600SemiBold' }}>{action.title}</Text>
                  <Text className="text-xs text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>{action.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </GlassSurface>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
