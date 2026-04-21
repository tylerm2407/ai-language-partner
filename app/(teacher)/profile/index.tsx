import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useSchoolStore } from '../../../stores/useSchoolStore';

export default function TeacherProfileScreen() {
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
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-[28px] text-text-primary mb-6"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Profile
          </Text>

          {/* Role Switcher */}
          <Pressable
            onPress={handleSwitchToLearner}
            accessibilityRole="button"
            accessibilityLabel="Switch to learner mode"
          >
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(56, 189, 248, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="swap-horizontal" size={20} color="#38BDF8" />
              </View>
              <View className="ml-3 flex-1">
                <Text
                  className="text-base text-text-primary"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  Switch to Learner Mode
                </Text>
                <Text
                  className="text-xs text-text-secondary"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Currently in Teacher mode
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
            </GlassSurface>
          </Pressable>

          {/* User Info */}
          <GlassSurface
            style={{ marginBottom: 16 }}
            innerStyle={{ padding: 16 }}
          >
            <View className="flex-row items-center">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={24} color="#A855F7" />
              </View>
              <View className="ml-4">
                <Text
                  className="text-lg text-text-primary"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {profile?.displayName ?? user?.email}
                </Text>
                {profile?.displayName && (
                  <Text
                    className="text-sm text-text-secondary"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    {user?.email}
                  </Text>
                )}
              </View>
            </View>
          </GlassSurface>

          {/* School Info */}
          {organization && (
            <>
              <Text
                className="text-xl text-text-primary mb-3"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                School
              </Text>
              <View className="bg-dark-card rounded-2xl p-5 mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="school" size={24} color="#A855F7" />
                  <View className="ml-4 flex-1">
                    <Text
                      className="text-base text-text-primary"
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                    >
                      {organization.name}
                    </Text>
                    <Text
                      className="text-sm text-text-secondary capitalize"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {activeRole ?? 'Teacher'}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Settings Links */}
          <Text
            className="text-xl text-text-primary mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Settings
          </Text>

          <Pressable
            className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
            onPress={() => router.push('/profile/subscription' as any)}
            accessibilityRole="button"
            accessibilityLabel="Subscription"
          >
            <Ionicons name="card" size={24} color="#A855F7" />
            <View className="ml-4 flex-1">
              <Text
                className="text-base text-text-primary"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Subscription
              </Text>
              <Text
                className="text-sm text-text-secondary capitalize"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {subscription?.tier ?? 'Free'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
          </Pressable>

          <Pressable
            className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
            onPress={() => router.push('/profile/settings' as any)}
            accessibilityRole="button"
            accessibilityLabel="Edit settings"
          >
            <Ionicons name="settings" size={24} color="#A855F7" />
            <View className="ml-4 flex-1">
              <Text
                className="text-base text-text-primary"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Settings
              </Text>
              <Text
                className="text-sm text-text-secondary"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Account preferences
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
          </Pressable>

          {/* Sign Out */}
          <Pressable
            className="bg-error-bg py-4 rounded-[14px] items-center mt-4"
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text
              className="text-error-dark text-lg"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Sign Out
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
