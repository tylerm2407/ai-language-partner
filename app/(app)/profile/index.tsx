import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { SCHOOL_ENABLED, SUPPORTED_LANGUAGES } from '../../../config/app';
import { useLevel } from '../../../hooks/useLevel';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors, radii, spacing, typography } from '../../../config/theme';
import { Heading } from '../../../components/ui/Text';
import { Chip } from '../../../components/ui/Chip';
import { LevelBadge } from '../../../components/stats/LevelBadge';
import { AchievementGrid } from '../../../components/gamification/AchievementGrid';
import { Avatar } from '../../../components/avatar/Avatar';
import { AvatarPresetPicker } from '../../../components/avatar/AvatarPresetPicker';
import { AvatarGeneratorSheet } from '../../../components/avatar/AvatarGeneratorSheet';
import { useAvatarImage, invalidateAvatarImage } from '../../../hooks/useAvatarImage';
import { FourStrandsCard } from '../../../components/stats/FourStrandsCard';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { strandMinutesFromDailyStats } from '../../../lib/four-strands';
import { CompletedLessonsSection } from '../../../components/profile/CompletedLessonsSection';
import { setAvatarKind, joinClassroom } from '../../../lib/supabase-queries';
import { presetUrlFromId, type AvatarPreset } from '../../../lib/avatar-presets';
import JoinClassModal from '../../../components/school/JoinClassModal';
import RoleSwitcher from '../../../components/school/RoleSwitcher';
import { BecomeTeacherSheet } from '../../../components/school/BecomeTeacherSheet';
import { useScreenView } from '../../../hooks/useScreenView';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
};

