import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';
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
import { HeartsDisplay } from '../gamification/HeartsDisplay';
import { OutOfHeartsModal } from '../gamification/OutOfHeartsModal';
import { CorrectSparkle } from '../animations/CorrectSparkle';
import { WrongShake } from '../animations/WrongShake';
import { HeartBreak } from '../animations/HeartBreak';
import { CelebrationOverlay } from '../ui/CelebrationOverlay';
import { fetchDueReviewItemsWithCards, upsertReviewItem } from '../../lib/supabase-queries';
import { calculateNextReview } from '../../lib/srs';
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

interface LessonRunnerProps {
  exercises: Exercise[];
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
  nextRegenAt?: Date | null;
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
  nextRegenAt = null,
  onLoseHeart,
}: LessonRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<{ exerciseId: string; correct: boolean; answer: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [heartBreakTrigger, setHeartBreakTrigger] = useState(false);

  // SRS warm-up state. `warmupResolved` gates the lesson: true once the
  // warm-up either loaded (with items or zero) or the fetch timed out.
  const [warmupResolved, setWarmupResolved] = useState(false);
  const [warmupEntries, setWarmupEntries] = useState<Array<{ item: ReviewItem; card: Card }>>([]);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [warmupPhase, setWarmupPhase] = useState(false);
  const warmupFetchedRef = useRef(false);

  useEffect(() => {
    if (warmupFetchedRef.current) return;
    warmupFetchedRef.current = true;
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
  }, [userId]);

  const warmupExercise = warmupEntries[warmupIndex]
    ? warmupToExercise(warmupEntries[warmupIndex])
    : null;
  const currentExercise = warmupPhase ? warmupExercise : exercises[currentIndex];
  const progress = warmupPhase
    ? warmupEntries.length > 0
      ? (warmupIndex + 1) / warmupEntries.length
      : 0
    : exercises.length > 0
      ? (currentIndex + 1) / exercises.length
      : 0;

  const handleAnswer = useCallback(
    (correct: boolean, answer: string) => {
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
          upsertReviewItem({
            id: entry.item.id,
            userId: entry.item.userId,
            cardId: entry.item.cardId,
            ...next,
            lastReviewedAt: new Date().toISOString(),
          }).catch((err) => console.warn('[warmup] upsertReviewItem failed:', err));
        }
        return;
      }
      if (!currentExercise) return;
      setAnswers((prev) => [...prev, { exerciseId: currentExercise.id, correct, answer }]);
      setShowResult(true);
      setLastAnswerCorrect(correct);

      if (!correct && !isUnlimitedHearts) {
        onLoseHeart?.();
        setHeartBreakTrigger(true);
        setTimeout(() => setHeartBreakTrigger(false), 1200);

        // Check if out of hearts after losing one
        if (hearts <= 1) {
          setTimeout(() => setShowOutOfHearts(true), 800);
        }
      }
    },
    [currentExercise, isUnlimitedHearts, hearts, onLoseHeart, warmupPhase, warmupEntries, warmupIndex]
  );

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

      setCompleted(true);
      onComplete(result);
    }
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
          subtitle={`+${xpEarned} XP · ${correctCount}/${exercises.length} correct`}
          ctaLabel="Continue"
          onDismiss={onExit}
        />
      </View>
    );
  }

  const ExerciseWrapper = lastAnswerCorrect === true ? CorrectSparkle : lastAnswerCorrect === false ? WrongShake : View;
  const wrapperProps = lastAnswerCorrect !== null ? { trigger: showResult } : {};

  return (
    <View className="flex-1 bg-dark">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Button label="Exit" variant="danger" onPress={onExit} style={{ paddingHorizontal: 16, paddingVertical: 8 }} />
          <HeartsDisplay hearts={hearts} maxHearts={maxHearts} isUnlimited={isUnlimitedHearts} />
          <Text className="text-text-secondary text-sm">
            {warmupPhase
              ? `Warm-up ${warmupIndex + 1} / ${warmupEntries.length}`
              : `${currentIndex + 1} / ${exercises.length}`}
          </Text>
        </View>
        {warmupPhase && (
          <View className="mb-2">
            <Text className="text-xs font-semibold text-primary uppercase tracking-wider">
              Quick Review
            </Text>
            <Text className="text-xs text-text-secondary mt-0.5">
              A few items due for practice before we start.
            </Text>
          </View>
        )}
        <ProgressBar progress={progress} />
      </View>

      {/* Heart Break Animation */}
      <HeartBreak trigger={heartBreakTrigger} />

      {/* Exercise */}
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <ExerciseWrapper {...wrapperProps}>
          {currentExercise && renderExercise(
            currentExercise,
            handleAnswer,
            showResult,
            userId,
            targetLanguage,
            cefrLevel,
            handleNext,
          )}
        </ExerciseWrapper>
      </ScrollView>

      {/* Out of Hearts Modal */}
      <OutOfHeartsModal
        visible={showOutOfHearts}
        nextRegenAt={nextRegenAt}
        onDismiss={() => {
          setShowOutOfHearts(false);
          onExit();
        }}
      />
    </View>
  );
}

function renderExercise(
  exercise: Exercise,
  onAnswer: (correct: boolean, answer: string) => void,
  showResult: boolean,
  userId: string,
  targetLanguage: LanguageCode,
  cefrLevel: string | undefined,
  onContinue: () => void,
) {
  // Shared props threaded into every exercise so the inner FeedbackCard
  // can: (1) look up grammar rules, (2) log to correction_log, (3) fire
  // onContinue to advance the lesson without the old global Next button.
  const shared = { userId, language: targetLanguage, cefrLevel, onContinue };

  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoice exercise={exercise} onAnswer={onAnswer} showResult={showResult} {...shared} />;
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
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
          onContinue={onContinue}
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
          userId={userId}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
          onContinue={onContinue}
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
