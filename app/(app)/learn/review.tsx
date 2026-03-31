import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReviewQueue } from '../../../hooks/useReviewQueue';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Button } from '../../../components/ui/Button';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { ReviewRating } from '../../../types';

export default function ReviewScreen() {
  const router = useRouter();
  const { items, cards, loading, loadQueue, submitReview } = useReviewQueue();
  const { addStats } = useDailyStats();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const cardStartTime = useRef(Date.now());

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Reset timer when card changes
  useEffect(() => {
    cardStartTime.current = Date.now();
  }, [currentIndex]);

  const handleRate = async (rating: ReviewRating) => {
    if (submitting) return; // Prevent double-tap
    setSubmitting(true);

    const item = items[currentIndex];
    const card = cards[item.cardId];
    const responseTimeMs = Date.now() - cardStartTime.current;

    if (Platform.OS !== 'web') {
      void (rating >= 3
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    }

    try {
      await submitReview(item, rating, card?.targetText ?? '', responseTimeMs);
      await addStats({ cardsReviewed: 1 });
      setReviewed((r) => r + 1);
      setShowAnswer(false);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      Alert.alert('Error', 'Failed to save review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading review cards..." />;
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-dark">
        <EmptyState
          icon="checkmark-circle"
          title="All caught up!"
          description="No cards due for review. Keep learning to add more cards."
          actionLabel="Back to Learn"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const isComplete = currentIndex >= items.length;
  const progress = items.length > 0 ? currentIndex / items.length : 0;

  if (isComplete) {
    return (
      <SafeAreaView className="flex-1 bg-dark items-center justify-center px-8">
        <View className="w-[100px] h-[100px] rounded-full bg-success-bg items-center justify-center mb-6">
          <Text className="text-[32px] font-bold text-success">{reviewed}</Text>
        </View>
        <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
          Review Complete!
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          You reviewed {reviewed} cards. Great work!
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const item = items[currentIndex];
  const card = cards[item.cardId];

  return (
    <SafeAreaView className="flex-1 bg-dark">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Button label="Exit" variant="danger" onPress={() => router.back()} style={{ paddingHorizontal: 16, paddingVertical: 8 }} />
          <Text className="text-text-secondary text-sm">
            {currentIndex + 1} / {items.length}
          </Text>
        </View>
        <ProgressBar progress={progress} />
      </View>

      {/* Card */}
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-2xl font-bold text-text-primary text-center mb-8">
          {card?.targetText ?? 'Loading...'}
        </Text>

        {showAnswer ? (
          <>
            <Text className="text-xl text-primary font-semibold text-center mb-4">
              {card?.nativeText}
            </Text>
            {card?.exampleSentence && (
              <Text className="text-sm text-text-secondary text-center italic mb-4">
                {card.exampleSentence}
              </Text>
            )}
            {card?.exampleSentenceTranslation && (
              <Text className="text-xs text-text-tertiary text-center mb-8">
                {card.exampleSentenceTranslation}
              </Text>
            )}

            {/* Rating buttons — maps to SM-2 ratings */}
            <View className="flex-row gap-3 w-full">
              <Pressable
                className="flex-1 bg-error-bg py-4 rounded-[14px] items-center"
                onPress={() => handleRate(1)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Again — I didn't know this"
              >
                <Text className="text-error-dark text-base font-semibold">Again</Text>
                <Text className="text-error-dark text-xs mt-1">Forgot</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-warning-bg py-4 rounded-[14px] items-center"
                onPress={() => handleRate(3)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Hard — I remembered with effort"
              >
                <Text className="text-warning text-base font-semibold">Hard</Text>
                <Text className="text-warning text-xs mt-1">Struggled</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-success-bg py-4 rounded-[14px] items-center"
                onPress={() => handleRate(4)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Good — I remembered"
              >
                <Text className="text-success text-base font-semibold">Good</Text>
                <Text className="text-success text-xs mt-1">Knew it</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-primary-tint py-4 rounded-[14px] items-center"
                onPress={() => handleRate(5)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Easy — this was trivial"
              >
                <Text className="text-primary text-base font-semibold">Easy</Text>
                <Text className="text-primary text-xs mt-1">Instant</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Button
            label="Show Answer"
            onPress={() => setShowAnswer(true)}
            accessibilityHint="Reveals the translation"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
