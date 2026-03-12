import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface FillBlankExerciseProps {
  exercise: Exercise;
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

/**
 * Fill-in-the-blank exercise.
 * The prompt contains "___" where the user should type the missing word.
 */
export function FillBlankExercise({ exercise, onAnswer }: FillBlankExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [gradeResult, setGradeResult] = useState<ReturnType<typeof gradeAnswer> | null>(null);

  // Split prompt around the blank
  const parts = exercise.prompt.split('___');
  const before = parts[0] ?? '';
  const after = parts[1] ?? '';

  const handleSubmit = async () => {
    if (revealed || !answer.trim()) return;

    setRevealed(true);
    const result = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, {
      strict: false,
    });
    setGradeResult(result);

    if (result.isCorrect) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => onAnswer(answer, result.isCorrect), 1500);
  };

  return (
    <View>
      <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 8 }}>
        Fill in the blank
      </Text>

      {/* Sentence with inline blank */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '500' }}>{before}</Text>
        <View
          style={{
            borderBottomWidth: 2,
            borderBottomColor: revealed
              ? gradeResult?.isCorrect
                ? '#22C55E'
                : '#EF4444'
              : '#6366F1',
            minWidth: 80,
            marginHorizontal: 4,
            paddingBottom: 2,
          }}
        >
          {revealed ? (
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: gradeResult?.isCorrect ? '#22C55E' : '#EF4444',
              }}
            >
              {gradeResult?.isCorrect ? answer : exercise.correctAnswer}
            </Text>
          ) : (
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              placeholder="..."
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              style={{
                fontSize: 20,
                fontWeight: '600',
                padding: 0,
                color: '#6366F1',
              }}
              accessibilityLabel="Fill in the missing word"
            />
          )}
        </View>
        <Text style={{ fontSize: 20, fontWeight: '500' }}>{after}</Text>
      </View>

      {!revealed && (
        <Pressable
          onPress={handleSubmit}
          disabled={!answer.trim()}
          style={{
            backgroundColor: answer.trim() ? '#6366F1' : '#C7D2FE',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Check</Text>
        </Pressable>
      )}

      {revealed && gradeResult && !gradeResult.isCorrect && (
        <Text style={{ fontSize: 15, color: '#EF4444', marginTop: 8, fontWeight: '500' }}>
          The correct word was: {exercise.correctAnswer}
        </Text>
      )}
    </View>
  );
}
