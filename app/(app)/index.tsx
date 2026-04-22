import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { fetchStatsRange } from '../../lib/supabase-queries';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { useHearts } from '../../hooks/useHearts';
import { useLevel } from '../../hooks/useLevel';
import { useStreakProtection } from '../../hooks/useStreakProtection';
import { useDailyNews } from '../../hooks/useDailyNews';
import { useNotifications, scheduleStreakSaveReminder } from '../../hooks/useNotifications';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { StreakRepairModal } from '../../components/gamification/StreakRepairModal';
import { PrePermissionSheet } from '../../components/gamification/PrePermissionSheet';
import { OnboardingChecklistFab } from '../../components/onboarding/OnboardingChecklistFab';
import { levelToNewsTier } from '../../config/app';
import { DateLabel } from '../../components/magazine/DateLabel';
import { StatsStrip } from '../../components/magazine/StatsStrip';
import { NewsHeroCard } from '../../components/magazine/NewsHeroCard';
import { SessionBand } from '../../components/magazine/SessionBand';
import { LessonTileGrid, unitTilesToLessonTiles } from '../../components/magazine/LessonTile';
import { useUnitProgressTiles } from '../../hooks/useUnitProgressTiles';
import { MagazineDailyChallenges } from '../../components/magazine/MagazineDailyChallenges';
import { WeekInWords } from '../../components/magazine/WeekInWords';
import { MagazineGlassCard } from '../../components/magazine/MagazineGlassCard';
import { colors, typography } from '../../config/theme';
import type { DailyStats } from '../../types';

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { profile, dailyStats, reviewCount, loading, loadUserData, motivation } = useAppStore();
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const { hearts, maxHearts, isUnlimited } = useHearts();
  const { level, tier, xpInLevel, xpToNextLevel, progress: levelProgress } = useLevel();
  const { showRepairModal, brokenStreak, freezesAvailable, repairWithFreeze, dismissRepair, hasShield } = useStreakProtection();
  const { enrolledClasses, pendingAssignments, loadStudentSchoolData } = useSchoolStore();
  const newsTier = levelToNewsTier(profile?.level ?? 'intermediate');
  const { article, isLoading: newsLoading, error: newsError, hasRead: newsHasRead } = useDailyNews(
    user?.id ?? '',
    profile?.targetLanguage ?? 'es',
    newsTier,
  );
  const { permissionStatus, requestPermissionsExplicit } = useNotifications({ userId: user?.id });
  const { tiles: unitTiles, loading: tilesLoading } = useUnitProgressTiles(
    user?.id,
    profile?.targetLanguage,
    4,
  );
  const lessonTiles = unitTiles ? unitTilesToLessonTiles(unitTiles) : null;
  const { markItem: markChecklistItem } = useOnboardingChecklist();
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
      if (status === 'granted' && profile) {
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
    const startDate = monday.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    try {
      const stats = await fetchStatsRange(userId, startDate, endDate);
      setWeeklyStats(stats);
    } catch {
      // Silently fail — chart just shows empty
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserData(user.id);
      loadWeeklyStats(user.id);
      loadStudentSchoolData(user.id);
    }
  }, [user?.id, loadUserData, loadWeeklyStats, loadStudentSchoolData]);

  return (
    <GradientBackground>
      <View className="flex-1">
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        >
          <SafeAreaView edges={['top']}>
            {/* Header row — date on left, stats pills on right */}
            <View style={styles.headerRow}>
              <DateLabel />
              <StatsStrip />
            </View>

            {/* News hero card */}
            <NewsHeroCard
              article={article}
              isLoading={newsLoading}
              error={newsError}
              hasRead={newsHasRead}
              level={profile?.level ?? 'intermediate'}
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
            <LessonTileGrid tiles={lessonTiles} loading={tilesLoading} />

            {/* Daily challenges */}
            <MagazineDailyChallenges dailyStats={dailyStats ?? null} />

            {/* Week in words */}
            <WeekInWords stats={weeklyStats} />

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

        {/* Streak Repair Modal */}
        <StreakRepairModal
          visible={showRepairModal}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
    marginTop: 4,
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
