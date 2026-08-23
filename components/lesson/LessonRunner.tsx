import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../ui/Button';
import { ExerciseChrome } from './ExerciseChrome';
import { MultipleChoice } from './MultipleChoice';
import { TranslationExercise } from './TranslationExercise';
import { FillBlankExercise } from './FillBlankExercise';
import { ListeningExercise } from './ListeningExercise';
import { SpeakingExercise } from './SpeakingExercise';
import { ClozeExercise } from './ClozeExercise';
import { SentenceConstructionExercise } from './SentenceConstructionExercise';
import { ErrorCorrectionExercise } from './ErrorCorrectionExercise';
import { DictationExercise } from './DictationExercise';
import { CollocationMatch } from './CollocationMatch';
import { WordFormExercise } from './WordFormExercise';
import { SentenceTransformExercise } from './SentenceTransformExercise';
import { MiniDialogueExercise } from './MiniDialogueExercise';
import { useAdultMode } from '../../hooks/useAdultMode';
import { CorrectSparkle } from '../animations/CorrectSparkle';
import { WrongShake } from '../animations/WrongShake';
import { HeartBreak } from '../animations/HeartBreak';
import { CelebrationOverlay } from '../ui/CelebrationOverlay';
import {
  fetchDueReviewItemsWithCards,
  fetchReviewItemsByCardIds,
  upsertReviewItem,
  tryConsumeNewCardSlot,
} from '../../lib/supabase-queries';
import { calculateNextReview, createNewReviewItem } from '../../lib/srs';
import { enqueue, isNetworkError } from '../../lib/offline-queue';
import {
  saveLessonSession,
  loadLessonSession,
  clearLessonSession,
} from '../../lib/lesson-session-storage';
import type { Exercise, LanguageCode, ReviewItem, Card } from '../../types';

// ─── SRS Warm-Up (research.md §5.1 & §13.1) ──────────────────────────────
// Retrieval practice ~50% higher long-term retention than re-study. Starting
// every lesson with 3-5 due SRS items primes the learner and closes the gap
// where review activity and lesson activity were separate surfaces.
const WARMUP_MAX_ITEMS = 5;
const WARMUP_FETCH_TIMEOUT_MS = 1500;

function warmupToExercise(entry: { item: ReviewItem; card: Card }): Exercise {
  const { card } = entry;
  return {
    id: `warmup-${entry.item.id}`,
    lessonId: 'warmup',
    type: 'translate_to_target',
    orderIndex: 0,
    prompt: card.nativeText,
    promptAudioUrl: null,
    correctAnswer: card.targetText,
    acceptedAnswers: [card.targetText],
    options: null,
    hintText: card.exampleSentence ?? null,
    cardId: card.id,
    skillType: card.skillType,
    subskill: card.subskill,
    targetWord: card.targetText,
    explanation: card.exampleSentenceTranslation ?? undefined,
  };
}

/**
 * Feed a main-lesson exercise result into spaced repetition
 * (.claude/rules/learning.md — "Failed items get added to the review queue
 * immediately"). Uses the same rating convention as the warm-up
 * (4 = pass, 2 = fail) so SM-2 state stays coherent across both paths.
 *
 * `existingItems` is the prefetched map of the user's review items for this
 * lesson's cards (see the prefetch effect). Cards with prior history grade
 * from their REAL accumulated SM-2 state (interval/ease factor continue),
 * and are not new — so they skip the daily new-card cap and its counter.
 * If the prefetch failed (`null`) or the card has no row, we fall back to a
 * fresh SM-2 baseline via upsertReviewItem's (user_id, card_id) conflict
 * target — exact for first-seen cards, the common case inside a lesson.
 * Each upsert result is written back into the map so repeat exercises on
 * the same card within one session chain state instead of re-baselining.
 *
 * The daily new-card cap is enforced with tryConsumeNewCardSlot — one
 * atomic check-and-consume RPC (silent skip when the cap is hit), same as
 * saveCorrectionAsCard / addCardFromAnnotation. `introducedThisSession`
 * de-dupes cap accounting when the same card backs multiple exercises or
 * an exercise is retried.
 */
