import { View, Text } from 'react-native';
import type { Exercise } from '../../types';

interface ExerciseCardProps {
  exercise: Exercise;
  onAnswer: (answer: string) => void;
}

/**
 * Stub component for rendering a single exercise within a lesson.
 * TODO: Implement different renderers per exercise type:
 *   - multiple_choice → tap one of 4 options
 *   - listening_choice → play audio, then tap option
 *   - listening_type → play audio, then type what you heard
 *   - translate_to_target → show native text, type in target language
 *   - translate_to_native → show target text, type in native language
 *   - speaking → play prompt, record user speech
 *   - fill_blank → sentence with blank, type missing word
 *   - free_production → open-ended AI-graded response
 */
export function ExerciseCard({ exercise, onAnswer }: ExerciseCardProps) {
  return (
    <View
      style={{
        padding: 24,
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        minHeight: 200,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 8 }}>
        {exercise.type.replace(/_/g, ' ').toUpperCase()}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 16 }}>
        {exercise.prompt}
      </Text>
      <Text style={{ fontSize: 14, color: '#999' }}>
        Exercise renderer not yet implemented for this type.
      </Text>
    </View>
  );
}
