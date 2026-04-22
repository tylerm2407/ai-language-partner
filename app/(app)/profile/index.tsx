import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useLevel } from '../../../hooks/useLevel';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_LANGUAGES } from '../../../config/app';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { LeagueBadge } from '../../../components/gamification/LeagueBadge';
import { AchievementGrid } from '../../../components/gamification/AchievementGrid';
import { Avatar } from '../../../components/avatar/Avatar';
import { AvatarCustomizer } from '../../../components/avatar/AvatarCustomizer';
import { FourStrandsCard } from '../../../components/stats/FourStrandsCard';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { strandMinutesFromDailyStats } from '../../../lib/four-strands';
import { DEFAULT_AVATAR_CONFIG } from '../../../components/avatar/constants';
import { updateAvatarConfig, joinClassroom } from '../../../lib/supabase-queries';
import JoinClassModal from '../../../components/school/JoinClassModal';
import RoleSwitcher from '../../../components/school/RoleSwitcher';
import type { AvatarConfig } from '../../../types';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const { enrolledClasses, loadStudentSchoolData, roles, activeRole, setActiveRole } = useSchoolStore();
  const { level, tier } = useLevel();
  const { dailyStats } = useDailyStats();
  const strandTotals = strandMinutesFromDailyStats({
    listeningMinutes: dailyStats?.listeningMinutes,
    readingMinutes: dailyStats?.readingMinutes,
    speakingMinutes: dailyStats?.speakingMinutes,
    writingMinutes: dailyStats?.writingMinutes,
  });
  const router = useRouter();
  const [customizerVisible, setCustomizerVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);

  // Load student school data on mount
  useEffect(() => {
    if (user?.id) loadStudentSchoolData(user.id);
  }, [user?.id, loadStudentSchoolData]);

  const handleJoinClass = async (code: string) => {
    await joinClassroom(code);
    if (user?.id) loadStudentSchoolData(user.id);
  };

  const handleSaveAvatar = async (config: AvatarConfig) => {
    if (!user || !profile) return;
    try {
      await updateAvatarConfig(user.id, config);
      setProfile({ ...profile, avatarConfig: config });
      setCustomizerVisible(false);
    } catch (err) {
      console.error('Failed to save avatar:', err);
    }
  };

  const languageLabel = SUPPORTED_LANGUAGES.find((l) => l.code === profile?.targetLanguage)?.name ?? profile?.targetLanguage ?? 'Not set';
  const levelLabel = profile?.level ? LEVEL_LABELS[profile.level] ?? profile.level : 'Not set';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <GradientBackground>
    <View className="flex-1">
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        <Text className="text-[28px] font-bold text-text-primary mb-6" accessibilityRole="header">Profile</Text>

        {/* User Info */}
        <View className="bg-dark-card rounded-2xl p-5 mb-4">
          <Pressable
            onPress={() => setCustomizerVisible(true)}
            accessibilityLabel="Customize avatar"
            accessibilityRole="button"
            style={{ marginBottom: 12 }}
          >
            <Avatar
              config={profile?.avatarConfig ?? undefined}
              size="large"
              expression="neutral"
              animated
            />
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary">{profile?.displayName ?? user?.email}</Text>
          {profile?.displayName && (
            <Text className="text-sm text-text-secondary">{user?.email}</Text>
          )}

          {/* Stats row */}
          <View className="flex-row mt-4 gap-4">
            <View className="items-center">
              <Text className="text-lg font-bold text-primary">{profile?.totalXp ?? 0}</Text>
              <Text className="text-xs text-text-secondary">XP</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-text-primary">Lv. {level}</Text>
              <Text className="text-xs text-text-secondary">Level</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-streak">{profile?.streak ?? 0}</Text>
              <Text className="text-xs text-text-secondary">Streak</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-text-primary">{profile?.longestStreak ?? 0}</Text>
              <Text className="text-xs text-text-secondary">Best</Text>
            </View>
          </View>
          <View className="mt-3">
            <LeagueBadge tier={tier} />
          </View>
        </View>

        {/* Four Strands balance (Nation, research.md §14.3) */}
        <View className="mb-4">
          <FourStrandsCard totals={strandTotals} />
        </View>

        {/* Achievements */}
        <AchievementGrid />

        {/* My Classes */}
        <Text className="text-xl font-bold text-text-primary mb-3">My Classes</Text>

        {enrolledClasses.length > 0 ? (
          enrolledClasses.map((enrollment) => (
            <View key={enrollment.id} className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
              <Ionicons name="school-outline" size={24} color="#A855F7" />
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-text-primary">{enrollment.classroom?.name ?? 'Class'}</Text>
                <Text className="text-sm text-text-secondary">
                  {enrollment.classroom?.targetLanguage?.toUpperCase() ?? ''} · {enrollment.classroom?.level ?? ''}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View className="bg-dark-card rounded-2xl p-5 mb-3 items-center">
            <Text className="text-text-secondary text-sm">Not enrolled in any classes</Text>
          </View>
        )}

        <Pressable
          className="bg-dark-card rounded-2xl p-5 mb-6 flex-row items-center justify-center"
          onPress={() => setJoinModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Join a class"
        >
          <Ionicons name="add-circle-outline" size={24} color="#A855F7" />
          <Text className="text-base font-semibold text-primary ml-3">Join a Class</Text>
        </Pressable>

        {/* Role Switcher — only show if user has teacher role */}
        {roles.includes('teacher') && (
          <View className="mb-6">
            <RoleSwitcher
              activeRole={activeRole}
              onSwitch={(role) => {
                setActiveRole(role);
                if (role === 'teacher') {
                  router.replace('/(teacher)' as any);
                }
              }}
            />
          </View>
        )}

        {/* Settings */}
        <Text className="text-xl font-bold text-text-primary mb-3">Settings</Text>

        <Pressable
          className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
          onPress={() => router.push('/profile/subscription' as any)}
          accessibilityRole="button"
          accessibilityLabel="Subscription"
        >
          <Ionicons name="card" size={24} color="#A855F7" />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Subscription</Text>
            <Text className="text-sm text-text-secondary capitalize">{subscription?.tier ?? 'Free'}</Text>
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
            <Text className="text-base font-semibold text-text-primary">Edit Settings</Text>
            <Text className="text-sm text-text-secondary">Language, level, daily goal, name</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
        </Pressable>

        <View className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
          <Ionicons name="language" size={24} color="#A855F7" />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Target Language</Text>
            <Text className="text-sm text-text-secondary">{languageLabel}</Text>
          </View>
        </View>

        <View className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
          <Ionicons name="trending-up" size={24} color="#A855F7" />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Level</Text>
            <Text className="text-sm text-text-secondary">{levelLabel}</Text>
          </View>
        </View>

        <View className="bg-dark-card rounded-2xl p-5 mb-6 flex-row items-center">
          <Ionicons name="time" size={24} color="#A855F7" />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Daily Goal</Text>
            <Text className="text-sm text-text-secondary">{profile?.dailyGoalMinutes ?? 10} minutes</Text>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          className="bg-error-bg py-4 rounded-[14px] items-center"
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text className="text-error-dark text-lg font-semibold">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
    <AvatarCustomizer
      visible={customizerVisible}
      onClose={() => setCustomizerVisible(false)}
      initialConfig={profile?.avatarConfig ?? DEFAULT_AVATAR_CONFIG}
      onSave={handleSaveAvatar}
    />
    <JoinClassModal
      visible={joinModalVisible}
      onClose={() => setJoinModalVisible(false)}
      onJoin={handleJoinClass}
    />
    </GradientBackground>
  );
}
