import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
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
  const { c } = useUi2Theme();
  const router = useRouter();
  const { organization } = useSchoolStore();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Text
            className="text-[28px] mb-1"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Admin
          </Text>
          <Text
            className="text-base mb-6"
            style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
          >
            {organization?.name ?? 'Organization'}
          </Text>

          {/* Org Info Card */}
          <SlabCard style={{ marginBottom: 20 }}>
            <Text
              className="text-sm mb-2"
              style={{ fontFamily: 'Nunito_600SemiBold', color: c.muted }}
            >
              Organization Details
            </Text>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>Status</Text>
              <Text style={{ color: c.green, fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>Active</Text>
            </View>
          </SlabCard>

          {/* Action Cards */}
          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.route as any)}
              accessibilityRole="button"
              accessibilityLabel={action.title}
            >
              <SlabCard style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: action.icon === 'trash-outline' ? c.pinkTint : c.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.icon === 'trash-outline' ? c.error : c.primary}
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base" style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}>{action.title}</Text>
                  <Text className="text-xs" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>{action.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.idle} />
              </SlabCard>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}
