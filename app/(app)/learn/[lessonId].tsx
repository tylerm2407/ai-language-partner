import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLessonDetail } from '../../../hooks/useCoursesAndLessons';
import { useProfile } from '../../../hooks/useProfile';
import { useAuth } from '../../../hooks/useAuth';
import { LessonRunner } from '../../../components/lesson/LessonRunner';
import type { LessonResult } from '../../../components/lesson/LessonRunner';
import { upsertDailyStats, addXp, upsertReviewItem, insertReviewLog } from '../../../lib/supabase-queries';
import { calculateNextReview, createNewReviewItem } from '../../../lib/srs';
import { trackEvent } from '../../../lib/analytics';
import type { LanguageCode } from '../../../types';

export default function LessonDetailScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { lesson, isLoading, error } = useLessonDetail(lessonId ?? null);

  const targetLanguage = (profile?.targetLanguage ?? 'es') as LanguageCode;

  const handleComplete = async (results: LessonResult) => {
    if (!user) return;

    trackEvent('lesson_completed', {
      lessonId: results.lessonId,
      accuracy: results.accuracy,
      xpEarned: results.xpEarned,
      timeSpentMs: results.timeSpentMs,
    });

    try {
      // Update daily stats
      await upsertDailyStats(user.id, {
        lessonsCompleted: 1,
        xpEarned: results.xpEarned,
        minutesPracticed: results.timeSpentMs / 60000,
        accuracy: results.accuracy,
      });

      // Award XP
      await addXp(user.id, results.xpEarned);

      // Update SRS for each exercise with a linked card
      for (const result of results.exerciseResults) {
        if (!result.cardId) continue;

        try {
          // Create or update review item for this card
          const newItem = createNewReviewItem(user.id, result.cardId);
          const updated = calculateNextReview(
            { ...newItem, id: '' } as any,
            result.rating
          );

          await upsertReviewItem({
            userId: user.id,
            cardId: result.cardId,
            ...updated,
            lastReviewedAt: new Date().toISOString(),
          });
        } catch {
          // Non-critical: SRS update failed for one card, continue
        }
      }
    } catch {
      // Non-critical: stats update failed
    }

    // Navigate back to learn screen
    router.back();
  };

  const handleExit = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  if (error || !lesson) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          {error ?? 'Lesson not found'}
        </Text>
        <Text
          onPress={() => router.back()}
          style={{ fontSize: 16, color: '#6366F1', marginTop: 12 }}
        >
          Go back
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <LessonRunner
      lesson={lesson}
      targetLanguage={targetLanguage}
      onComplete={handleComplete}
      onExit={handleExit}
    />
  );
}
