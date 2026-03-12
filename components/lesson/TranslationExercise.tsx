import { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface TranslationExerciseProps {
  exercise: Exercise;
  direction: 'to_target' | 'to_native';
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

/**
 * Translation exercise: show text in one language, user types in the other.
 */
export function TranslationExercise({ exercise, direction, onAnswer }: TranslationExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [gradeResult, setGradeResult] = useState<ReturnType<typeof gradeAnswer> | null>(null);
  const startTimeRef = useRef(Date.now());

  const directionLabel =
    direction === 'to_target'
      ? 'Translate to the target language'
      : 'Translate to your native language';

  const handleSubmit = async () => {
    if (revealed || !answer.trim()) return;

    setRevealed(true);
    const result = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers);
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
        {directionLabel}
      </Text>

      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 24 }}>
        {exercise.prompt}
      </Text>

      {exercise.hintText && !revealed && (
        <Text style={{ fontSize: 14, color: '#999', marginBottom: 12, fontStyle: 'italic' }}>
          Hint: {exercise.hintText}
        </Text>
      )}

      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="Type your translation..."
        autoCapitalize="none"
        autoCorrect={false}
        editable={!revealed}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        multiline
        style={{
          borderWidth: 2,
          borderColor: revealed
            ? gradeResult?.isCorrect
              ? '#22C55E'
              : '#EF4444'
            : '#D1D5DB',
          borderRadius: 14,
          padding: 16,
          fontSize: 18,
          minHeight: 80,
          marginBottom: 12,
          backgroundColor: revealed
            ? gradeResult?.isCorrect
              ? '#DCFCE7'
              : '#FEE2E2'
            : '#fff',
          textAlignVertical: 'top',
        }}
        accessibilityLabel="Type your translation"
      />

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
          accessibilityLabel="Submit translation"
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Check</Text>
        </Pressable>
      )}

      {revealed && gradeResult && (
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              fontSize: 15,
              color: gradeResult.isCorrect ? '#22C55E' : '#EF4444',
              fontWeight: '500',
              marginBottom: 4,
            }}
          >
            {gradeResult.feedback}
          </Text>
          {!gradeResult.isCorrect && (
            <Text style={{ fontSize: 15, color: '#666' }}>
              Your answer: "{answer}"
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
