import { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import type { Exercise } from '../../types';

interface ListeningExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function ListeningExercise({ exercise, onAnswer, showResult }: ListeningExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  const { playing, loading, play } = useAudioPlayer();

  const isChoiceType = exercise.type === 'listening_choice' && exercise.options;

  const handlePlayAudio = () => {
    if (exercise.promptAudioUrl) {
      play(exercise.promptAudioUrl);
    }
  };

  const handleSelectOption = (option: string) => {
    if (submitted || showResult) return;

    const isCorrect =
      option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
      exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

    setAnswer(option);
    setSubmitted(true);
    setResult({
      isCorrect,
      feedback: isCorrect ? 'Correct!' : `Incorrect. The answer is: ${exercise.correctAnswer}`,
    });

    if (Platform.OS !== 'web') {
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(isCorrect, option);
  };

  const handleSubmitTyped = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers);
    setResult({ isCorrect: grade.isCorrect, feedback: grade.feedback });
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

      {(submitted || showResult) && result && (
        <View className={`mt-3 p-3 rounded-[14px] ${result.isCorrect ? 'bg-success-bg' : 'bg-error-bg'}`}>
          <Text className={`text-sm font-medium ${result.isCorrect ? 'text-success' : 'text-error'}`}>
            {result.feedback}
          </Text>
        </View>
      )}
    </ExerciseCard>
  );
}
