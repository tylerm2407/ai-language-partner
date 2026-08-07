import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { SCHOOL_ENABLED, SUPPORTED_LANGUAGES } from '../../../config/app';
import { useLevel } from '../../../hooks/useLevel';
import { useAdultMode } from '../../../hooks/useAdultMode';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors, radii, spacing, typography } from '../../../config/theme';
import { Heading, Body, Caption } from '../../../components/ui/Text';
import { Chip } from '../../../components/ui/Chip';
import { Card } from '../../../components/ui/Card';
import { LevelBadge } from '../../../components/stats/LevelBadge';
import { LeagueBadge } from '../../../components/gamification/LeagueBadge';
import { AchievementGrid } from '../../../components/gamification/AchievementGrid';
import { Avatar } from '../../../components/avatar/Avatar';
import { AvatarCustomizer } from '../../../components/avatar/AvatarCustomizer';
import { FourStrandsCard } from '../../../components/stats/FourStrandsCard';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { strandMinutesFromDailyStats } from '../../../lib/four-strands';
import { CompletedLessonsSection } from '../../../components/profile/CompletedLessonsSection';
import { DEFAULT_AVATAR_CONFIG } from '../../../components/avatar/constants';
import { updateAvatarConfig, joinClassroom } from '../../../lib/supabase-queries';
import JoinClassModal from '../../../components/school/JoinClassModal';
import RoleSwitcher from '../../../components/school/RoleSwitcher';
import { BecomeTeacherSheet } from '../../../components/school/BecomeTeacherSheet';
import type { AvatarConfig } from '../../../types';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
};

/** One of the three stat tiles under the level ladder. */
function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card style={styles.statCard} variant="standard">
      <View style={styles.statIcon}>{icon}</View>
      <Body size="lg" weight="extrabold" style={styles.statValue}>
        {value}
      </Body>
      <Caption size="sm" tone="tertiary" style={styles.statLabel}>
        {label}
      </Caption>
    </Card>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const { enrolledClasses, loadStudentSchoolData, roles, activeRole, setActiveRole } = useSchoolStore();
  // useLevel() is also a side effect — it mirrors level-ups into the store.
  // Only `tier` is read here; the numeric level moved into <LevelBadge/>.
  const { tier } = useLevel();
  const { showStreak, showLeague, showXpCelebration } = useAdultMode();
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
  const [becomeTeacherVisible, setBecomeTeacherVisible] = useState(false);

  // Load student school data on mount (only when school features enabled)
  useEffect(() => {
    if (SCHOOL_ENABLED && user?.id) loadStudentSchoolData(user.id);
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
            accessibilityLabel="Customize avatar"
            accessibilityRole="button"
            style={styles.avatarRing}
          >
            <Avatar
              config={profile?.avatarConfig ?? undefined}
              size="medium"
              expression="neutral"
              animated
            />
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
              {showLeague && <LeagueBadge tier={tier} />}
            </View>
          </View>
        </View>

        {/* Level ladder */}
        <View style={styles.blockSpacing}>
          <LevelBadge level={profile?.level ?? 'beginner'} />
        </View>

        {/* Three stat cards. The deck's third card is a words-learned count,
            which the profile doesn't track — best streak is the closest real
            metric, same shape.

            Adult mode drops the grid entirely: every value in it is a game
            point. What replaces it is the proficiency report below, which
            answers the question these numbers only imply. */}
        {showStreak && showXpCelebration && (
          <View style={styles.statGrid}>
            <StatCard
              icon={<Ionicons name="flame" size={16} color={colors.streak.fire} />}
              value={String(profile?.streak ?? 0)}
              label="Day streak"
            />
            <StatCard
              icon={<Ionicons name="star" size={16} color={colors.warning.base} />}
              value={(profile?.totalXp ?? 0).toLocaleString()}
              label="Total XP"
            />
            <StatCard
              icon={<Ionicons name="trophy" size={16} color={colors.action.accent} />}
              value={String(profile?.longestStreak ?? 0)}
              label="Best streak"
            />
          </View>
        )}

        {/* Proficiency report — the evidence-backed answer to "what level am I
            actually at?", which is the question a streak count never answers.
            It sits directly under the level ladder, above achievements and
            completed lessons, because it is the most credible artifact on this
            screen and it used to be the last thing a learner would ever find.
            Adult mode has nothing above it at all, so it becomes the first
            thing on the profile — which is the whole point of that mode. */}
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
          accessibilityHint="Shows your estimated CEFR level per skill and the evidence behind it"
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
    <AvatarCustomizer
      visible={customizerVisible}
      onClose={() => setCustomizerVisible(false)}
      initialConfig={profile?.avatarConfig ?? DEFAULT_AVATAR_CONFIG}
      onSave={handleSaveAvatar}
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
  statGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  statValue: {
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    textAlign: 'center',
  },
});
