import { View, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { useEffect, useState, useRef } from 'react';
import { haptic } from '../../../lib/haptics';
import { useReviewQueue } from '../../../hooks/useReviewQueue';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { Ui2ProgressBar } from '../../../components/ui2/Ui2ProgressBar';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { Heading, Body, Caption } from '../../../components/ui2/Ui2Text';
import type { ReviewRating } from '../../../types';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `spacing` is a
// plain scheme-independent number set.
import { spacing } from '../../../config/theme';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useScreenView } from '../../../hooks/useScreenView';
import { trackEvent } from '../../../lib/analytics';

export default function ReviewScreen() {
  useScreenView('review');
  const { c, shape } = useUi2Theme();
  const goBack = useSafeBack('/(app)');
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

  const isComplete = !loading && items.length > 0 && currentIndex >= items.length;

  // Finishing the queue is the accomplishment, and until now it was the one
  // silent step in the session: every individual card buzzed on rating, then
  // the last one dropped the learner onto "Review Complete!" with no feedback
  // at all. Declared up here rather than beside the completion branch because
  // that branch sits after two early returns, and a hook cannot go there.
  useEffect(() => {
    if (isComplete) haptic('complete');
  }, [isComplete]);

  /**
   * The session, not the cards.
   *
   * Deliberately NOT one event per card. `review_logs` already stores every
   * review with `was_correct` and a timestamp, so per-card events would pay a
   * second time — in event volume, and eventually in money — for data already
   * in Postgres and queryable there. What analytics adds is the SESSION shape:
   * did they start one, and did they finish it.
   */
  const sessionStartedRef = useRef(false);
  useEffect(() => {
    if (loading || items.length === 0 || sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    trackEvent('review_started', { count: items.length });
  }, [loading, items.length]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || completedRef.current) return;
    completedRef.current = true;
    trackEvent('review_completed', { count: reviewed });
  }, [isComplete, reviewed]);

  const handleRate = async (rating: ReviewRating) => {
    if (submitting) return; // Prevent double-tap
    setSubmitting(true);

    const item = items[currentIndex];
    const card = cards[item.cardId];
    const responseTimeMs = Date.now() - cardStartTime.current;

    haptic(rating >= 3 ? 'correct' : 'incorrect');

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
    // Was <LoadingScreen>, which is a Dark Glow component: it paints `bg-dark`
    // and a fixed indigo spinner, so it would stay black on a light phone.
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
        <Body size="sm" tone="tertiary" style={{ marginTop: spacing.md }}>Loading review cards...</Body>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
        <Ui2EmptyState
          icon="checkmark-circle"
          title="All caught up!"
          description="No cards due for review. Keep learning to add more cards."
          actionLabel="Back to Learn"
          onAction={() => goBack()}
        />
      </SafeAreaView>
    );
  }

  const progress = items.length > 0 ? currentIndex / items.length : 0;

  if (isComplete) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: c.bg }}>
        <View
          className="w-[100px] h-[100px] rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: c.greenTint, borderColor: c.greenBorder, borderWidth: shape.border }}
        >
          <Heading level={1}>{reviewed}</Heading>
        </View>
        <Heading level={2} style={{ marginBottom: spacing.xs }} accessibilityRole="header">
          Review Complete!
        </Heading>
        <Body tone="secondary" style={{ marginBottom: spacing.xl }}>
          You reviewed {reviewed} cards.
        </Body>
        <SlabButton label="Done" arrow={false} onPress={() => goBack()} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  const item = items[currentIndex];
  const card = cards[item.cardId];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <SlabButton label="Exit" variant="ghost" arrow={false} onPress={() => goBack()} style={{ paddingHorizontal: 16, paddingVertical: 8 }} />
          <Body size="sm" tone="secondary">
            {currentIndex + 1} / {items.length}
          </Body>
        </View>
        <Ui2ProgressBar progress={progress} />
      </View>

      {/* Card. Scrolls rather than centres-and-clips: with the answer shown
          this is five stacked text blocks plus four rating buttons, which does
          not fit a small phone at the larger Dynamic Type sizes. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        <Heading level={2} style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          {card?.targetText ?? 'Loading...'}
        </Heading>

        {showAnswer ? (
          <>
            <Body size="lg" weight="semibold" tone="accent" style={{ textAlign: 'center', marginBottom: spacing.md }}>
              {card?.nativeText}
            </Body>
            {card?.exampleSentence && (
              <Body size="sm" tone="secondary" style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: spacing.md }}>
                {card.exampleSentence}
              </Body>
            )}
            {card?.exampleSentenceTranslation && (
              <Caption size="sm" tone="tertiary" style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                {card.exampleSentenceTranslation}
              </Caption>
            )}

            {/* Rating buttons — maps to SM-2 ratings */}
            <View className="flex-row gap-3 w-full">
              {/* The four SM-2 ratings. The fill carries the family and the
                  LABEL carries the meaning — mobile-ui.md forbids a colour-only
                  cue, and UI 2.0 has no error tint, so `pink` is the warm end of
                  the scale. Text is `ink` on the three tints whose own hue is
                  too light to clear AA on its tint in the light scheme. */}
              <Pressable
                className="flex-1 py-4 rounded-[14px] items-center"
                style={{ backgroundColor: c.pinkTint, borderColor: c.pinkTint, borderWidth: shape.border }}
                onPress={() => handleRate(1)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Again — I didn't know this"
              >
                <Body weight="semibold">Again</Body>
                <Caption size="sm" style={{ marginTop: 4 }}>Forgot</Caption>
              </Pressable>
              <Pressable
                className="flex-1 py-4 rounded-[14px] items-center"
                style={{ backgroundColor: c.yellowTint, borderColor: c.yellowBorder, borderWidth: shape.border }}
                onPress={() => handleRate(3)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Hard — I remembered with effort"
              >
                <Body weight="semibold">Hard</Body>
                <Caption size="sm" style={{ marginTop: 4 }}>Struggled</Caption>
              </Pressable>
              <Pressable
                className="flex-1 py-4 rounded-[14px] items-center"
                style={{ backgroundColor: c.greenTint, borderColor: c.greenBorder, borderWidth: shape.border }}
                onPress={() => handleRate(4)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Good — I remembered"
              >
                <Body weight="semibold">Good</Body>
                <Caption size="sm" style={{ marginTop: 4 }}>Knew it</Caption>
              </Pressable>
              <Pressable
                className="flex-1 py-4 rounded-[14px] items-center"
                style={{ backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder, borderWidth: shape.border }}
                onPress={() => handleRate(5)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Easy — this was trivial"
              >
                <Body weight="semibold" tone="accent">Easy</Body>
                <Caption size="sm" tone="accent" style={{ marginTop: 4 }}>Instant</Caption>
              </Pressable>
            </View>
          </>
        ) : (
          <SlabButton
            label="Show Answer"
            arrow={false}
            onPress={() => setShowAnswer(true)}
            accessibilityHint="Reveals the translation"
            style={{ alignSelf: 'stretch' }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
