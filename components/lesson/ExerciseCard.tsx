import { View, Text } from 'react-native';
import type { ReactNode } from 'react';
import type { ExerciseType } from '../../types';

interface ExerciseCardProps {
  children: ReactNode;
  type: ExerciseType;
  prompt: string;
}

const TYPE_LABELS: Record<ExerciseType, string> = {
  multiple_choice: 'Choose the correct answer',
  listening_choice: 'What did you hear?',
  listening_type: 'Type what you hear',
  translate_to_target: 'Translate to target language',
  translate_to_native: 'Translate to your language',
  speaking: 'Speak the answer',
  fill_blank: 'Fill in the blank',
  free_production: 'Write freely',
  cloze_deletion: 'Fill in the missing word',
  sentence_construction: 'Arrange the words',
  dictation: 'Type what you hear',
  error_correction: 'Find and fix the error',
};

export function ExerciseCard({ children, type, prompt }: ExerciseCardProps) {
  return (
    <View className="bg-dark-card rounded-[20px] p-6 min-h-[200px] shadow-card border border-dark-border">
      <Text
        className="text-text-secondary text-sm font-sans-medium mb-2"
        accessibilityRole="header"
      >
        {TYPE_LABELS[type]}
      </Text>
      <Text
        className="text-text-primary text-[22px] font-sans-semibold mb-6"
        accessibilityRole="header"
      >
        {prompt}
      </Text>
      {children}
    </View>
  );
}