export default function ProfileScreen() {
  useScreenView('profile');
  const { user, signOut } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const { enrolledClasses, loadStudentSchoolData, roles, activeRole, setActiveRole } = useSchoolStore();
  // Called for its side effect only — it mirrors level-ups into the store, and
  // the ledger keeps accruing whether or not anything renders it. Nothing on
  // this screen shows the number any more.
  useLevel();
  const { dailyStats } = useDailyStats();
  const strandTotals = strandMinutesFromDailyStats({
    listeningMinutes: dailyStats?.listeningMinutes,
    readingMinutes: dailyStats?.readingMinutes,
    speakingMinutes: dailyStats?.speakingMinutes,
    writingMinutes: dailyStats?.writingMinutes,
  });
  const router = useRouter();
  const [customizerVisible, setCustomizerVisible] = useState(false);
  const [generatorVisible, setGeneratorVisible] = useState(false);
  // A generated avatar is private and needs a signed URL; a preset is public
  // artwork whose URL is derived from its id, so only the first costs a round
  // trip. Anything else (including legacy 'procedural' rows) falls through to
  // the initials placeholder inside Avatar.
  const signedAvatarUri = useAvatarImage(
    profile?.avatarKind === 'generated' ? profile.avatarImagePath : null
  );
  const avatarUri =
    profile?.avatarKind === 'preset' && profile.avatarPresetId
      ? presetUrlFromId(profile.avatarPresetId)
      : signedAvatarUri;
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [becomeTeacherVisible, setBecomeTeacherVisible] = useState(false);

  // Load student school data on mount (only when school features enabled)
  useEffect(() => {
    if (SCHOOL_ENABLED && user?.id) {
      loadStudentSchoolData(user.id).catch((err) =>
        console.error('[profile] school data load failed:', err),
      );
    }
  }, [user?.id, loadStudentSchoolData]);

  const handleJoinClass = async (code: string) => {
    await joinClassroom(code);
    if (user?.id) {
      loadStudentSchoolData(user.id).catch((err) =>
        console.error('[profile] school data refresh failed:', err),
      );
    }
  };

  const handleAvatarGenerated = (path: string) => {
    if (!profile) return;
    // The Edge Function already wrote avatar_kind/avatar_image_path, so this
    // mirrors that into the store rather than issuing a second write.
    invalidateAvatarImage(path);
    setProfile({ ...profile, avatarKind: 'generated', avatarImagePath: path });
    setGeneratorVisible(false);
  };

  const handleSelectPreset = async (preset: AvatarPreset) => {
    if (!user || !profile) return;
    // Optimistic: the grid closes and the ring updates immediately.
    const previous = profile;
    setProfile({ ...profile, avatarKind: 'preset', avatarPresetId: preset.id });
    setCustomizerVisible(false);
    try {
      await setAvatarKind(user.id, 'preset', preset.id);
    } catch (err) {
      // Roll back rather than leaving local state ahead of the server. The
      // previous behaviour showed the new avatar for the rest of the session
      // and then silently reverted on the next cold start, which reads as the
      // app losing the choice for no reason.
      console.error('Failed to save avatar:', err);
      setProfile(previous);
      Alert.alert('Could not save avatar', 'Your avatar was not changed. Please try again.');
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
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header — title + settings. Settings also has a row further down; the
            header affordance is the primary one. */}
        <View style={styles.headerRow}>
          <Heading level={2}>Profile</Heading>
          <Pressable
            onPress={() => router.push('/profile/settings' as any)}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>

        {/* Identity — avatar in a primary ring, name, mono meta, language chip */}
        <View style={styles.identityRow}>
          <Pressable
            onPress={() => setCustomizerVisible(true)}
            accessibilityLabel="Change avatar"
            accessibilityRole="button"
            style={styles.avatarRing}
          >
            <Avatar size="medium" imageUri={avatarUri} displayName={profile?.displayName} />
          </Pressable>
          <View style={styles.identityText}>
            <Heading level={3} numberOfLines={1}>
              {profile?.displayName ?? user?.email ?? 'Learner'}
            </Heading>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {profile?.displayName ? user?.email ?? '' : ''}
            </Text>
            <View style={styles.identityChips}>
              {languageLabel ? <Chip variant="premium" label={languageLabel.toUpperCase()} /> : null}
            </View>
          </View>
        </View>

        {/* Level ladder */}
        <View style={styles.blockSpacing}>
          <LevelBadge level={profile?.level ?? 'beginner'} />
        </View>

        {/* The Total XP / numeric Level tiles used to sit here, behind an adult
            mode check. They are gone for everyone: both are point totals that
            describe how much the app was used, not what the learner can do, and
            the proficiency report below answers the question they only implied.
            Both values still accrue server-side — achievements and offline
            replay depend on the XP ledger. */}

        {/* Proficiency report — the evidence-backed answer to "what level am I
            actually at?", which is the question a point total never answers.
            It sits directly under the level ladder, above achievements and
            completed lessons, because it is the most credible artifact on this
            screen and it used to be the last thing a learner would ever find. */}
        <Pressable
          className="rounded-2xl p-5 mb-4 flex-row items-center"
          style={{
            backgroundColor: colors.premium.tint,
            borderWidth: 1,
            borderColor: colors.premium.base,
          }}
          onPress={() => router.push('/profile/proficiency' as any)}
          accessibilityRole="button"
          accessibilityLabel="View your proficiency report"
          accessibilityHint="Shows your estimated level per skill, what it means, and the evidence behind it"
        >
          <Ionicons name="ribbon-outline" size={24} color={colors.premium.base} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Proficiency Report</Text>
            <Text className="text-sm text-text-secondary">
              Your estimated CEFR level and the evidence behind it
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.premium.base} />
        </Pressable>

        {/* Four Strands balance (Nation, research.md §14.3) */}
        <View className="mb-4">
          <FourStrandsCard totals={strandTotals} />
        </View>

        {/* Achievements */}
        <AchievementGrid />

        {/* Completed Lessons */}
        <CompletedLessonsSection userId={user?.id} />

        {/* My Classes — hidden when school features are disabled */}
        {SCHOOL_ENABLED && (
          <>
            <Text className="text-xl font-bold text-text-primary mb-3">My Classes</Text>

            {enrolledClasses.length > 0 ? (
              enrolledClasses.map((enrollment) => (
                <View key={enrollment.id} className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
                  <Ionicons name="school-outline" size={24} color={colors.premium.base} />
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
              <Ionicons name="add-circle-outline" size={24} color={colors.premium.base} />
              <Text className="text-base font-semibold text-primary ml-3">Join a Class</Text>
            </Pressable>

            {/* Role Switcher — only show if user has teacher role */}
            {roles.includes('teacher') ? (
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
            ) : (
              <Pressable
                className="bg-dark-card rounded-2xl p-5 mb-6 flex-row items-center"
                onPress={() => setBecomeTeacherVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="I teach a class"
              >
                <Ionicons name="school-outline" size={24} color={colors.premium.base} />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-semibold text-text-primary">I teach a class</Text>
                  <Text className="text-sm text-text-secondary">Create classes, assign work, grade submissions</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.correctionChip.grammar.text} />
              </Pressable>
            )}
          </>
        )}

        {/* Settings */}
        <Text className="text-xl font-bold text-text-primary mb-3">Settings</Text>

        <Pressable
          className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
          onPress={() => router.push('/profile/subscription' as any)}
          accessibilityRole="button"
          accessibilityLabel="Subscription"
        >
          <Ionicons name="card" size={24} color={colors.premium.base} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Subscription</Text>
            <Text className="text-sm text-text-secondary capitalize">{subscription?.tier ?? 'Starter'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.correctionChip.grammar.text} />
        </Pressable>

        <Pressable
          className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
          onPress={() => router.push('/profile/settings' as any)}
          accessibilityRole="button"
          accessibilityLabel="Edit settings"
        >
          <Ionicons name="settings" size={24} color={colors.premium.base} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Edit Settings</Text>
            <Text className="text-sm text-text-secondary">Language, level, daily goal, name</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.correctionChip.grammar.text} />
        </Pressable>

        <View className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
          <Ionicons name="language" size={24} color={colors.premium.base} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Target Language</Text>
            <Text className="text-sm text-text-secondary">{languageLabel}</Text>
          </View>
        </View>

        <View className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center">
          <Ionicons name="trending-up" size={24} color={colors.premium.base} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-text-primary">Level</Text>
            <Text className="text-sm text-text-secondary">{levelLabel}</Text>
          </View>
        </View>

        <View className="bg-dark-card rounded-2xl p-5 mb-6 flex-row items-center">
          <Ionicons name="time" size={24} color={colors.premium.base} />
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
    </SafeAreaView>
    <AvatarPresetPicker
      visible={customizerVisible}
      onClose={() => setCustomizerVisible(false)}
      selectedId={profile?.avatarPresetId}
      onSelect={handleSelectPreset}
      onUsePhoto={() => {
        setCustomizerVisible(false);
        setGeneratorVisible(true);
      }}
    />
    <AvatarGeneratorSheet
      visible={generatorVisible}
      onClose={() => setGeneratorVisible(false)}
      onGenerated={handleAvatarGenerated}
      onUpgrade={() => {
        setGeneratorVisible(false);
        router.push('/plans');
      }}
    />
    {SCHOOL_ENABLED && (
      <>
        <JoinClassModal
          visible={joinModalVisible}
          onClose={() => setJoinModalVisible(false)}
          onJoin={handleJoinClass}
        />
        {user?.id && (
          <BecomeTeacherSheet
            visible={becomeTeacherVisible}
            onClose={() => setBecomeTeacherVisible(false)}
            onClaimed={() => {
              setBecomeTeacherVisible(false);
              router.replace('/(teacher)' as any);
            }}
            userId={user.id}
          />
        )}
      </>
    )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 44, // Apple HIG minimum touch target
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: radii.xxl,
    backgroundColor: colors.action.primaryTint,
    borderWidth: 2,
    borderColor: colors.action.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityMeta: {
    fontFamily: typography.family.mono,
    fontSize: typography.scale.tiny.fontSize,
    lineHeight: typography.scale.tiny.lineHeight,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  identityChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xxs,
    marginTop: spacing.xs,
  },
  blockSpacing: {
    marginBottom: spacing.md,
  },
});
