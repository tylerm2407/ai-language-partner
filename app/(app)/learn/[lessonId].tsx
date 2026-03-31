import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchLessonWithExercises } from '../../../lib/supabase-queries';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useProfile } from '../../../hooks/useProfile';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { useHearts } from '../../../hooks/useHearts';
import { useLevel } from '../../../hooks/useLevel';
import { LessonRunner, type LessonResult } from '../../../components/lesson/LessonRunner';
import { LevelUpModal } from '../../../components/gamification/LevelUpModal';
import { OutOfHeartsModal } from '../../../components/gamification/OutOfHeartsModal';
import { Button } from '../../../components/ui/Button';
import { GradientBackground } from '../../../components/ui/GradientBackground';
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
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    fetchLessonWithExercises(lessonId).then((data) => {
      setLesson(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lessonId]);

  // Check if user can play (has hearts) — show modal on mount
  useEffect(() => {
    if (!canPlay && !showOutOfHearts) {
      setShowOutOfHearts(true);
    }
  }, [canPlay]);

  if (loading) {
    return (
      <GradientBackground>
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#38BDF8" />
      </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!lesson) {
    return (
      <GradientBackground>
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        <Text className="text-lg text-text-secondary mb-4">Lesson not found</Text>
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
  };

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      <LessonRunner
        exercises={lesson.exercises}
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
    </SafeAreaView>
    </GradientBackground>
  );
}
