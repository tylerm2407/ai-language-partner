import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
}

export function DictationExercise({ exercise, onAnswer }: Props) {
  const [userInput, setUserInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  // Auto-play not implemented via component — user taps play button

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
        Dictation
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 20 }}>
        Listen and type what you hear
      </Text>

      {/* Audio Player */}
      <View style={{
        backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, marginBottom: 20,
        alignItems: 'center', minHeight: 120, justifyContent: 'center',
      }}>
        {exercise.promptAudioUrl ? (
          <View style={{ alignItems: 'center' }}>
            <AudioPlayButton audioUrl={exercise.promptAudioUrl} size={64} />
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
              Tap to play {playCount > 0 ? '(replay)' : ''}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, color: '#999' }}>No audio available</Text>
        )}
      </View>

      {/* Text Input */}
      <TextInput
        value={userInput}
        onChangeText={setUserInput}
        placeholder="Type what you heard..."
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
        accessibilityLabel="Type what you heard"
      />

      {/* Feedback */}
      {isRevealed && !isCorrect && (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#EF4444' }}>
            Correct answer: <Text style={{ fontWeight: '600' }}>{exercise.correctAnswer}</Text>
          </Text>
        </View>
      )}

      {isRevealed && isCorrect && (
        <View style={{ backgroundColor: '#DCFCE7', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#22C55E', fontWeight: '600' }}>Correct!</Text>
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
