import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { fetchStatsRange } from '../../lib/supabase-queries';
import AssignmentCard from '../../components/school/AssignmentCard';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { GlassSurface } from '../../components/ui/GlassSurface';
import { TactileButton } from '../../components/ui/TactileButton';
import { HeroHook } from '../../components/home/HeroHook';
import { WeeklyChart } from '../../components/stats/WeeklyChart';
import { DailyChallenges } from '../../components/gamification/DailyChallenges';
import { LevelProgressCard } from '../../components/gamification/LevelProgressCard';
import { LeagueBadge } from '../../components/gamification/LeagueBadge';
import { StreakShieldBadge } from '../../components/gamification/StreakShieldBadge';
import { StreakRepairModal } from '../../components/gamification/StreakRepairModal';
import { StreakFireAnimation } from '../../components/animations/StreakFireAnimation';
import { HeartsDisplay } from '../../components/gamification/HeartsDisplay';
import { useHearts } from '../../hooks/useHearts';
import { useLevel } from '../../hooks/useLevel';
import { useStreakProtection } from '../../hooks/useStreakProtection';
import { useDailyNews } from '../../hooks/useDailyNews';
import { useNotifications, scheduleStreakSaveReminder } from '../../hooks/useNotifications';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { DailyNewsCard } from '../../components/news/DailyNewsCard';
import { OnboardingChecklistFab } from '../../components/onboarding/OnboardingChecklistFab';
import { PrePermissionSheet } from '../../components/gamification/PrePermissionSheet';
import { levelToNewsTier } from '../../config/app';
import type { DailyStats } from '../../types';

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
        });
      }
    } finally {
      await markChecklistItem('dailyReminder').catch(() => {});
      setShowPrePermission(false);
    }
  };

  const handleDismissPrePermission = async () => {
    // Mark the checklist so we don't keep nagging. User can still opt in
    // later via Settings → Notifications.
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
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Personalized greeting with mascot — time-of-day + motivation-tied outcome line */}
        <HeroHook
          displayName={profile?.displayName}
          targetLanguage={profile?.targetLanguage}
          dailyGoalMinutes={profile?.dailyGoalMinutes ?? 10}
          streak={profile?.streak ?? 0}
          motivation={motivation}
          fallbackSubtitle={profile?.targetLanguage ? null : (user?.email ?? null)}
        />

        {/* Stats Row */}
        <View className="flex-row gap-3 mb-6">
          <GlassSurface style={{ flex: 1 }} innerStyle={{ padding: 16, alignItems: 'center' }}>
            <View className="flex-row items-center gap-1 mb-1">
              <StreakFireAnimation streak={profile?.streak ?? 0} visible={(profile?.streak ?? 0) >= 7} />
              <Text className="text-2xl font-bold text-streak">{profile?.streak ?? 0}</Text>
            </View>
            <Text className="text-sm text-text-secondary mb-1">Day Streak</Text>
            {hasShield && <StreakShieldBadge active={true} />}
            {/* Weekly activity dots */}
            <View className="flex-row gap-1 mt-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const date = new Date(today);
                date.setDate(today.getDate() - mondayOffset + i);
                const dateStr = date.toISOString().split('T')[0];
                const hasActivity = weeklyStats.some((s) => s.date === dateStr && s.xpEarned > 0);
                return (
                  <View
                    key={i}
                    className={`w-3 h-3 rounded-full ${hasActivity ? 'bg-streak' : 'bg-dark-card-alt'}`}
                  />
                );
              })}
            </View>
          </GlassSurface>
          <GlassSurface style={{ flex: 1 }} innerStyle={{ padding: 16, alignItems: 'center' }}>
            <Text className="text-2xl font-bold text-primary">{profile?.totalXp ?? 0}</Text>
            <Text className="text-sm text-text-secondary mb-1">Total XP</Text>
            <LeagueBadge tier={tier} size="small" />
          </GlassSurface>
          <GlassSurface style={{ flex: 1 }} innerStyle={{ padding: 16, alignItems: 'center' }}>
            <HeartsDisplay hearts={hearts} maxHearts={maxHearts} isUnlimited={isUnlimited} />
            <Text className="text-sm text-text-secondary mt-1">Hearts</Text>
          </GlassSurface>
        </View>

        {/* Daily News — article pre-generated at 5 AM ET by the cron */}
        <DailyNewsCard
          article={article}
          isLoading={newsLoading}
          error={newsError}
          hasRead={newsHasRead}
          onPress={() => {
            if (article) {
              router.push({
                pathname: '/news/[date]',
                params: { date: article.date },
              } as any);
            }
          }}
        />

        {/* My Assignments */}
        {enrolledClasses.length > 0 && pendingAssignments.length > 0 && (
          <>
            <View className="flex-row items-center justify-between mb-3 mt-4">
              <Text className="text-xl font-bold text-text-primary">Assignments</Text>
              <Pressable onPress={() => router.push('/assignments' as any)}>
                <Text className="text-sm text-primary font-semibold">See All</Text>
              </Pressable>
            </View>
            {pendingAssignments.slice(0, 3).map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                submission={assignment.submission}
                onPress={() => router.push(`/assignments/${assignment.id}` as any)}
              />
            ))}
          </>
        )}

        {/* Daily Challenges */}
        <DailyChallenges dailyStats={dailyStats ?? null} />

        {/* Weekly Chart */}
        <WeeklyChart stats={weeklyStats} metric="xpEarned" />

        {/* Level Progress */}
        <View className="mt-4">
          <LevelProgressCard
            level={level}
            tier={tier}
            xpInLevel={xpInLevel}
            xpToNextLevel={xpToNextLevel}
            progress={levelProgress}
            totalXp={profile?.totalXp ?? 0}
          />
        </View>

        {/* Quick Actions */}
        <Text className="text-xl font-bold text-text-primary mb-3 mt-6">Quick Actions</Text>

        <View style={{ marginBottom: 12 }}>
          <TactileButton
            label="Start a Lesson"
            onPress={() => router.push('/learn' as any)}
            accessibilityLabel="Continue where you left off"
          />
        </View>

        <GlassSurface style={{ marginBottom: 12 }}>
          <Pressable
            className="p-5 flex-row items-center"
            onPress={() => router.push('/chat' as any)}
            accessibilityRole="button"
            accessibilityLabel="Practice with AI"
          >
            <Ionicons name="chatbubbles" size={24} color="#A855F7" />
            <View className="ml-4 flex-1">
              <Text className="text-text-primary text-lg font-semibold">AI Conversation</Text>
              <Text className="text-text-secondary text-sm">Practice speaking with AI</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
          </Pressable>
        </GlassSurface>

        {reviewCount > 0 && (
          <GlassSurface style={{ marginBottom: 12 }}>
            <Pressable
              className="p-5 flex-row items-center"
              onPress={() => router.push('/learn/review' as any)}
              accessibilityRole="button"
              accessibilityLabel={`Review ${reviewCount} flashcards`}
            >
              <Ionicons name="refresh" size={24} color="#34D399" />
              <View className="ml-4 flex-1">
                <Text className="text-text-primary text-lg font-semibold">Review Cards</Text>
                <Text className="text-text-secondary text-sm">{reviewCount} cards due</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
            </Pressable>
          </GlassSurface>
        )}

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

      {/* Floating onboarding checklist — Appcues / Userpilot-style progress
          ring FAB. Lifted above the tab bar; tap to open a bottom sheet
          with the full list. Auto-hides when complete or dismissed. */}
      <OnboardingChecklistFab />
    </View>
    </GradientBackground>
  );
}
