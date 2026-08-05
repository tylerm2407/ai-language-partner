import { useEffect, useState, useRef } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useReviewQueue } from '../../../hooks/useReviewQueue';
import { AudioPlayButton } from '../../../components/audio/AudioPlayButton';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { TactileButton } from '../../../components/ui/TactileButton';
import { Heading, Body, Caption } from '../../../components/ui/Text';
import { trackEvent } from '../../../lib/analytics';
import { colors, spacing, radii } from '../../../config/theme';
import type { ReviewRating } from '../../../types';
import { GlowLayer } from '../../../components/ui/GlowBackground';

export default function ReviewScreen() {
  const router = useRouter();
  const { items, cards, loading, loadQueue, submitReview } = useReviewQueue();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const cardStartRef = useRef(Date.now());
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const queue = items;
  const isLoading = loading;
  const currentItem = items[currentIndex] ?? null;
  const currentCardData = currentItem ? cards[currentItem.cardId] : null;
  const currentCard = currentItem && currentCardData ? { item: currentItem, card: currentCardData } : null;
  const isComplete = !loading && items.length > 0 && currentIndex >= items.length;

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleRate = async (rating: ReviewRating) => {
    if (!currentCard) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const responseTimeMs = Date.now() - cardStartRef.current;
    const userAnswer = showAnswer ? 'revealed' : '';

    try {
      if (rating >= 3) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      await submitReview(currentCard.item, rating, userAnswer, responseTimeMs);
      setReviewedCount((r) => r + 1);
      if (rating >= 3) setCorrectCount((c) => c + 1);
      setCurrentIndex((i) => i + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setShowAnswer(false);
      cardStartRef.current = Date.now();
      isSubmittingRef.current = false;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <GlowLayer />
        <ActivityIndicator size="large" color={colors.league.diamond} />
        <Body size="sm" tone="tertiary" style={{ marginTop: spacing.sm }}>Loading review queue...</Body>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
        <GlowLayer />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Heading level={1} style={{ marginBottom: spacing.xs }}>
            Review Complete!
          </Heading>

          <View
            style={{
              backgroundColor: colors.surface.card,
              borderRadius: radii.xxl,
              padding: spacing.lg,
              width: '100%',
              marginTop: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Heading level={1} style={{ color: colors.league.diamond }}>
                  {reviewedCount}
                </Heading>
                <Caption tone="tertiary">Reviewed</Caption>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Heading level={1} style={{ color: colors.success.base }}>
                  {correctCount}
                </Heading>
                <Caption tone="tertiary">Correct</Caption>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Heading level={1} style={{ color: accuracy >= 80 ? colors.success.base : colors.warning.base }}>
                  {accuracy}%
                </Heading>
                <Caption tone="tertiary">Accuracy</Caption>
              </View>
            </View>
          </View>

          <TactileButton label="Done" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── No Cards Due ─────────────────────────────────────────────

  if (isComplete || !currentCard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
        <GlowLayer />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Heading level={1} style={{ marginBottom: spacing.xs }}>
            All caught up!
          </Heading>
          <Body tone="tertiary" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            No cards due for review. Learn new words or come back later.
          </Body>
          <TactileButton
            label="Learn New Words"
            onPress={() => router.push('/(app)/learn')}
            style={{ marginBottom: spacing.sm }}
          />
          {/* Top-mistakes drill entry (research.md §10 — Lyster & Ranta). */}
          <Pressable
            onPress={() => router.push('/(app)/review/top-mistakes')}
            style={{
              paddingHorizontal: spacing.md + spacing.xxs,
              paddingVertical: spacing.xs + 2,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
            accessibilityRole="button"
          >
            <Body size="sm" tone="tertiary">See top mistakes this week</Body>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Review Card ──────────────────────────────────────────────

  const { card } = currentCard;
  const progress = queue.length > 0 ? currentIndex / queue.length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <GlowLayer />
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md + spacing.xxs, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: spacing.xs, marginRight: spacing.xs }}
            accessibilityRole="button"
            accessibilityLabel="Exit review"
          >
            <Body tone="tertiary" style={{ fontSize: 20 }}>x</Body>
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </View>
          <Body size="sm" tone="tertiary" style={{ marginLeft: spacing.sm }}>
            {currentIndex + 1}/{queue.length}
          </Body>
        </View>
      </View>

      {/* Card */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Pressable
          onPress={handleReveal}
          style={{
            width: '100%',
            minHeight: 280,
            backgroundColor: colors.surface.card,
            borderRadius: radii.xxl + 4,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
          accessibilityRole="button"
          accessibilityLabel={showAnswer ? 'Card answer shown' : 'Tap to reveal answer'}
        >
          {/* Front: target language text */}
          <Heading level={1} style={{ textAlign: 'center', marginBottom: spacing.xs }}>
            {card.targetText}
          </Heading>

          {card.partOfSpeech && (
            <Body size="sm" style={{ color: colors.text.quaternary, marginBottom: spacing.sm, fontStyle: 'italic' }}>
              {card.partOfSpeech}
            </Body>
          )}

          {card.audioUrl && (
            <View style={{ marginBottom: spacing.md }}>
              <AudioPlayButton audioUrl={card.audioUrl} size={48} />
            </View>
          )}

          {showAnswer ? (
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.surface.cardAlt, width: '100%', alignItems: 'center' }}>
              <Heading level={3} style={{ color: colors.league.diamond, textAlign: 'center' }}>
                {card.nativeText}
              </Heading>
              {card.exampleSentence && (
                <Body size="sm" tone="tertiary" style={{ marginTop: spacing.sm, textAlign: 'center', fontStyle: 'italic' }}>
                  {card.exampleSentence}
                </Body>
              )}
              {card.exampleSentenceTranslation && (
                <Body size="sm" style={{ color: colors.text.quaternary, marginTop: spacing.xxs, textAlign: 'center' }}>
                  {card.exampleSentenceTranslation}
                </Body>
              )}
            </View>
          ) : (
            <Body size="sm" style={{ color: colors.text.quaternary, marginTop: spacing.md }}>
              Tap to reveal
            </Body>
          )}
        </Pressable>
      </View>

      {/* Rating Buttons */}
      {showAnswer && (
        <View style={{ paddingHorizontal: spacing.md + spacing.xxs, paddingBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {/* Rating scale matches learn/review.tsx and .claude/rules/learning.md
                (3+ = pass): Again=1 fails/resets, Hard=3 passes with difficulty. */}
            <RatingButton label="Again" sublabel="1m" color={colors.error.base} onPress={() => handleRate(1)} />
            <RatingButton label="Hard" sublabel="6m" color={colors.warning.base} onPress={() => handleRate(3)} />
            <RatingButton label="Good" sublabel="10m" color={colors.success.base} onPress={() => handleRate(4)} />
            <RatingButton label="Easy" sublabel="4d" color={colors.league.diamond} onPress={() => handleRate(5)} />
          </View>
        </View>
      )}

      {error && (
        <Body size="sm" tone="error" style={{ textAlign: 'center', paddingBottom: spacing.sm }}>
          {error}
        </Body>
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
        paddingVertical: spacing.sm + 2,
        borderRadius: radii.lg,
        alignItems: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel={`Rate: ${label}`}
    >
      <Body size="sm" tone="onPrimary" weight="bold">{label}</Body>
      <Caption size="sm" tone="onPrimary" style={{ opacity: 0.7, marginTop: 2 }}>{sublabel}</Caption>
    </Pressable>
  );
}