async function recordLessonSrsResult(
  userId: string,
  cardId: string,
  correct: boolean,
  introducedThisSession: Set<string>,
  existingItems: Map<string, ReviewItem> | null,
): Promise<void> {
  const rating = correct ? 4 : 2;

  const existing = existingItems?.get(cardId);
  if (existing) {
    // Known card: continue accumulated SM-2 state. Not new, so no cap
    // slot is consumed.
    const next = calculateNextReview(existing, rating);
    const payload = {
      id: existing.id,
      userId,
      cardId,
      ...next,
      lastReviewedAt: new Date().toISOString(),
    };
    try {
      const saved = await upsertReviewItem(payload);
      existingItems?.set(cardId, saved);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Network blip: queue the exact failed payload for replay on
      // reconnect, and chain in-session state from the locally computed
      // result so repeat exercises on this card keep advancing SM-2.
      console.warn('[lesson-srs] offline; queueing review upsert for card', cardId);
      await enqueue(userId, { type: 'review-upsert', payload });
      existingItems?.set(cardId, payload);
    }
    return;
  }

  if (!introducedThisSession.has(cardId)) {
    let slotConsumed: boolean;
    try {
      slotConsumed = await tryConsumeNewCardSlot();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Offline: the atomic cap RPC can't run, so a brand-new card can't be
      // introduced safely. Skip SRS for it — the card is introduced the
      // next time it's answered online.
      console.warn('[lesson-srs] offline; skipping new-card SRS for card', cardId);
      return;
    }
    if (!slotConsumed) {
      console.warn('[lesson-srs] daily new-card cap reached; skipping card', cardId);
      return;
    }
    // Mark before the upsert: the slot is already consumed, so a retry of
    // the same card must not consume a second one.
    introducedThisSession.add(cardId);
  }
  const next = calculateNextReview({ id: '', ...createNewReviewItem(userId, cardId) }, rating);
  const payload = {
    userId,
    cardId,
    ...next,
    lastReviewedAt: new Date().toISOString(),
  };
  try {
    const saved = await upsertReviewItem(payload);
    existingItems?.set(cardId, saved);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // The cap slot was already consumed (this session), so the upsert must
    // not be lost: queue it for replay. The map is deliberately NOT updated
    // here — the payload has no row id yet, and a repeat exercise simply
    // re-baselines and enqueues again (FIFO replay: last write wins).
    console.warn('[lesson-srs] offline; queueing review upsert for card', cardId);
    await enqueue(userId, { type: 'review-upsert', payload });
  }
}

interface LessonRunnerProps {
  exercises: Exercise[];
  /**
   * Stable lesson id used to persist/resume mid-lesson progress. Omit it
   * (e.g. review drills) to disable session persistence entirely.
   */
  lessonId?: string;
  lessonTitle: string;
  xpReward: number;
  userId: string;
  targetLanguage: LanguageCode;
  /** CEFR level for grammar-rule lookups in per-exercise FeedbackCard. */
  cefrLevel?: string;
  onComplete: (results: LessonResult) => void;
  onExit: () => void;
  // Hearts integration
  hearts?: number;
  maxHearts?: number;
  isUnlimitedHearts?: boolean;
  onLoseHeart?: () => void;
}

export interface LessonResult {
  totalExercises: number;
  correctCount: number;
  accuracy: number;
  xpEarned: number;
  answers: { exerciseId: string; correct: boolean; answer: string }[];
}

