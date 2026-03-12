import { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ProgressBar } from '../ui/ProgressBar';
import { MultipleChoice } from './MultipleChoice';
import { ListeningExercise } from './ListeningExercise';
import { TranslationExercise } from './TranslationExercise';
import { FillBlankExercise } from './FillBlankExercise';
import { SpeakingExercise } from './SpeakingExercise';
import { gradeToRating, gradeAnswer } from '../../lib/grading';
import type { Lesson, Exercise, LanguageCode, ReviewRating } from '../../types';

interface LessonRunnerProps {
  lesson: Lesson;
  targetLanguage: LanguageCode;
  onComplete: (results: LessonResult) => void;
  onExit: () => void;
}

export interface LessonResult {
  lessonId: string;
  totalExercises: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  xpEarned: number;
  timeSpentMs: number;
  exerciseResults: ExerciseResult[];
}

interface ExerciseResult {
  exerciseId: string;
  cardId: string | null;
  userAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
  rating: ReviewRating;
}

export function LessonRunner({ lesson, targetLanguage, onComplete, onExit }: LessonRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [phase, setPhase] = useState<'exercise' | 'summary'>('exercise');
  const exerciseStartRef = useRef(Date.now());
  const lessonStartRef = useRef(Date.now());

  const exercises = lesson.exercises;
  const progress = exercises.length > 0 ? currentIndex / exercises.length : 0;
  const currentExercise = exercises[currentIndex] ?? null;

  const handleAnswer = useCallback(
    (answer: string, isCorrect: boolean) => {
      if (!currentExercise) return;

      const responseTimeMs = Date.now() - exerciseStartRef.current;
      const grade = gradeAnswer(answer, currentExercise.correctAnswer, currentExercise.acceptedAnswers);
      const rating = gradeToRating(grade, responseTimeMs);

      const result: ExerciseResult = {
        exerciseId: currentExercise.id,
        cardId: currentExercise.cardId,
        userAnswer: answer,
        isCorrect,
        responseTimeMs,
        rating,
      };

      setResults((prev) => [...prev, result]);

      // Move to next exercise or summary
      if (currentIndex + 1 < exercises.length) {
        setCurrentIndex((prev) => prev + 1);
        exerciseStartRef.current = Date.now();
      } else {
        setPhase('summary');
      }
    },
    [currentExercise, currentIndex, exercises.length]
  );

  const handleComplete = useCallback(() => {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = results.length > 0 ? correctCount / results.length : 0;

    const lessonResult: LessonResult = {
      lessonId: lesson.id,
      totalExercises: exercises.length,
      correctCount,
      incorrectCount: results.length - correctCount,
      accuracy,
      xpEarned: lesson.xpReward + correctCount * 5,
      timeSpentMs: Date.now() - lessonStartRef.current,
      exerciseResults: results,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(lessonResult);
  }, [results, lesson, exercises.length, onComplete]);

  // ─── Summary Phase ──────────────────────────────────────────

  if (phase === 'summary') {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
    const xpEarned = lesson.xpReward + correctCount * 5;
    const timeSpent = Math.round((Date.now() - lessonStartRef.current) / 1000);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text
            style={{ fontSize: 32, fontWeight: '700', marginBottom: 8 }}
            accessibilityRole="header"
          >
            Lesson Complete!
          </Text>
          <Text style={{ fontSize: 18, color: '#666', marginBottom: 32 }}>
            {lesson.title}
          </Text>

          {/* Stats */}
          <View
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              marginBottom: 32,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#6366F1' }}>
                  {accuracy}%
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>Accuracy</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#22C55E' }}>
                  +{xpEarned}
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>XP Earned</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '700' }}>
                  {timeSpent}s
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>Time</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <Text style={{ fontSize: 15, color: '#22C55E', fontWeight: '600' }}>
                {correctCount} correct
              </Text>
              <Text style={{ fontSize: 15, color: '#EF4444', fontWeight: '600' }}>
                {results.length - correctCount} incorrect
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleComplete}
            style={{
              backgroundColor: '#6366F1',
              paddingHorizontal: 48,
              paddingVertical: 16,
              borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Exercise Phase ─────────────────────────────────────────

  if (!currentExercise) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#999' }}>No exercises in this lesson.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header with progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable
            onPress={onExit}
            style={{ padding: 8, marginRight: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Exit lesson"
          >
            <Text style={{ fontSize: 24, color: '#666' }}>x</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 14, color: '#666' }}>
            {currentIndex + 1}/{exercises.length}
          </Text>
        </View>
      </View>

      {/* Exercise content */}
      <ScrollView
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {renderExercise(currentExercise, targetLanguage, handleAnswer)}
      </ScrollView>
    </SafeAreaView>
  );
}

function renderExercise(
  exercise: Exercise,
  targetLanguage: LanguageCode,
  onAnswer: (answer: string, isCorrect: boolean) => void
) {
  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoice exercise={exercise} onAnswer={onAnswer} />;
    case 'listening_choice':
      return <ListeningExercise exercise={exercise} mode="choice" onAnswer={onAnswer} />;
    case 'listening_type':
      return <ListeningExercise exercise={exercise} mode="type" onAnswer={onAnswer} />;
    case 'translate_to_target':
      return <TranslationExercise exercise={exercise} direction="to_target" onAnswer={onAnswer} />;
    case 'translate_to_native':
      return <TranslationExercise exercise={exercise} direction="to_native" onAnswer={onAnswer} />;
    case 'fill_blank':
      return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'speaking':
      return <SpeakingExercise exercise={exercise} targetLanguage={targetLanguage} onAnswer={onAnswer} />;
    case 'free_production':
      // Free production uses a simplified translation UI for now
      return <TranslationExercise exercise={exercise} direction="to_target" onAnswer={onAnswer} />;
    default:
      return (
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#999' }}>
            Unknown exercise type: {exercise.type}
          </Text>
        </View>
      );
  }
}
