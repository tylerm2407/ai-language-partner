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
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { radii, spacing } from '../../../config/theme';
import { Heading } from '../../../components/ui2/Ui2Text';
import { Chip } from '../../../components/ui2/Chip';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
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

/** Reproduces the `capitalize` text transform the subscription row used to
 *  carry as a class, so "premium" still reads "Premium". */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  upper_intermediate: 'Upper Intermediate',
  advanced: 'Advanced',
};

export default function ProfileScreen() {
  const { c, type } = useUi2Theme();
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
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
            style={[styles.iconButton, { borderColor: c.cardBorder }]}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={18} color={c.muted} />
          </Pressable>
        </View>

        {/* Identity — avatar in a primary ring, name, mono meta, language chip */}
        <View style={styles.identityRow}>
          <Pressable
            onPress={() => setCustomizerVisible(true)}
            accessibilityLabel="Change avatar"
            accessibilityRole="button"
            style={[styles.avatarRing, { backgroundColor: c.primaryTint, borderColor: c.primary }]}
          >
            <Avatar size="medium" imageUri={avatarUri} displayName={profile?.displayName} />
          </Pressable>
          <View style={styles.identityText}>
            <Heading level={3} numberOfLines={1}>
              {profile?.displayName ?? user?.email ?? 'Learner'}
            </Heading>
            <Text
              style={[styles.identityMeta, { fontFamily: type.ui, color: c.idle }]}
              numberOfLines={1}
            >
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
        <Ui2ListRow
          style={{ marginBottom: spacing.md }}
          icon="ribbon-outline"
          title="Proficiency Report"
          subtitle="Your estimated CEFR level and the evidence behind it"
          onPress={() => router.push('/profile/proficiency' as any)}
          accessibilityLabel="View your proficiency report"
          accessibilityHint="Shows your estimated level per skill, what it means, and the evidence behind it"
        />

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
            <Text className="text-xl font-bold mb-3" style={{ color: c.ink }}>My Classes</Text>

            {enrolledClasses.length > 0 ? (
              enrolledClasses.map((enrollment) => (
                <Ui2ListRow
                  key={enrollment.id}
                  style={{ marginBottom: spacing.sm }}
                  icon="school-outline"
                  title={enrollment.classroom?.name ?? 'Class'}
                  subtitle={`${enrollment.classroom?.targetLanguage?.toUpperCase() ?? ''} · ${enrollment.classroom?.level ?? ''}`}
                />
              ))
            ) : (
              <SlabCard style={{ marginBottom: spacing.sm, alignItems: 'center' }}>
                <Text className="text-sm" style={{ color: c.muted }}>Not enrolled in any classes</Text>
              </SlabCard>
            )}

            <Ui2ListRow
              style={{ marginBottom: spacing.lg }}
              icon="add-circle-outline"
              title="Join a Class"
              onPress={() => setJoinModalVisible(true)}
              accessibilityLabel="Join a class"
            />

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
              <Ui2ListRow
                style={{ marginBottom: spacing.lg }}
                icon="school-outline"
                title="I teach a class"
                subtitle="Create classes, assign work, grade submissions"
                onPress={() => setBecomeTeacherVisible(true)}
                accessibilityLabel="I teach a class"
              />
            )}
          </>
        )}

        {/* Settings */}
        <Text className="text-xl font-bold mb-3" style={{ color: c.ink }}>Settings</Text>

        <Ui2ListRow
          style={{ marginBottom: spacing.sm }}
          icon="card"
          title="Subscription"
          // Was a `capitalize` class on the old row; the tier strings are
          // lowercase in the store, so the same casing is applied here.
          subtitle={capitalize(subscription?.tier ?? 'Starter')}
          onPress={() => router.push('/profile/subscription' as any)}
          accessibilityLabel="Subscription"
        />

        <Ui2ListRow
          style={{ marginBottom: spacing.sm }}
          icon="settings"
          title="Edit Settings"
          subtitle="Language, level, daily goal, name"
          onPress={() => router.push('/profile/settings' as any)}
          accessibilityLabel="Edit settings"
        />

        <Ui2ListRow
          style={{ marginBottom: spacing.sm }}
          icon="language"
          title="Target Language"
          subtitle={languageLabel}
        />

        <Ui2ListRow
          style={{ marginBottom: spacing.sm }}
          icon="trending-up"
          title="Level"
          subtitle={levelLabel}
        />

        <Ui2ListRow
          style={{ marginBottom: spacing.lg }}
          icon="time"
          title="Daily Goal"
          subtitle={`${profile?.dailyGoalMinutes ?? 10} minutes`}
        />

        {/* Sign Out */}
        <Ui2ListRow
          icon="log-out-outline"
          title="Sign Out"
          destructive
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        />
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
    </View>
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityMeta: {
    fontSize: 11,
    lineHeight: 15,
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