export function LessonRunner({
  exercises,
  lessonId,
  lessonTitle,
  xpReward,
  userId,
  targetLanguage,
  cefrLevel,
  onComplete,
  onExit,
  hearts = 5,
  maxHearts = 5,
  isUnlimitedHearts = false,
  onLoseHeart,
}: LessonRunnerProps) {
  const { showHearts, showXpCelebration } = useAdultMode();
  const [currentIndex, setCurrentIndex] = useState(0);
  // `showResult` survives only as the sparkle/shake trigger. Whether an
  // exercise has been answered is derived from `picks` — a single boolean
  // could not say "this one, the one you just walked back to, is answered".
  const [showResult, setShowResult] = useState(false);
  // Keyed by exercise id, so warm-up ids (`warmup-…`) and lesson ids never
  // collide. This is what makes Previous restore a pick, its option colours
  // and its note.
  const [picks, setPicks] = useState<Record<string, string>>({});
  // Correctness per exercise id. Warm-up answers deliberately stay out of
  // `answers` (they must not move lesson accuracy or XP), so the footer's
  // kicker reads from here instead and works in both phases.
  const [outcomes, setOutcomes] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<{ exerciseId: string; correct: boolean; answer: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [heartBreakTrigger, setHeartBreakTrigger] = useState(false);

  // SRS warm-up state. `warmupResolved` gates the lesson: true once the
  // warm-up either loaded (with items or zero) or the fetch timed out.
  const [warmupResolved, setWarmupResolved] = useState(false);
  const [warmupEntries, setWarmupEntries] = useState<Array<{ item: ReviewItem; card: Card }>>([]);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [warmupPhase, setWarmupPhase] = useState(false);
  const warmupFetchedRef = useRef(false);

  // ── Session resume ────────────────────────────────────────────────────
  // Mid-lesson progress is persisted to AsyncStorage after every answer so
  // backgrounding/kill/crash doesn't restart the lesson. The snapshot is
  // loaded before the warm-up fetch so a resumed session skips silently to
  // the saved exercise (a resumed lesson already had its warm-up).
  const sessionStartedAtRef = useRef(Date.now());
  const resumedRef = useRef(false);
  const restoreAttemptedRef = useRef(false);
  const [restoreChecked, setRestoreChecked] = useState(false);
  // Cards already introduced to SRS this session (cap accounting de-dupe).
  const srsIntroducedRef = useRef<Set<string>>(new Set());
  // Prefetched review items for this lesson's cards, keyed by cardId, so
  // grading continues real SM-2 state instead of re-baselining cards the
  // user has history with. `null` = prefetch pending/failed → fresh-baseline
  // fallback in recordLessonSrsResult (never blocks the lesson).
  const existingReviewItemsRef = useRef<Map<string, ReviewItem> | null>(null);
  const srsPrefetchStartedRef = useRef(false);

  useEffect(() => {
    if (srsPrefetchStartedRef.current || !userId) return;
    srsPrefetchStartedRef.current = true;
    const cardIds = [
      ...new Set(exercises.map((e) => e.cardId).filter((id): id is string => !!id)),
    ];
    if (cardIds.length === 0) {
      existingReviewItemsRef.current = new Map();
      return;
    }
    fetchReviewItemsByCardIds(userId, cardIds)
      .then((items) => {
        existingReviewItemsRef.current = new Map(items.map((it) => [it.cardId, it]));
      })
      .catch((err) => {
        console.warn(
          '[lesson-srs] prefetch of existing review items failed; grading from fresh SM-2 baseline:',
          err,
        );
      });
  }, [userId, exercises]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    if (!lessonId || !userId) {
      setRestoreChecked(true);
      return;
    }
    loadLessonSession(userId, lessonId)
      .then((snapshot) => {
        if (snapshot && snapshot.answers.length > 0 && exercises.length > 0) {
          resumedRef.current = true;
          sessionStartedAtRef.current = snapshot.startedAt;
          setCurrentIndex(Math.min(snapshot.exerciseIndex, exercises.length - 1));
          setAnswers(snapshot.answers);
          setPicks(snapshot.picks ?? {});
          setOutcomes(
            Object.fromEntries(snapshot.answers.map((a) => [a.exerciseId, a.correct])),
          );
        }
      })
      .catch((err) => console.warn('[lesson-session] restore failed:', err))
      .finally(() => setRestoreChecked(true));
  }, [userId, lessonId, exercises]);

  useEffect(() => {
    if (!restoreChecked || warmupFetchedRef.current) return;
    warmupFetchedRef.current = true;
    if (resumedRef.current) {
      // Resumed mid-lesson: skip the warm-up and drop into the saved spot.
      setWarmupResolved(true);
      return;
    }
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      setWarmupResolved(true);
    }, WARMUP_FETCH_TIMEOUT_MS);
    fetchDueReviewItemsWithCards(userId, WARMUP_MAX_ITEMS)
      .then((entries) => {
        if (timedOut) return;
        clearTimeout(timeout);
        if (entries.length > 0) {
          setWarmupEntries(entries);
          setWarmupPhase(true);
        }
        setWarmupResolved(true);
      })
      .catch(() => {
        clearTimeout(timeout);
        setWarmupResolved(true);
      });
    return () => clearTimeout(timeout);
  }, [userId, restoreChecked]);

  const warmupExercise = warmupEntries[warmupIndex]
    ? warmupToExercise(warmupEntries[warmupIndex])
    : null;
  const currentExercise = warmupPhase ? warmupExercise : exercises[currentIndex];

  // Per-exercise answered state. `showResult` used to stand in for this, but a
  // single boolean cannot describe an exercise you have walked back onto.
  const currentPick = currentExercise ? picks[currentExercise.id] ?? null : null;
  const currentCorrect = currentExercise ? outcomes[currentExercise.id] ?? null : null;
  const isAnswered = currentPick !== null;

  const handleAnswer = useCallback(
    (correct: boolean, answer: string) => {
      // Recorded for both phases before the warm-up branch returns: the
      // footer's note row and the Next button read from these, and the
      // warm-up needs them just as much as the lesson does.
      if (currentExercise) {
        const id = currentExercise.id;
        setPicks((prev) => ({ ...prev, [id]: answer }));
        setOutcomes((prev) => ({ ...prev, [id]: correct }));
      }
      if (warmupPhase) {
        // Warm-up answers feed the SRS machinery but do not affect the
        // lesson accuracy/XP aggregates. Intentionally do not lose hearts
        // on warm-up misses (different pedagogy).
        setShowResult(true);
        setLastAnswerCorrect(correct);
        const entry = warmupEntries[warmupIndex];
        if (entry) {
          const rating = correct ? 4 : 2;
          const next = calculateNextReview(entry.item, rating);
          const payload = {
            id: entry.item.id,
            userId: entry.item.userId,
            cardId: entry.item.cardId,
            ...next,
            lastReviewedAt: new Date().toISOString(),
          };
          upsertReviewItem(payload)
            .then((saved) => {
              // Keep the prefetched map current: if this card also backs a
              // main-lesson exercise, its SRS result must chain from the
              // warm-up's advancement, not the stale pre-warm-up state.
              existingReviewItemsRef.current?.set(entry.item.cardId, saved);
            })
            .catch((err) => {
              console.warn('[warmup] upsertReviewItem failed:', err);
              if (isNetworkError(err)) {
                // Network blip: queue the exact failed payload for replay on
                // reconnect, and chain in-session state from the locally
                // computed result (same role as `saved` above).
                enqueue(userId, { type: 'review-upsert', payload }).catch((queueErr) =>
                  console.warn('[warmup] offline enqueue failed:', queueErr),
                );
                existingReviewItemsRef.current?.set(entry.item.cardId, payload);
              }
            });
        }
        return;
      }
      if (!currentExercise) return;
      // De-dupe by exerciseId: a "Try again" retry re-invokes this handler for
      // the same exercise, so replace any prior entry instead of appending —
      // otherwise answers.length exceeds exercises.length and accuracy/XP inflate.
      const nextAnswers = [
        ...answers.filter((a) => a.exerciseId !== currentExercise.id),
        { exerciseId: currentExercise.id, correct, answer },
      ];
      setAnswers(nextAnswers);
      setShowResult(true);
      setLastAnswerCorrect(correct);

      // Persist a resume snapshot after every answer so an interrupted
      // lesson picks up where it left off. Fire-and-forget — never blocks
      // the grading UI.
      if (lessonId && userId) {
        saveLessonSession(userId, lessonId, {
          exerciseIndex: currentIndex + 1,
          answers: nextAnswers,
          // Without the picks a resumed lesson would render its answered
          // exercises blank, with Next disabled on work already done.
          picks: { ...picks, [currentExercise.id]: answer },
          startedAt: sessionStartedAtRef.current,
        }).catch((err) => console.warn('[lesson-session] save failed:', err));
      }

      // Feed the result into SRS — same fire-and-forget pattern as the
      // warm-up above. Exercises without a linked card (e.g. AI free
      // production) are skipped.
      if (currentExercise.cardId) {
        recordLessonSrsResult(
          userId,
          currentExercise.cardId,
          correct,
          srsIntroducedRef.current,
          existingReviewItemsRef.current,
        ).catch((err) => console.warn('[lesson-srs] SRS update failed:', err));
      }

      if (!correct && !isUnlimitedHearts) {
        onLoseHeart?.();
        setHeartBreakTrigger(true);
        setTimeout(() => setHeartBreakTrigger(false), 1200);
        // Reaching zero no longer ends the lesson — see hooks/useHearts.ts for
        // why. The counter keeps reading 0 until it regenerates, which is the
        // feedback; the interruption was the part that cost retention.
      }
    },
    [currentExercise, isUnlimitedHearts, onLoseHeart, warmupPhase, warmupEntries, warmupIndex, answers, picks, currentIndex, lessonId, userId]
  );

  /**
   * Step back one exercise. Deliberately does NOT clear the answered state —
   * that now lives in `picks`/`outcomes`, keyed by exercise id, so the earlier
   * question comes back with its pick, its option colours and its note. Only
   * the animation trigger resets, so walking backwards does not replay a
   * sparkle or a shake.
   */
  const handlePrev = () => {
    setShowResult(false);
    setLastAnswerCorrect(null);
    if (warmupPhase) {
      if (warmupIndex > 0) setWarmupIndex((i) => i - 1);
      return;
    }
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (warmupPhase) {
      if (warmupIndex < warmupEntries.length - 1) {
        setWarmupIndex((i) => i + 1);
        setShowResult(false);
        setLastAnswerCorrect(null);
      } else {
        // Warm-up done — transition into the main lesson.
        setWarmupPhase(false);
        setShowResult(false);
        setLastAnswerCorrect(null);
      }
      return;
    }
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowResult(false);
      setLastAnswerCorrect(null);
    } else {
      // Lesson complete
      const allAnswers = [...answers];
      const correctCount = allAnswers.filter((a) => a.correct).length;
      const accuracy = exercises.length > 0 ? correctCount / exercises.length : 0;
      const xpEarned = Math.round(xpReward * accuracy);

      // Perfect run gets a Heavy "thump" that lands just before the overlay's
      // Success haptic on mount — creates a signature double-thump only when
      // every exercise was correct. Imperfect runs rely on the overlay's own
      // Success haptic (no double-fire).
      if (Platform.OS !== 'web' && correctCount === exercises.length) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }

      const result: LessonResult = {
        totalExercises: exercises.length,
        correctCount,
        accuracy,
        xpEarned,
        answers: allAnswers,
      };

      // Lesson finished — the resume snapshot is no longer needed.
      if (lessonId && userId) {
        clearLessonSession(userId, lessonId).catch((err) =>
          console.warn('[lesson-session] clear failed:', err),
        );
      }

      setCompleted(true);
      onComplete(result);
    }
  };

  // Explicit quit discards the resume snapshot; forced exits (e.g. out of
  // hearts) keep it so the learner can resume once hearts regenerate.
  const handleQuit = () => {
    if (lessonId && userId) {
      clearLessonSession(userId, lessonId).catch((err) =>
        console.warn('[lesson-session] clear failed:', err),
      );
    }
    onExit();
  };

  if (!warmupResolved) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-text-secondary text-base">Preparing your lesson…</Text>
      </View>
    );
  }

  if (exercises.length === 0 && !warmupPhase) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-text-secondary text-lg text-center mb-4">
          No exercises available for this lesson.
        </Text>
        <Button label="Go Back" onPress={onExit} variant="secondary" />
      </View>
    );
  }

  if (completed) {
    const correctCount = answers.filter((a) => a.correct).length;
    const accuracy = exercises.length > 0 ? correctCount / exercises.length : 0;
    const xpEarned = Math.round(xpReward * accuracy);
    const perfect = correctCount === exercises.length && exercises.length > 0;
    const strong = accuracy >= 0.8;
    const title = perfect ? 'Flawless!' : strong ? 'Nailed it!' : 'Lesson complete';
    const mood = strong ? 'lessonComplete' : 'correct';

    return (
      <View style={{ flex: 1 }}>
        <CelebrationOverlay
          visible
          mood={mood}
          title={title}
          subtitle={
            showXpCelebration
              ? `+${xpEarned} XP · ${correctCount}/${exercises.length} correct`
              : `${correctCount}/${exercises.length} correct`
          }
          ctaLabel="Continue"
          onDismiss={onExit}
        />
      </View>
    );
  }

  return (
    <>
      <ExerciseChrome
        lessonTitle={warmupPhase ? 'Quick review' : lessonTitle}
        currentIndex={warmupPhase ? warmupIndex : currentIndex}
        total={warmupPhase ? warmupEntries.length : exercises.length}
        completedCount={warmupPhase ? warmupIndex : answers.length}
        counterLabel={
          warmupPhase
            ? `QUICK REVIEW ${warmupIndex + 1} / ${warmupEntries.length}`
            : `QUESTION ${String(currentIndex + 1).padStart(2, '0')}`
        }
        hearts={hearts}
        maxHearts={maxHearts}
        isUnlimitedHearts={isUnlimitedHearts}
        showHearts={showHearts}
        note={currentExercise?.explanation ?? null}
        answeredCorrect={currentCorrect}
        correctAnswer={currentExercise?.correctAnswer ?? ''}
        canPrev={warmupPhase ? warmupIndex > 0 : currentIndex > 0}
        canNext={isAnswered}
        isLast={!warmupPhase && currentIndex === exercises.length - 1}
        onExit={handleQuit}
        onPrev={handlePrev}
        onNext={handleNext}
      >
        {/* Both animation wrappers stay mounted and are driven by `trigger`.
            Swapping the wrapper's component type per answer — what this used
            to do — changed the element type at this position, so React tore
            down and rebuilt the exercise underneath it. Typed exercises keep
            their input and grade in local state and lost both the instant
            they were graded. The key remounts the subtree when the exercise
            genuinely changes, and only then. */}
        <CorrectSparkle trigger={showResult && lastAnswerCorrect === true}>
          <WrongShake trigger={showResult && lastAnswerCorrect === false}>
            <View key={currentExercise?.id}>
              {currentExercise &&
                renderExercise(
                  currentExercise,
                  handleAnswer,
                  isAnswered,
                  currentPick,
                  userId,
                  targetLanguage,
                  cefrLevel,
                )}
            </View>
          </WrongShake>
        </CorrectSparkle>
      </ExerciseChrome>

      {/* Heart Break Animation — overlays the chrome rather than sitting in it */}
      <HeartBreak trigger={heartBreakTrigger} />
    </>
  );
}

