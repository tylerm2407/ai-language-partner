import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { fetchLessonWithExercises } from '../../../lib/supabase-queries';
import { orderExercisesForCognitiveLoad, lessonIsAlreadyOrdered } from '../../../lib/lesson-ordering';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useProfile } from '../../../hooks/useProfile';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { useHearts } from '../../../hooks/useHearts';
import { useLevel } from '../../../hooks/useLevel';
import { useLessonProgress } from '../../../hooks/useLessonProgress';
import { useOnboardingChecklist } from '../../../hooks/useOnboardingChecklist';
import { LessonRunner, type LessonResult } from '../../../components/lesson/LessonRunner';
import { LevelUpModal } from '../../../components/gamification/LevelUpModal';
import { OutOfHeartsModal } from '../../../components/gamification/OutOfHeartsModal';
import { AchievementModal } from '../../../components/gamification/AchievementModal';
import { checkAndAwardAchievements, type AchievementDefinition } from '../../../lib/achievements';
import { Button } from '../../../components/ui/Button';
import { Body } from '../../../components/ui/Text';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors } from '../../../config/theme';
import type { Lesson } from '../../../types';

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useAppStore();
  const { earnXp } = useProfile();
  const { addStats } = useDailyStats();
  const { hearts, maxHearts, isUnlimited, canPlay, loseHeart, nextRegenAt } = useHearts();
  const { levelUpInfo, dismissLevelUp } = useLevel();
  const { markLessonComplete } = useLessonProgress();
  const { markItem: markOnboardingItem } = useOnboardingChecklist();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);
  const [, setAchievementQueue] = useState<AchievementDefinition[]>([]);
  const [showingAchievement, setShowingAchievement] = useState<AchievementDefinition | null>(null);

  const loadLesson = useCallback(() => {
    if (!lessonId) return;
    setLoading(true);
    setLoadError(null);
    fetchLessonWithExercises(lessonId).then((data) => {
      setLesson(data);
      setLoading(false);
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load lesson');
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  // Check if user can play (has hearts) — show modal on mount.
  // Deliberately not keyed on showOutOfHearts: including it re-shows the
  // modal after dismiss (setShowOutOfHearts(false) re-fires the effect while
  // canPlay is still false) until router.back() unmounts the screen.
  useEffect(() => {
    if (!canPlay) {
      setShowOutOfHearts(true);
    }
  }, [canPlay]);

  if (loading) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.league.diamond} />
      </SafeAreaView>
      </GradientBackground>
    );
  }

  // Network/server failure — distinct from "lesson doesn't exist" so the
  // user knows a retry can help.
  if (loadError) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        <Body size="lg" tone="secondary" style={{ marginBottom: 16, textAlign: 'center' }}>
          Couldn't load this lesson. Check your connection and try again.
        </Body>
        <Button label="Try Again" variant="primary" onPress={loadLesson} />
        <View style={{ marginTop: 12 }}>
          <Button label="Go Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!lesson) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        <Body size="lg" tone="secondary" style={{ marginBottom: 16 }}>Lesson not found</Body>
        <Button label="Go Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
      </GradientBackground>
    );
  }

  const handleComplete = async (result: LessonResult) => {
    if (result.xpEarned > 0) {
      await earnXp(result.xpEarned);
    }
    await addStats({
      lessonsCompleted: 1,
      xpEarned: result.xpEarned,
    });

    // Record lesson completion
    if (lesson && user?.id) {
      const score = result.totalExercises > 0 ? result.correctCount / result.totalExercises : 0;
      await markLessonComplete(lesson.id, lesson.courseId ?? '', score, result.xpEarned, 0).catch(console.error);

      // Mark onboarding checklist item
      markOnboardingItem('firstLesson').catch(console.error);

      // Check for new achievements
      if (profile) {
        const { dailyStats } = useAppStore.getState();
        const newAchievements = await checkAndAwardAchievements(user.id, profile, dailyStats).catch(() => []);
        if (newAchievements.length > 0) {
          setAchievementQueue(newAchievements);
          setShowingAchievement(newAchievements[0]);
        }
      }
    }
  };

  const dismissAchievement = () => {
    setAchievementQueue((prev) => {
      const remaining = prev.slice(1);
      setShowingAchievement(remaining[0] ?? null);
      return remaining;
    });
  };

  return (
    <GradientBackground variant="raised">
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <LessonRunner
        exercises={
          lessonIsAlreadyOrdered(lesson.exercises)
            ? lesson.exercises
            : orderExercisesForCognitiveLoad(lesson.exercises)
        }
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        xpReward={lesson.xpReward}
        userId={user?.id ?? ''}
        targetLanguage={profile?.targetLanguage ?? 'es'}
        onComplete={handleComplete}
        onExit={() => router.back()}
        hearts={hearts}
        maxHearts={maxHearts}
        isUnlimitedHearts={isUnlimited}
        nextRegenAt={nextRegenAt}
        onLoseHeart={loseHeart}
      />
      </KeyboardAvoidingView>

      {/* Level Up Modal */}
      {levelUpInfo && (
        <LevelUpModal
          visible={!!levelUpInfo}
          newLevel={levelUpInfo.newLevel}
          newTier={levelUpInfo.newTier}
          tierChanged={levelUpInfo.tierChanged}
          onDismiss={dismissLevelUp}
        />
      )}

      {/* Out of Hearts (pre-lesson check) */}
      <OutOfHeartsModal
        visible={showOutOfHearts && !canPlay}
        nextRegenAt={nextRegenAt}
        onDismiss={() => {
          setShowOutOfHearts(false);
          if (!canPlay) router.back();
        }}
      />

      {/* Achievement Celebration */}
      <AchievementModal
        achievement={showingAchievement}
        visible={!!showingAchievement}
        onDismiss={dismissAchievement}
      />
    </SafeAreaView>
    </GradientBackground>
  );
}
