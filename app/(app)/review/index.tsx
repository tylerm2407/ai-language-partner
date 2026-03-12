import { useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useReviewQueue } from '../../../hooks/useReviewQueue';
import { AudioPlayButton } from '../../../components/audio/AudioPlayButton';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { trackEvent } from '../../../lib/analytics';
import type { ReviewRating } from '../../../types';

export default function ReviewScreen() {
  const router = useRouter();
  const {
    currentCard,
    isLoading,
    error,
    dueCount,
    reviewedCount,
    correctCount,
    submitReview,
    refresh,
    isComplete,
    queue,
    currentIndex,
  } = useReviewQueue();

  const [showAnswer, setShowAnswer] = useState(false);
  const cardStartRef = useRef(Date.now());

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleRate = async (rating: ReviewRating) => {
    if (!currentCard) return;

    const responseTimeMs = Date.now() - cardStartRef.current;
    const userAnswer = showAnswer ? 'revealed' : '';

    if (rating >= 3) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    await submitReview(rating, userAnswer, responseTimeMs);
    setShowAnswer(false);
    cardStartRef.current = Date.now();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading review queue...</Text>
      </SafeAreaView>
    );
  }

  // ─── Session Complete ─────────────────────────────────────────

  if (isComplete && reviewedCount > 0) {
    const accuracy = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;

    trackEvent('review_completed', {
      cardsReviewed: reviewedCount,
      correctCount,
      accuracy,
    });

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
            Review Complete!
          </Text>

          <View
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              marginTop: 24,
              marginBottom: 32,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#6366F1' }}>
                  {reviewedCount}
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>Reviewed</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#22C55E' }}>
                  {correctCount}
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>Correct</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: accuracy >= 80 ? '#22C55E' : '#F59E0B' }}>
                  {accuracy}%
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>Accuracy</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: '#6366F1',
              paddingHorizontal: 48,
              paddingVertical: 16,
              borderRadius: 14,
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── No Cards Due ─────────────────────────────────────────────

  if (isComplete || !currentCard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
            All caught up!
          </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 }}>
            No cards due for review. Learn new words or come back later.
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/learn')}
            style={{
              backgroundColor: '#6366F1',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Learn New Words</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Review Card ──────────────────────────────────────────────

  const { card } = currentCard;
  const progress = queue.length > 0 ? currentIndex / queue.length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Exit review"
          >
            <Text style={{ fontSize: 20, color: '#666' }}>x</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 14, color: '#666' }}>
            {currentIndex + 1}/{queue.length}
          </Text>
        </View>
      </View>

      {/* Card */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Pressable
          onPress={handleReveal}
          style={{
            width: '100%',
            minHeight: 280,
            backgroundColor: '#F9FAFB',
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          }}
          accessibilityRole="button"
          accessibilityLabel={showAnswer ? 'Card answer shown' : 'Tap to reveal answer'}
        >
          {/* Front: target language text */}
          <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            {card.targetText}
          </Text>

          {card.partOfSpeech && (
            <Text style={{ fontSize: 14, color: '#999', marginBottom: 12, fontStyle: 'italic' }}>
              {card.partOfSpeech}
            </Text>
          )}

          {card.audioUrl && (
            <View style={{ marginBottom: 16 }}>
              <AudioPlayButton audioUrl={card.audioUrl} size={48} />
            </View>
          )}

          {showAnswer ? (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '600', color: '#6366F1', textAlign: 'center' }}>
                {card.nativeText}
              </Text>
              {card.exampleSentence && (
                <Text style={{ fontSize: 15, color: '#666', marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
                  {card.exampleSentence}
                </Text>
              )}
              {card.exampleSentenceTranslation && (
                <Text style={{ fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' }}>
                  {card.exampleSentenceTranslation}
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: '#999', marginTop: 16 }}>
              Tap to reveal
            </Text>
          )}
        </Pressable>
      </View>

      {/* Rating Buttons */}
      {showAnswer && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <RatingButton label="Again" sublabel="1m" color="#EF4444" onPress={() => handleRate(1)} />
            <RatingButton label="Hard" sublabel="6m" color="#F59E0B" onPress={() => handleRate(2)} />
            <RatingButton label="Good" sublabel="10m" color="#22C55E" onPress={() => handleRate(3)} />
            <RatingButton label="Easy" sublabel="4d" color="#6366F1" onPress={() => handleRate(5)} />
          </View>
        </View>
      )}

      {error && (
        <Text style={{ fontSize: 14, color: '#EF4444', textAlign: 'center', paddingBottom: 12 }}>
          {error}
        </Text>
      )}
    </SafeAreaView>
  );
}

function RatingButton({
  label,
  sublabel,
  color,
  onPress,
}: {
  label: string;
  sublabel: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: color,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel={`Rate: ${label}`}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{label}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
    </Pressable>
  );
}
