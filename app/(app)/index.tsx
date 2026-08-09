import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { SCHOOL_ENABLED, HANDSFREE_ENABLED, levelToNewsTier } from '../../config/app';
import { fetchStatsRange } from '../../lib/supabase-queries';
import { localDayKey } from '../../lib/dates';
import { getTargetLanguage, targetLanguageGreeting } from '../../lib/language';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { useTimezoneSync } from '../../hooks/useProfile';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { useAdultMode } from '../../hooks/useAdultMode';
import { useLevel } from '../../hooks/useLevel';
import { useStreakProtection } from '../../hooks/useStreakProtection';
import { useDailyNews } from '../../hooks/useDailyNews';
import { useNotifications, scheduleStreakSaveReminder } from '../../hooks/useNotifications';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { StreakRepairModal } from '../../components/gamification/StreakRepairModal';
import { PrePermissionSheet } from '../../components/gamification/PrePermissionSheet';
import { OnboardingChecklistFab } from '../../components/onboarding/OnboardingChecklistFab';
import { DateLabel } from '../../components/magazine/DateLabel';
import { StatsStrip } from '../../components/magazine/StatsStrip';
import { NewsHeroCard } from '../../components/magazine/NewsHeroCard';
import { SessionBand } from '../../components/magazine/SessionBand';
import { LessonTileGrid, unitTilesToLessonTiles } from '../../components/magazine/LessonTile';
import { useUnitProgressTiles } from '../../hooks/useUnitProgressTiles';
import { MagazineDailyChallenges } from '../../components/magazine/MagazineDailyChallenges';
import { WeekInWords } from '../../components/magazine/WeekInWords';
import { MagazineGlassCard } from '../../components/magazine/MagazineGlassCard';
import { Heading } from '../../components/ui/Text';
import { loadErrorCopy, type ErrorCopy } from '../../lib/error-copy';
import { colors, typography, spacing } from '../../config/theme';
import type { DailyStats } from '../../types';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { profile, dailyStats, reviewCount, loadUserData } = useAppStore();
  // Keep user_profiles.timezone tracking the device — the server derives
  // streak/challenge/quota days from it (migration 044). One-shot per session.
  useTimezoneSync();
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [weeklyStatsError, setWeeklyStatsError] = useState<ErrorCopy | null>(null);
  const { showStreak, showDailyChallenges } = useAdultMode();
  useLevel(); // level-up detection mirrors xpLevel/leagueTier into the store
  const { showRepairModal, brokenStreak, freezesAvailable, repairWithFreeze, dismissRepair } = useStreakProtection();
  const { loadStudentSchoolData } = useSchoolStore();
  const schoolEnabled = SCHOOL_ENABLED;
  const newsTier = levelToNewsTier(profile?.level ?? 'intermediate');
  const { article, isLoading: newsLoading, error: newsError, hasRead: newsHasRead } = useDailyNews(
    user?.id ?? '',
    // '' = profile not loaded yet; the hook skips fetching until the real
    // target language is known instead of defaulting to a language.
    getTargetLanguage(profile) ?? '',
    newsTier,
  );
  const { permissionStatus, requestPermissionsExplicit } = useNotifications({ userId: user?.id });
  const { tiles: unitTiles, loading: tilesLoading, error: tilesError, refetch: refetchTiles } = useUnitProgressTiles(
    user?.id,
    profile?.targetLanguage,
    4,
  );
  const lessonTiles = unitTiles ? unitTilesToLessonTiles(unitTiles) : null;
  const { markItem: markChecklistItem } = useOnboardingChecklist();
  const greeting = targetLanguageGreeting(getTargetLanguage(profile));
  const [showPrePermission, setShowPrePermission] = useState(false);

  // Show the pre-permission sheet once, after the learner has completed
  // their first lesson. Only asks if the OS permission is still undetermined;
  // if the user has already granted or denied at the OS level, just mark
  // the checklist item so we don't re-nag.
  useEffect(() => {
    if (showPrePermission) return;
    if (!profile?.onboardingChecklist) return;
    if (permissionStatus === null) return;
    const { firstLesson, dailyReminder } = profile.onboardingChecklist;
    if (!firstLesson || dailyReminder) return;
    if (permissionStatus === 'undetermined') {
      setShowPrePermission(true);
    } else {
      markChecklistItem('dailyReminder').catch(() => {});
    }
  }, [profile?.onboardingChecklist, permissionStatus, showPrePermission, markChecklistItem]);

  const handleEnableReminders = async () => {
    try {
      const status = await requestPermissionsExplicit();
      // The streak-save reminder is the guilt notification adult mode exists to
      // remove, so it is not scheduled while the mode is on.
      if (status === 'granted' && profile && showStreak) {
        await scheduleStreakSaveReminder({
          streak: profile.streak ?? 0,
          xpEarnedToday: dailyStats?.xpEarned ?? 0,
          preferredHour: 21,
          idealL2Self: profile.idealL2Self ?? null,
        });
      }
    } finally {
      await markChecklistItem('dailyReminder').catch(() => {});
      setShowPrePermission(false);
    }
  };

  const handleDismissPrePermission = async () => {
    await markChecklistItem('dailyReminder').catch(() => {});
    setShowPrePermission(false);
  };

  const loadWeeklyStats = useCallback(async (userId: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    const startDate = localDayKey(monday);
    const endDate = localDayKey(today);
    setWeeklyStatsError(null);
    try {
      const stats = await fetchStatsRange(userId, startDate, endDate);
      setWeeklyStats(stats);
    } catch (err) {
      // An empty week and a failed fetch render identically, so this has to be
      // stated rather than swallowed (CLAUDE.md §5).
      setWeeklyStatsError(loadErrorCopy(err, 'this week'));
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserData(user.id);
      loadWeeklyStats(user.id);
      if (schoolEnabled) loadStudentSchoolData(user.id);
    }
  }, [user?.id, loadUserData, loadWeeklyStats, loadStudentSchoolData, schoolEnabled]);

  return (
    <GradientBackground>
      <View className="flex-1">
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        >
          <SafeAreaView edges={['top']}>
            {/* Header — date + target-language greeting. Stats get their own
                row beneath so the greeting has room to breathe (they used to
                share this row with the date).

                The mascot used to sit on the right of this row. It is gone from
                chrome on purpose: a permanent mascot in the header is the
                Duolingo silhouette regardless of what the character looks like.
                The dragon now appears only at moments — celebration, level-up,
                streak-at-risk, empty states — where it lands as an event. */}
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <DateLabel />
                <Heading level={2}>
                  {greeting}
                  {profile?.displayName ? `, ${profile.displayName}` : ''}
                </Heading>
              </View>
            </View>

            <StatsStrip />

            {/* News hero card */}
            <NewsHeroCard
              article={article}
              isLoading={newsLoading}
              error={newsError}
              hasRead={newsHasRead}
              level={cefrBandForProficiencyLevel(profile?.level ?? 'intermediate')}
              onPress={() => {
                if (article) {
                  router.push({
                    pathname: '/news/[date]',
                    params: { date: article.date },
                  } as any);
                }
              }}
            />

            {/* Today's session band */}
            <SessionBand />

            {/* Continue learning — 2-column tiles pulled from user's real curriculum */}
            <LessonTileGrid tiles={lessonTiles} loading={tilesLoading} error={tilesError} onRetry={refetchTiles} />

            {/* Daily challenges — a pressure mechanic, so adult mode drops it */}
            {showDailyChallenges && <MagazineDailyChallenges dailyStats={dailyStats ?? null} />}

            {/* Week in words */}
            <WeekInWords
              stats={weeklyStats}
              error={weeklyStatsError}
              onRetry={() => { if (user?.id) loadWeeklyStats(user.id); }}
            />

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <MagazineGlassCard style={styles.quickAction}>
              <Pressable
                style={styles.quickActionRow}
                onPress={() => router.push('/learn' as any)}
                accessibilityRole="button"
                accessibilityLabel="Start a Lesson"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(79,142,247,0.15)' }]}>
                  <Ionicons name="play" size={18} color={colors.magazine.accentBlue} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Start a Lesson</Text>
                  <Text style={styles.quickActionSub}>Continue where you left off</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
              </Pressable>
            </MagazineGlassCard>

            <MagazineGlassCard style={styles.quickAction}>
              <Pressable
                style={styles.quickActionRow}
                onPress={() => router.push('/chat' as any)}
                accessibilityRole="button"
                accessibilityLabel="Practice with AI"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                  <Ionicons name="chatbubbles" size={18} color={colors.magazine.accentLilac} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>AI Conversation</Text>
                  <Text style={styles.quickActionSub}>Practice speaking with AI</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
              </Pressable>
            </MagazineGlassCard>

            {/* Hands-free. This is the only entry point into the eyes-free
                session: the Practice tab is `href: null` in the tab layout and
                is absent from FloatingTabBar's VISIBLE_TABS, so nothing else
                in the app can reach `/practice`. Removing this link makes the
                feature unreachable rather than merely hidden. */}
            {HANDSFREE_ENABLED && (
              <MagazineGlassCard style={styles.quickAction}>
                <Pressable
                  style={styles.quickActionRow}
                  onPress={() => router.push('/practice/handsfree' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Start a hands-free practice session"
                  accessibilityHint="Runs a spoken review session you can do without looking at the screen"
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                    <Ionicons name="headset" size={18} color={colors.premium.base} />
                  </View>
                  <View style={styles.quickActionText}>
                    <Text style={styles.quickActionTitle}>Hands-free practice</Text>
                    <Text style={styles.quickActionSub}>Speak and listen — no screen needed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
                </Pressable>
              </MagazineGlassCard>
            )}

            {reviewCount > 0 && (
              <MagazineGlassCard style={styles.quickAction}>
                <Pressable
                  style={styles.quickActionRow}
                  onPress={() => router.push('/learn/review' as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${reviewCount} flashcards`}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(34,211,153,0.15)' }]}>
                    <Ionicons name="refresh" size={18} color="#34D399" />
                  </View>
                  <View style={styles.quickActionText}>
                    <Text style={styles.quickActionTitle}>Review Cards</Text>
                    <Text style={styles.quickActionSub}>{reviewCount} cards due</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
                </Pressable>
              </MagazineGlassCard>
            )}
          </SafeAreaView>
        </ScrollView>

        {/* Streak Repair Modal — the streak still runs server-side in adult
            mode, but never interrupts the learner to mourn a broken one. */}
        <StreakRepairModal
          visible={showStreak && showRepairModal}
          brokenStreak={brokenStreak}
          freezesAvailable={freezesAvailable}
          onRepair={repairWithFreeze}
          onDismiss={dismissRepair}
        />

        {/* Pre-permission sheet — shown once, post-first-lesson, before the
            iOS system notification prompt. Lifts opt-in ~2-3× vs cold-firing. */}
        <PrePermissionSheet
          visible={showPrePermission}
          onEnable={handleEnableReminders}
          onDismiss={handleDismissPrePermission}
        />

        {/* Floating onboarding checklist FAB */}
        <OnboardingChecklistFab />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: typography.family.serif,
    fontSize: 18,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
  },
  quickAction: {
    marginBottom: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontFamily: typography.family.semibold,
    fontSize: 15,
    color: colors.text.primary,
  },
  quickActionSub: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 1,
  },
});
