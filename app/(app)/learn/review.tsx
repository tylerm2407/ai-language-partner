import { View, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useRef } from 'react';
import { haptic } from '../../../lib/haptics';
import { useReviewQueue, type ReviewQueueMode } from '../../../hooks/useReviewQueue';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { useActiveTime } from '../../../hooks/useActiveTime';
import { Ui2ProgressBar } from '../../../components/ui2/Ui2ProgressBar';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { Heading, Body } from '../../../components/ui2/Ui2Text';
import { ReviewChoiceCard } from '../../../components/review/ReviewChoiceCard';
import {
  applyChoiceResult,
  buildChoiceOptions,
  choiceRating,
  createChoiceSession,
  currentId,
  isComplete as isSessionComplete,
  isFirstAttempt,
  sessionIds,
  type ChoiceSession,
} from '../../../lib/review-choices';
import { loadErrorCopy, saveErrorCopy } from '../../../lib/error-copy';
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
  const router = useRouter();
  // Exit, Done and Back to Learn all land on the Learn tab, whatever opened
  // the review. This screen lives on the learn stack but is pushed from other
  // tabs too (Home's due-cards card, the chat debrief, the patterns screen).
  // A plain back() from those pops the TAB switch and drops the learner on
  // Home, and a replace() when Learn's index is already underneath leaves two
  // copies of Learn on the stack. So: pop to the stack root when there is
  // one, and only when this screen IS the root swap it for Learn.
  const goBack = () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/(app)/learn');
  };
  // `?mode=struggling` deals only the words the learner keeps failing (Home's
  // "Your patterns" card and the patterns screen link here). Anything else
  // is the ordinary due queue.
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: ReviewQueueMode = params.mode === 'struggling' ? 'struggling' : 'due';
  const { items, cards, pool, loading, error, loadQueue, submitReview } = useReviewQueue(mode);
  const { addStats } = useDailyStats();
  // Time on the queue, not time on the spinner. See hooks/useActiveTime.ts.
  useActiveTime({ kind: 'review', enabled: !loading });
  // The in-session queue (lib/review-choices.ts): a missed card comes back
  // before the session ends, but only its first showing reaches SM-2.
  const [session, setSession] = useState<ChoiceSession>(() => createChoiceSession([]));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ correct: boolean; answer: string; responseTimeMs: number } | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const cardStartTime = useRef(Date.now());

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // The queue is dealt once, from the loaded items that have a card. Keyed on
  // the item ids so a stale-while-revalidate refresh that returns the same
  // queue does not reset a session in progress, while a genuinely different
  // queue does.
  //
  // Reset DURING RENDER, not in an effect. An effect runs after the commit,
  // so the render in which `items` first lands still saw the empty session:
  // no current id, index -1, and `items[-1].cardId` threw before the effect
  // could run. Setting state mid-render on a key change is React's own
  // pattern for derived state; it re-renders before anything is painted.
  const dealtIds = sessionIds(items, cards);
  const queueKey = dealtIds.join('|');
  const [sessionKey, setSessionKey] = useState(queueKey);
  if (sessionKey !== queueKey) {
    setSessionKey(queueKey);
    setSession(createChoiceSession(dealtIds));
    setSelected(null);
    setPending(null);
  }

  const currentItemId = currentId(session);
  const currentIndex = currentItemId ? items.findIndex((i) => i.id === currentItemId) : -1;

  const attemptNo = currentItemId ? session.attempts[currentItemId] ?? 0 : 0;

  // Options are dealt once per SHOWING — a re-ask of the same card is a new
  // showing, hence attemptNo — and redealt only if the pool changes size,
  // which is a bigger pool landing after the cards. They are not redealt when
  // a stale-while-revalidate refresh hands back the same queue as new object
  // references: the rows must not reshuffle while the learner is reading
  // them. Once picked they are FROZEN, whatever arrives.
  const frozenOptions = useRef<string[]>([]);
  const poolSize = pool.length;
  const options = useMemo(() => {
    if (selected !== null) return frozenOptions.current;
    const item = items.find((i) => i.id === currentItemId);
    const card = item ? cards[item.cardId] : undefined;
    frozenOptions.current = card ? buildChoiceOptions(card, pool) : [];
    return frozenOptions.current;
    // items/cards/pool are read but deliberately not deps — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemId, attemptNo, poolSize, selected]);

  // The clock starts when the rows the learner will answer are on screen, so
  // it follows `options`: a redeal (pool landing late) restarts it, a pick
  // (which returns the frozen array, same reference) does not.
  useEffect(() => {
    cardStartTime.current = Date.now();
  }, [options]);

  const isComplete = !loading && isSessionComplete(session);

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
    // The struggling entry points fire their own `review_started` with
    // `source: 'struggling'` before navigating; this one covers the due queue.
    if (mode === 'due') trackEvent('review_started', { count: items.length });
  }, [loading, items.length, mode]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || completedRef.current) return;
    completedRef.current = true;
    trackEvent('review_completed', { count: reviewed, source: mode });
  }, [isComplete, reviewed, mode]);

  /**
   * The pick. Graded here so the verdict shows at once; the write waits for
   * Continue, so a slow network never sits between the tap and the colour.
   */
  const handleAnswer = (correct: boolean, answer: string) => {
    if (selected !== null) return;
    setSelected(answer);
    setPending({ correct, answer, responseTimeMs: Date.now() - cardStartTime.current });
  };

  /**
   * Continue. A first showing is a real review: SM-2 hears the rating and a
   * review_log row is written. A re-ask is drill on an answer the learner has
   * already been shown, so nothing is written — the miss that caused it has
   * already reset the card to tomorrow, and that is the schedule that stands
   * until they get it right on a fresh day.
   */
  const handleContinue = async () => {
    if (submitting || !pending || currentIndex < 0) return;
    const item = items[currentIndex];
    if (!isFirstAttempt(session, item.id)) {
      setSelected(null);
      setPending(null);
      setSession((s) => applyChoiceResult(s, item.id, pending.correct));
      return;
    }
    setSubmitting(true);
    try {
      const rating = choiceRating(pending.correct, pending.responseTimeMs);
      await submitReview(item, rating, pending.answer, pending.responseTimeMs);
      await addStats({ cardsReviewed: 1 });
      setReviewed((r) => r + 1);
      setSelected(null);
      setPending(null);
      setSession((s) => applyChoiceResult(s, item.id, pending.correct));
    } catch (err) {
      // Nothing advanced: the pick stays on screen and Continue is live again.
      const copy = saveErrorCopy(err, 'this review');
      Alert.alert(copy.title, copy.message);
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

  // A failed load with nothing cached. Checked before the empty state so an
  // outage never reads as "All caught up!".
  if (error && items.length === 0) {
    return (
      <SafeAreaView className="flex-1 justify-center px-6" style={{ backgroundColor: c.bg }}>
        <Ui2InlineError copy={loadErrorCopy(error, 'your review')} onRetry={() => { loadQueue(); }} />
        <SlabButton label="Back to Learn" variant="ghost" arrow={false} onPress={() => goBack()} style={{ marginTop: spacing.md }} />
      </SafeAreaView>
    );
  }

  if (dealtIds.length === 0) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
        <Ui2EmptyState
          icon="checkmark-circle"
          title={mode === 'struggling' ? 'Nothing is fighting you' : 'All caught up!'}
          description={
            mode === 'struggling'
              ? 'No words are slipping right now. Keep reviewing and this list stays empty.'
              : 'No cards due for review. Keep learning to add more cards.'
          }
          actionLabel="Back to Learn"
          onAction={() => goBack()}
        />
      </SafeAreaView>
    );
  }

  const progress = session.total > 0 ? session.resolved / session.total : 0;

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
          {mode === 'struggling' ? 'Faced them down' : 'Review Complete!'}
        </Heading>
        <Body tone="secondary" style={{ marginBottom: spacing.xl }}>
          {mode === 'struggling'
            ? `You went back over ${reviewed} ${reviewed === 1 ? 'word that kept slipping' : 'words that kept slipping'}.`
            : `You reviewed ${reviewed} cards.`}
        </Body>
        <SlabButton label="Done" arrow={false} onPress={() => goBack()} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  // Both are guaranteed by the render-time reset above (the session only
  // holds ids that had a card when dealt); the guard is a belt for the
  // one-render window where a refresh swaps the queue under a live session.
  const item = currentIndex >= 0 ? items[currentIndex] : undefined;
  const card = item ? cards[item.cardId] : undefined;
  if (!item || !card) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <SlabButton label="Exit" variant="ghost" arrow={false} onPress={() => goBack()} style={{ paddingHorizontal: 16, paddingVertical: 8 }} />
          <Body size="sm" tone="secondary">
            {mode === 'struggling' ? 'Struggling words · ' : ''}{session.resolved} / {session.total}
          </Body>
        </View>
        <Ui2ProgressBar progress={progress} />
      </View>

      {/* Question. Scrolls rather than centres-and-clips: four option rows
          plus the example sentence and Continue do not fit a small phone at
          the larger Dynamic Type sizes. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 }}
      >
        {card ? (
          <ReviewChoiceCard
            key={`${item.id}-${session.attempts[item.id] ?? 0}`}
            card={card}
            options={options}
            selected={selected}
            onAnswer={handleAnswer}
            onContinue={handleContinue}
            busy={submitting}
            reask={!isFirstAttempt(session, item.id)}
          />
        ) : (
          <Body tone="secondary" style={{ textAlign: 'center' }}>Loading...</Body>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