function renderExercise(
  exercise: Exercise,
  onAnswer: (correct: boolean, answer: string) => void,
  showResult: boolean,
  selected: string | null,
  userId: string,
  targetLanguage: LanguageCode,
  cefrLevel: string | undefined,
) {
  // Shared props threaded into every exercise so the inner FeedbackCard can
  // look up grammar rules and log to correction_log. `onContinue` is gone:
  // ExerciseChrome's footer owns forward navigation now, and a Continue
  // button inside the card would be a second, competing way to advance.
  //
  // `selected` is the recorded answer for THIS exercise. Every type seeds its
  // own input state from it, so walking back with Previous returns the
  // learner to the answer they gave rather than a blank, locked input sitting
  // under a note that says they got it right.
  const shared = { userId, language: targetLanguage, cefrLevel, selected };

  switch (exercise.type) {
    case 'multiple_choice':
      return (
        <MultipleChoice
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          {...shared}
        />
      );
    case 'translate_to_target':
    case 'translate_to_native':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'fill_blank':
      return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'listening_choice':
    case 'listening_type':
      return <ListeningExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'speaking':
      return (
        <SpeakingExercise
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          selected={selected}
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
        />
      );
    case 'free_production':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'cloze_deletion':
      return <ClozeExercise exercise={exercise} onAnswer={onAnswer} {...shared} />;
    case 'sentence_construction':
      return <SentenceConstructionExercise exercise={exercise} onAnswer={onAnswer} {...shared} />;
    case 'error_correction':
      return <ErrorCorrectionExercise exercise={exercise} onAnswer={onAnswer} {...shared} />;
    case 'dictation':
      return (
        <DictationExercise
          exercise={exercise}
          onAnswer={onAnswer}
          selected={selected}
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
        />
      );
    case 'collocation_match':
      return <CollocationMatch exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'word_form':
      return <WordFormExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'sentence_transformation':
      return <SentenceTransformExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    case 'mini_dialogue':
      return <MiniDialogueExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
    default:
      return (
        <View className="p-6">
          <Text className="text-text-secondary text-center">
            Unknown exercise type: {exercise.type}
          </Text>
        </View>
      );
  }
}
