import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../ui/ProgressBar';
import { Ionicons } from '@expo/vector-icons';
import type { WritingFeedback } from '../../types';
import { GradientBackground } from '../ui/GradientBackground';
import { colors, radii, spacing } from '../../config/theme';

interface Props {
  feedback: WritingFeedback;
  previousScore?: number | null;
  attemptNumber?: number;
  maxAttempts?: number;
  onTryAgain: () => void;
  onContinue: () => void;
}

export function WritingFeedbackView({ feedback, previousScore, attemptNumber = 1, maxAttempts = 3, onTryAgain, onContinue }: Props) {
  const spellingScore = feedback.spellingScore ?? 0;
  const sentenceStructureScore = feedback.sentenceStructureScore ?? 0;
  const overallScore = Math.round(
    (feedback.grammarScore + feedback.vocabularyScore + feedback.coherenceScore + spellingScore + sentenceStructureScore) / 5
  );
  const scoreColor = overallScore >= 80 ? colors.success.base : overallScore >= 60 ? colors.warning.base : colors.error.base;
  const scoreBg = overallScore >= 80 ? colors.success.tint : overallScore >= 60 ? colors.warning.tint : colors.error.tint;

  const canRetry = attemptNumber < maxAttempts;
  const improvementDelta = previousScore != null ? overallScore - Math.round(previousScore * 100) : null;

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: spacing.xs, textAlign: 'center', color: colors.text.onPrimary }} accessibilityRole="header">
          Writing Feedback
        </Text>

        {/* Attempt indicator */}
        {maxAttempts > 1 && (
          <Text style={{ fontSize: 13, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.xs }}>
            Attempt {attemptNumber} of {maxAttempts}
          </Text>
        )}

        {/* Overall Score Circle */}
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: scoreColor }}>{overallScore}</Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: spacing.xs }}>Overall Score</Text>

          {/* Improvement Delta */}
          {improvementDelta !== null && improvementDelta !== 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxs,
              backgroundColor: improvementDelta > 0 ? colors.success.tint : colors.error.tint,
              borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: spacing.xxs,
            }}>
              <Ionicons
                name={improvementDelta > 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={improvementDelta > 0 ? colors.success.base : colors.error.base}
              />
              <Text style={{
                fontSize: 14, fontWeight: '600', marginLeft: spacing.xxs,
                color: improvementDelta > 0 ? colors.success.base : colors.error.base,
              }}>
                {improvementDelta > 0 ? '+' : ''}{improvementDelta} points from last attempt
              </Text>
            </View>
          )}
        </View>

        {/* Category Scores */}
        <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
          <ScoreRow label="Grammar" score={feedback.grammarScore} />
          <ScoreRow label="Vocabulary" score={feedback.vocabularyScore} />
          <ScoreRow label="Coherence" score={feedback.coherenceScore} />
          <ScoreRow label="Spelling" score={spellingScore} />
          <ScoreRow label="Sentence Structure" score={sentenceStructureScore} />
        </View>

        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <View style={{ backgroundColor: colors.success.tint, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success.base} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.success.base, marginLeft: 6 }}>Strengths</Text>
            </View>
            {feedback.strengths.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: colors.success.light, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Areas for Improvement */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <View style={{ backgroundColor: colors.warning.tint, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="bulb" size={18} color={colors.warning.base} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.warning.base, marginLeft: 6 }}>Areas to Improve</Text>
            </View>
            {feedback.improvements.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: colors.warning.light, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Overall Feedback */}
        <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: spacing.xs, color: colors.text.onPrimary }}>Feedback</Text>
          <Text style={{ fontSize: 15, color: colors.text.tertiary, lineHeight: 22 }}>{feedback.overallFeedback}</Text>
        </View>

        {/* Corrected Version */}
        {feedback.correctedVersion && (
          <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="create" size={18} color={colors.indigo[500]} />
              <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 6, color: colors.text.onPrimary }}>Corrected Version</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.text.onPrimary, lineHeight: 22, fontStyle: 'italic' }}>
              {feedback.correctedVersion}
            </Text>
          </View>
        )}

        {/* Corrections */}
        {feedback.corrections.length > 0 && (
          <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: spacing.sm, color: colors.text.onPrimary }}>
              Corrections ({feedback.corrections.length})
            </Text>
            {feedback.corrections.map((correction, index) => (
              <View key={index} style={{
                marginBottom: index < feedback.corrections.length - 1 ? spacing.sm : 0,
                paddingBottom: index < feedback.corrections.length - 1 ? spacing.sm : 0,
                borderBottomWidth: index < feedback.corrections.length - 1 ? 1 : 0,
                borderBottomColor: colors.border.default,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs }}>
                  <View style={{ backgroundColor: colors.correctionChip.grammar.bg, borderRadius: 6, paddingHorizontal: spacing.xs, paddingVertical: 2, marginRight: spacing.xs }}>
                    <Text style={{ fontSize: 12, color: colors.indigo[400], fontWeight: '600' }}>{correction.type}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, color: colors.error.base, textDecorationLine: 'line-through', marginBottom: 2 }}>
                  {correction.original}
                </Text>
                <Text style={{ fontSize: 15, color: colors.success.base, fontWeight: '600', marginBottom: spacing.xxs }}>
                  {correction.corrected}
                </Text>
                <Text style={{ fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic' }}>{correction.explanation}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ padding: spacing.xl, flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.default }}>
        {canRetry && (
          <Pressable
            onPress={onTryAgain}
            style={{
              flex: 1, backgroundColor: colors.surface.card, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.onPrimary }}>Try Again</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onContinue}
          style={{
            flex: 1, backgroundColor: colors.indigo[500], paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.onPrimary }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
    </GradientBackground>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const normalizedScore = Math.min(1, score / 100);
  const color = score >= 80 ? colors.success.base : score >= 60 ? colors.warning.base : colors.error.base;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs }}>
        <Text style={{ fontSize: 14, color: colors.text.tertiary }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color }}>{score}/100</Text>
      </View>
      <ProgressBar progress={normalizedScore} />
    </View>
  );
}
