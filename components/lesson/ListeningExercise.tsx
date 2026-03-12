import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { gradeAnswer, gradeToRating } from '../../lib/grading';
import type { Exercise } from '../../types';

interface ListeningExerciseProps {
  exercise: Exercise;
  mode: 'choice' | 'type'; // listening_choice or listening_type
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

/**
 * Listening exercise: play audio, then either pick from options or type what you heard.
 */
export function ListeningExercise({ exercise, mode, onAnswer }: ListeningExerciseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [gradeResult, setGradeResult] = useState<ReturnType<typeof gradeAnswer> | null>(null);

  const options = exercise.options ?? [];
  const audioUrl = exercise.promptAudioUrl;

  const handleChoiceSelect = async (option: string) => {
    if (revealed) return;

    setSelected(option);
    setRevealed(true);

    const isCorrect =
      option.toLowerCase().trim() === exercise.correctAnswer.toLowerCase().trim();

    if (isCorrect) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => onAnswer(option, isCorrect), 1200);
  };

  const handleTypeSubmit = async () => {
    if (revealed || !typedAnswer.trim()) return;

    setRevealed(true);
    const result = gradeAnswer(typedAnswer, exercise.correctAnswer, exercise.acceptedAnswers);
    setGradeResult(result);

    if (result.isCorrect) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => onAnswer(typedAnswer, result.isCorrect), 1500);
  };

  return (
    <View>
      <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 8 }}>
        {mode === 'choice' ? 'Listen and choose' : 'Listen and type what you hear'}
      </Text>

      {/* Audio Player */}
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        {audioUrl ? (
          <AudioPlayButton audioUrl={audioUrl} size={72} />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#E5E7EB',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: '#999' }}>No audio</Text>
          </View>
        )}
        <Text style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
          Tap to play
        </Text>
      </View>

      {/* Prompt (may be hidden for pure listening) */}
      {exercise.prompt && mode === 'choice' && (
        <Text style={{ fontSize: 18, fontWeight: '500', marginBottom: 16, textAlign: 'center' }}>
          {exercise.prompt}
        </Text>
      )}

      {/* Choice mode */}
      {mode === 'choice' && options.map((option, index) => {
        const isCorrectOption = option.toLowerCase().trim() === exercise.correctAnswer.toLowerCase().trim();
        const isSelected = option === selected;

        let bg = '#F3F4F6';
        let border = 'transparent';
        if (revealed && isCorrectOption) {
          bg = '#DCFCE7';
          border = '#22C55E';
        } else if (revealed && isSelected && !isCorrectOption) {
          bg = '#FEE2E2';
          border = '#EF4444';
        } else if (isSelected) {
          bg = '#E0E7FF';
          border = '#6366F1';
        }

        return (
          <Pressable
            key={`${option}-${index}`}
            onPress={() => handleChoiceSelect(option)}
            disabled={revealed}
            style={{
              padding: 16,
              borderRadius: 14,
              marginBottom: 10,
              backgroundColor: bg,
              borderWidth: 2,
              borderColor: border,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Option: ${option}`}
          >
            <Text style={{ fontSize: 17 }}>{option}</Text>
          </Pressable>
        );
      })}

      {/* Type mode */}
      {mode === 'type' && (
        <View>
          <TextInput
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            placeholder="Type what you hear..."
            autoCapitalize="none"
            autoCorrect={false}
            editable={!revealed}
            onSubmitEditing={handleTypeSubmit}
            returnKeyType="done"
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
              marginBottom: 12,
              backgroundColor: revealed ? (gradeResult?.isCorrect ? '#DCFCE7' : '#FEE2E2') : '#fff',
            }}
            accessibilityLabel="Type your answer"
          />

          {!revealed && (
            <Pressable
              onPress={handleTypeSubmit}
              disabled={!typedAnswer.trim()}
              style={{
                backgroundColor: typedAnswer.trim() ? '#6366F1' : '#C7D2FE',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Submit answer"
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Check</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Feedback */}
      {revealed && gradeResult && (
        <Text
          style={{
            fontSize: 15,
            color: gradeResult.isCorrect ? '#22C55E' : '#EF4444',
            marginTop: 8,
            fontWeight: '500',
          }}
        >
          {gradeResult.feedback}
        </Text>
      )}
    </View>
  );
}
