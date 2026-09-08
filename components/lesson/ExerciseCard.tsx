import { View, Text, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { minLineHeight, spacing, typography } from '../../config/theme';
import type { ExerciseType } from '../../types';
import { useExerciseChrome } from './exercise-chrome-context';

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

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
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
 * Instruction label — sentence case, 14px, helper tone.
 *
 * Lives here rather than in each exercise so all 16 types share one voice;
 * before this, a type that wanted a different prompt size simply set one.
 * Colour is NOT here: UI 2.0 reads it from `useUi2Theme()`, which a module
 * constant cannot, so it is merged in at the call site below.
 */
const LABEL_STYLE: TextStyle = {
  fontFamily: typography.family.medium,
  fontSize: 14,
  lineHeight: minLineHeight(14),
  marginBottom: spacing.xs,
};

/**
 * Prompt — Nunito 22px semibold, primary ink.
 *
 * Deliberately NOT a display face: config/theme.ts reserves that for hero and
 * celebration moments, and a serif question stem would compete with the
 * target-language text inside it. Colour is merged in at the call site, for
 * the same reason as LABEL_STYLE.
 */
const PROMPT_STYLE: TextStyle = {
  fontFamily: typography.family.semibold,
  fontSize: 22,
  lineHeight: minLineHeight(22),
};

export function ExerciseCard({ children, type, prompt, promptNode }: ExerciseCardProps) {
  const { c, shape } = useUi2Theme();
  const { instructionInHero } = useExerciseChrome();
  return (
    <View
      className="p-6 min-h-[200px]"
      style={{ backgroundColor: c.card, borderRadius: shape.radiusCard }}
    >
      {/* Under ExerciseChrome the hero block already titles itself with this
          instruction; printing it again here put the same words twice in
          60pt. Anywhere else the card still introduces itself. */}
      {instructionInHero ? null : (
        <Text style={[LABEL_STYLE, { color: c.muted }]} accessibilityRole="header">
          {EXERCISE_TYPE_LABELS[type]}
        </Text>
      )}
      {promptNode ? (
        <View style={{ marginBottom: spacing.lg }}>{promptNode}</View>
      ) : prompt ? (
        <Text
          style={[PROMPT_STYLE, { color: c.ink, marginBottom: spacing.lg }]}
          accessibilityRole="header"
        >
          {prompt}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
