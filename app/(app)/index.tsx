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
import { GradientButton } from '../../components/ui/GradientButton';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../components/ui/GradientBorderCard';
import { GlassSurface } from '../../components/ui/GlassSurface';
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
import { DailyNewsCard } from '../../components/news/DailyNewsCard';
import { OnboardingChecklist } from '../../components/onboarding/OnboardingChecklist';
import type { DailyStats } from '../../types';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { profile, dailyStats, reviewCount, loading, loadUserData } = useAppStore();
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const { hearts, maxHearts, isUnlimited } = useHearts();
  const { level, tier, xpInLevel, xpToNextLevel, progress: levelProgress } = useLevel();
  const { showRepairModal, brokenStreak, freezesAvailable, repairWithFreeze, dismissRepair, hasShield } = useStreakProtection();
  const { enrolledClasses, pendingAssignments, loadStudentSchoolData } = useSchoolStore();
  const { article, isLoading: newsLoading, isGenerating: newsGenerating, error: newsError, generate: generateNews } = useDailyNews(
    user?.id ?? '',
    profile?.targetLanguage ?? 'es',
    profile?.level ?? 'intermediate'
  );

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
        {/* Onboarding Checklist */}
        <OnboardingChecklist />

        <Text className="text-[28px] font-bold text-text-primary mb-1 text-center">
          Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}!
        </Text>
        <Text className="text-base text-text-secondary mb-6 text-center">
          {profile?.targetLanguage ? `Learning ${profile.targetLanguage.toUpperCase()}` : user?.email}
        </Text>

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

        {/* Daily News */}
        <DailyNewsCard
          article={article}
          isLoading={newsLoading}
          isGenerating={newsGenerating}
          error={newsError}
          onPress={() => {
            if (article) {
              router.push({
                pathname: '/news/[date]',
                params: { date: article.date },
              } as any);
            }
          }}
          onGenerate={generateNews}
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

        <GradientButton
          label="Start a Lesson"
          onPress={() => router.push('/learn' as any)}
          accessibilityHint="Continue where you left off"
          style={{ marginBottom: 12 }}
        />

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
    </View>
    </GradientBackground>
  );
}
