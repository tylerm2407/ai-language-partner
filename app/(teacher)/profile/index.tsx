import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useSchoolStore } from '../../../stores/useSchoolStore';
// `colors` is deliberately NOT imported: it is the fixed DARK palette.
import { useUi2Theme } from '../../../hooks/useUi2Theme';

export default function TeacherProfileScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, subscription } = useAppStore();
  const { organization, activeRole, setActiveRole } = useSchoolStore();

  const handleSwitchToLearner = () => {
    setActiveRole('learner');
    router.replace('/(app)' as any);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-[28px] mb-6"
            style={{ fontFamily: 'Manrope_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Profile
          </Text>

          {/* Role Switcher */}
          <Ui2ListRow
            icon="swap-horizontal"
            title="Switch to Learner Mode"
            subtitle="Currently in Teacher mode"
            onPress={handleSwitchToLearner}
            accessibilityLabel="Switch to learner mode"
            style={{ marginBottom: 16 }}
          />

          {/* User Info */}
          <SlabCard style={{ marginBottom: 16, padding: 16 }}>
            <View className="flex-row items-center">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: c.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={24} color={c.onTint} />
              </View>
              <View className="ml-4">
                <Text
                  className="text-lg"
                  style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                >
                  {profile?.displayName ?? user?.email}
                </Text>
                {profile?.displayName && (
                  <Text
                    className="text-sm"
                    style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                  >
                    {user?.email}
                  </Text>
                )}
              </View>
            </View>
          </SlabCard>

          {/* School Info */}
          {organization && (
            <>
              <Text
                className="text-xl mb-3"
                style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
              >
                School
              </Text>
              <SlabCard style={{ padding: 20, marginBottom: 16 }}>
                <View className="flex-row items-center">
                  <Ionicons name="school" size={24} color={c.primary} />
                  <View className="ml-4 flex-1">
                    <Text
                      className="text-base"
                      style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                    >
                      {organization.name}
                    </Text>
                    <Text
                      className="text-sm capitalize"
                      style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                    >
                      {activeRole ?? 'Teacher'}
                    </Text>
                  </View>
                </View>
              </SlabCard>
            </>
          )}

          {/* Settings Links */}
          <Text
            className="text-xl mb-3"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          >
            Settings
          </Text>

          <Ui2ListRow
            icon="card"
            title="Subscription"
            subtitle={subscription?.tier ?? 'Free'}
            onPress={() => router.push('/profile/subscription' as any)}
            accessibilityLabel="Subscription"
            style={{ marginBottom: 12 }}
          />

          <Ui2ListRow
            icon="settings"
            title="Settings"
            subtitle="Account preferences"
            onPress={() => router.push('/profile/settings' as any)}
            accessibilityLabel="Edit settings"
            style={{ marginBottom: 12 }}
          />

          {/* Sign Out */}
          <Ui2ListRow
            icon="log-out-outline"
            title="Sign Out"
            destructive
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
