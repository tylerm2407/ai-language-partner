import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
}

export function ClozeExercise({ exercise, onAnswer }: Props) {
  const [userInput, setUserInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // The prompt contains the sentence with "___" as the blank
  const parts = exercise.prompt.split('___');
  const beforeBlank = parts[0] ?? '';
  const afterBlank = parts[1] ?? '';

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
        Fill in the blank
      </Text>

      {/* Context sentence with blank */}
      <View style={{
        backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, marginBottom: 20, minHeight: 120,
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18, lineHeight: 28, color: '#111' }}>
          {beforeBlank}
          <View style={{
            borderBottomWidth: 2,
            borderBottomColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#6366F1',
            minWidth: 80,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#6366F1',
              textAlign: 'center',
              paddingHorizontal: 4,
            }}>
              {isRevealed ? (isCorrect ? userInput : exercise.correctAnswer) : userInput || '___'}
            </Text>
          </View>
          {afterBlank}
        </Text>
      </View>

      {/* Input */}
      {!isRevealed && (
        <TextInput
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type the missing word..."
          placeholderTextColor="#999"
          autoFocus
          style={{
            borderWidth: 2,
            borderColor: '#D1D5DB',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
            color: '#111',
            marginBottom: 16,
          }}
          accessibilityLabel="Missing word"
        />
      )}

      {/* Feedback */}
      {isRevealed && !isCorrect && (
        <View style={{
          backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, marginBottom: 16,
        }}>
          <Text style={{ fontSize: 14, color: '#EF4444' }}>
            The correct answer is: <Text style={{ fontWeight: '600' }}>{exercise.correctAnswer}</Text>
          </Text>
        </View>
      )}

      {/* Hint */}
      {exercise.hintText && !isRevealed && (
        <Text style={{ fontSize: 14, color: '#999', fontStyle: 'italic', marginBottom: 16 }}>
          Hint: {exercise.hintText}
        </Text>
      )}

      {/* Button */}
      {!isRevealed ? (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleContinue}
          style={{
            backgroundColor: '#6366F1',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
        </Pressable>
      )}
    </View>
  );
}
