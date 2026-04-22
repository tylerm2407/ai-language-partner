import { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import type { Exercise } from '../../types';

interface ListeningExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function ListeningExercise({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: ListeningExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const { playing, loading, play } = useAudioPlayer();

  const isChoiceType = exercise.type === 'listening_choice' && exercise.options;

  const handlePlayAudio = () => {
    if (exercise.promptAudioUrl) {
      play(exercise.promptAudioUrl);
    }
  };

  const handleSelectOption = (option: string) => {
    if (submitted || showResult) return;
    const grade = gradeAnswer(option, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
      },
    });
    setAnswer(option);
    setSubmitted(true);
    setResult(grade);

    if (Platform.OS !== 'web') {
      if (grade.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(grade.isCorrect, option);
  };

  const handleSubmitTyped = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
      },
    });
    setResult(grade);
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (grade.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(grade.isCorrect, answer);
  };

  const handleRetry = () => {
    setAnswer('');
    setSubmitted(false);
    setResult(null);
  };

  const getOptionStyle = (option: string) => {
    if (!submitted && !showResult) {
      return 'bg-dark-card-alt border-2 border-transparent';
    }
    const isCorrectOption =
      option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
      exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

    if ((submitted || showResult) && isCorrectOption) {
      return 'bg-success-bg border-2 border-success';
    }
    if (option === answer && !isCorrectOption) {
      return 'bg-error-bg border-2 border-error';
    }
    return 'bg-dark-card-alt border-2 border-transparent';
  };

  return (
    <ExerciseCard type={exercise.type} prompt="Listen and answer">
      {/* Audio play button */}
      <Pressable
        className="bg-primary w-20 h-20 rounded-full items-center justify-center self-center mb-6"
        onPress={handlePlayAudio}
        disabled={playing || loading || !exercise.promptAudioUrl}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Audio playing' : 'Play audio'}
      >
        <Ionicons
          name={playing ? 'volume-high' : 'play'}
          size={36}
          color="white"
        />
      </Pressable>

      {!exercise.promptAudioUrl && (
        <Text className="text-text-tertiary text-sm text-center mb-4">
          No audio available for this exercise
        </Text>
      )}

      {/* Choice or typed answer */}
      {isChoiceType ? (
        <View>
          {exercise.options!.map((option, index) => (
            <Pressable
              key={index}
              className={`p-4 rounded-[14px] mb-2.5 ${getOptionStyle(option)}`}
              onPress={() => handleSelectOption(option)}
              disabled={submitted || showResult}
              accessibilityRole="button"
              accessibilityLabel={`Option ${index + 1}: ${option}`}
            >
              <Text className="text-text-primary text-[17px] font-semibold">
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <TextInput
            className={`border-2 ${submitted ? (result?.isCorrect ? 'border-success' : 'border-error') : 'border-input-border'} rounded-[14px] px-4 py-2.5 text-base text-text-primary`}
            placeholder="Type what you heard..."
            placeholderTextColor="#64748B"
            value={answer}
            onChangeText={setAnswer}
            editable={!submitted && !showResult}
            autoCapitalize="none"
            accessibilityLabel="Listening answer input"
          />
          {!submitted && !showResult && (
            <View className="mt-4">
              <Button
                label="Check"
                onPress={handleSubmitTyped}
                disabled={!answer.trim()}
              />
            </View>
          )}
        </>
      )}

      {result && onContinue && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}
    </ExerciseCard>
  );
}
