import { View, Text, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors, minLineHeight, spacing, typography } from '../../config/theme';
import type { ExerciseType } from '../../types';

interface ExerciseCardProps {
  children: ReactNode;
  type: ExerciseType;
  /**
   * Plain-text prompt. If `promptNode` is provided, it is rendered instead
   * (e.g. to allow target-form highlighting via `<HighlightedText>`).
   */
  prompt?: string;
  /**
   * Renders a custom ReactNode in place of the default prompt Text. Takes
   * precedence over `prompt`.
   */
  promptNode?: ReactNode;
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
  collocation_match: 'Match the words that go together',
  word_form: 'Choose the correct word form',
  sentence_transformation: 'Rewrite the sentence',
  mini_dialogue: 'Complete the dialogue',
};

/**
 * Instruction label — sentence case, 14px, text.secondary.
 *
 * Lives here rather than in each exercise so all 16 types share one voice;
 * before this, a type that wanted a different prompt size simply set one.
 */
const LABEL_STYLE: TextStyle = {
  fontFamily: typography.family.medium,
  fontSize: 14,
  lineHeight: minLineHeight(14),
  color: colors.text.secondary,
  marginBottom: spacing.xs,
};

/**
 * Prompt — Nunito 22px semibold, text.primary.
 *
 * Deliberately NOT Fraunces: config/theme.ts reserves the display face for
 * hero and celebration moments, and a serif question stem would compete with
 * the target-language text inside it.
 */
const PROMPT_STYLE: TextStyle = {
  fontFamily: typography.family.semibold,
  fontSize: 22,
  lineHeight: minLineHeight(22),
  color: colors.text.primary,
};

export function ExerciseCard({ children, type, prompt, promptNode }: ExerciseCardProps) {
  return (
    <View className="bg-dark-card rounded-[20px] p-6 min-h-[200px] shadow-card border border-white/10">
      <Text style={LABEL_STYLE} accessibilityRole="header">
        {TYPE_LABELS[type]}
      </Text>
      {promptNode ? (
        <View style={{ marginBottom: spacing.lg }}>{promptNode}</View>
      ) : prompt ? (
        <Text
          style={[PROMPT_STYLE, { marginBottom: spacing.lg }]}
          accessibilityRole="header"
        >
          {prompt}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
