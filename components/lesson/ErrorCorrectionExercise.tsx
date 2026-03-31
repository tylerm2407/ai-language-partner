import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
}

export function ErrorCorrectionExercise({ exercise, onAnswer }: Props) {
  const [userInput, setUserInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const errorSentence = (exercise.metadata?.error_sentence as string) ?? exercise.prompt;

  const handleCheck = () => {
    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers);
    setIsCorrect(grade.isCorrect);
    setIsRevealed(true);

    if (grade.isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleContinue = () => {
    onAnswer(isCorrect, userInput);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Find and fix the error
      </Text>

      {/* Sentence with error */}
      <View style={{
        backgroundColor: '#FEE2E2', borderRadius: 20, padding: 24, marginBottom: 20, minHeight: 100,
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18, lineHeight: 28, color: '#111' }}>
          {errorSentence}
        </Text>
        <Text style={{ fontSize: 13, color: '#EF4444', marginTop: 8, fontStyle: 'italic' }}>
          This sentence contains an error. Type the corrected version below.
        </Text>
      </View>

      {/* Corrected Input */}
      <TextInput
        value={userInput}
        onChangeText={setUserInput}
        placeholder="Type the corrected sentence..."
        placeholderTextColor="#999"
        editable={!isRevealed}
        multiline
        style={{
          borderWidth: 2,
          borderColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#D1D5DB',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 16,
          minHeight: 80,
          textAlignVertical: 'top',
          color: '#111',
          marginBottom: 16,
        }}
        accessibilityLabel="Corrected sentence"
      />

      {/* Feedback */}
      {isRevealed && (
        <View style={{
          backgroundColor: isCorrect ? '#DCFCE7' : '#FEE2E2',
          borderRadius: 14, padding: 16, marginBottom: 16,
        }}>
          {isCorrect ? (
            <Text style={{ fontSize: 14, color: '#22C55E', fontWeight: '600' }}>Correct!</Text>
          ) : (
            <View>
              <Text style={{ fontSize: 14, color: '#EF4444', marginBottom: 4 }}>
                Original (with error):
              </Text>
              <Text style={{ fontSize: 15, color: '#EF4444', textDecorationLine: 'line-through', marginBottom: 8 }}>
                {errorSentence}
              </Text>
              <Text style={{ fontSize: 14, color: '#22C55E', marginBottom: 4 }}>
                Correct version:
              </Text>
              <Text style={{ fontSize: 15, color: '#22C55E', fontWeight: '600' }}>
                {exercise.correctAnswer}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Button */}
      {!isRevealed ? (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleContinue}
          style={{ backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
        </Pressable>
      )}
    </View>
  );
}
