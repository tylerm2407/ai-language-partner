import { useState, useCallback } from 'react';
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
import { HeartsDisplay } from '../gamification/HeartsDisplay';
import { OutOfHeartsModal } from '../gamification/OutOfHeartsModal';
import { CorrectSparkle } from '../animations/CorrectSparkle';
import { WrongShake } from '../animations/WrongShake';
import { HeartBreak } from '../animations/HeartBreak';
import { XpCounterTick } from '../animations/XpCounterTick';
import type { Exercise, LanguageCode } from '../../types';

interface LessonRunnerProps {
  exercises: Exercise[];
  lessonTitle: string;
  xpReward: number;
  userId: string;
  targetLanguage: LanguageCode;
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

  const currentExercise = exercises[currentIndex];
  const progress = exercises.length > 0 ? (currentIndex + 1) / exercises.length : 0;

  const handleAnswer = useCallback(
    (correct: boolean, answer: string) => {
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
    [currentExercise, isUnlimitedHearts, hearts, onLoseHeart]
  );

  const handleNext = () => {
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

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  if (exercises.length === 0) {
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
    const accuracy = Math.round((correctCount / exercises.length) * 100);
    const xpEarned = Math.round(xpReward * (correctCount / exercises.length));

    const scoreColor = accuracy >= 80 ? 'bg-success-bg' : accuracy >= 60 ? 'bg-warning-bg' : 'bg-error-bg';
    const scoreTextColor = accuracy >= 80 ? 'text-success' : accuracy >= 60 ? 'text-warning' : 'text-error';

    return (
      <ScrollView className="flex-1 bg-dark" contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <Text
          className="text-text-primary text-[28px] font-bold mb-2"
          accessibilityRole="header"
        >
          Lesson Complete!
        </Text>
        <Text className="text-text-secondary text-base mb-8">{lessonTitle}</Text>

        <View className={`w-[100px] h-[100px] rounded-full items-center justify-center mb-6 ${scoreColor}`}>
          <Text className={`text-[32px] font-bold ${scoreTextColor}`}>{accuracy}%</Text>
        </View>

        <XpCounterTick targetXp={xpEarned} trigger={true} style={{ marginBottom: 16 }} />

        <View className="flex-row justify-around w-full mb-8">
          <View className="items-center">
            <Text className="text-text-primary text-2xl font-bold">{correctCount}/{exercises.length}</Text>
            <Text className="text-text-secondary text-sm">Correct</Text>
          </View>
          <View className="items-center">
            <Text className="text-primary text-2xl font-bold">+{xpEarned}</Text>
            <Text className="text-text-secondary text-sm">XP Earned</Text>
          </View>
        </View>

        <Button label="Continue" onPress={onExit} />
      </ScrollView>
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
            {currentIndex + 1} / {exercises.length}
          </Text>
        </View>
        <ProgressBar progress={progress} />
      </View>

      {/* Heart Break Animation */}
      <HeartBreak trigger={heartBreakTrigger} />

      {/* Exercise */}
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <ExerciseWrapper {...wrapperProps}>
          {renderExercise(currentExercise, handleAnswer, showResult, userId, targetLanguage)}
        </ExerciseWrapper>

        {showResult && (
          <View className="mt-6">
            <Button
              label={currentIndex < exercises.length - 1 ? 'Next' : 'Finish'}
              onPress={handleNext}
            />
          </View>
        )}
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
  targetLanguage: LanguageCode
) {
  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoice exercise={exercise} onAnswer={onAnswer} showResult={showResult} />;
    case 'translate_to_target':
    case 'translate_to_native':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} />;
    case 'fill_blank':
      return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} />;
    case 'listening_choice':
    case 'listening_type':
      return <ListeningExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} />;
    case 'speaking':
      return (
        <SpeakingExercise
          exercise={exercise}
          onAnswer={onAnswer}
          showResult={showResult}
          userId={userId}
          targetLanguage={targetLanguage}
        />
      );
    case 'free_production':
      return <TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={showResult} />;
    case 'cloze_deletion':
      return <ClozeExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'sentence_construction':
      return <SentenceConstructionExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'error_correction':
      return <ErrorCorrectionExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'dictation':
      return <DictationExercise exercise={exercise} onAnswer={onAnswer} />;
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
