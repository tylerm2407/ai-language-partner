import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../ui/ProgressBar';
import { Ionicons } from '@expo/vector-icons';
import type { WritingFeedback } from '../../types';
import { GradientBackground } from '../ui/GradientBackground';
import { haptic } from '../../lib/haptics';
import { ReportContentSheet } from '../ui/ReportContentSheet';
import { colors, radii, spacing } from '../../config/theme';
import { writingOverallScore } from '../../lib/writing-quality';

interface Props {
  feedback: WritingFeedback;
  previousScore?: number | null;
  attemptNumber?: number;
  maxAttempts?: number;
  onTryAgain: () => void;
  onContinue: () => void;
}

function validScore(value: unknown, maximum = 100): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
}

function displayStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

interface DisplayCorrection {
  original: string;
  corrected: string;
  explanation: string;
  type: string;
}

function displayCorrections(value: unknown): DisplayCorrection[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is DisplayCorrection => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
    const correction = item as Record<string, unknown>;
    return ['original', 'corrected', 'explanation', 'type'].every(key => typeof correction[key] === 'string');
  });
}

export function WritingFeedbackView({ feedback, previousScore, attemptNumber = 1, maxAttempts = 3, onTryAgain, onContinue }: Props) {
  // Old saved feedback predates the fresh-response validator. Missing or
  // malformed optional display data must not crash the screen or invent zeros.
  const strengths = displayStrings(feedback.strengths);
  const improvements = displayStrings(feedback.improvements);
  const corrections = displayCorrections(feedback.corrections);
  const overallFeedback = typeof feedback.overallFeedback === 'string' && feedback.overallFeedback.trim() ? feedback.overallFeedback : null;
  const correctedVersion = typeof feedback.correctedVersion === 'string' && feedback.correctedVersion.trim() ? feedback.correctedVersion : null;
  // Report the same validated text the learner can see, including legacy
  // feedback that has useful details but no overall prose. Never report the
  // local unavailable-status message or stringify malformed saved objects.
  const reportContent = [
    overallFeedback,
    strengths.length ? `Strengths:\n${strengths.join('\n')}` : null,
    improvements.length ? `Areas to improve:\n${improvements.join('\n')}` : null,
    correctedVersion ? `Corrected version:\n${correctedVersion}` : null,
    ...corrections.map(correction => {
      const parts = [
        ['Type', correction.type], ['Original', correction.original],
        ['Corrected', correction.corrected], ['Explanation', correction.explanation],
      ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value}`);
      return parts.length ? `Correction:\n${parts.join('\n')}` : null;
    }),
  ].filter((part): part is string => part !== null).join('\n\n');
  const assessedScore = writingOverallScore(feedback);
  const isGraded = assessedScore !== null;
  const overallScore = Math.round((assessedScore ?? 0) * 100);
  const scoreColor = overallScore >= 80 ? colors.success.base : overallScore >= 60 ? colors.warning.base : colors.error.base;
  const scoreBg = overallScore >= 80 ? colors.success.tint : overallScore >= 60 ? colors.warning.tint : colors.error.tint;

  const [reportOpen, setReportOpen] = useState(false);
  const canRetry = !isGraded || attemptNumber < maxAttempts;

  // The grade arriving is the moment worth feeling. Writing is the longest
  // single task in the app — minutes of typing, then a spinner — and it ended
  // in silence, which is exactly where a learner puts the phone down and misses
  // the result.
  //
  // Tiered to match the score circle right below it, so the buzz and the colour
  // say the same thing: green is a Success, amber a Warning, red an Error. A
  // flat Success on every grade would tell the learner their worst attempt felt
  // identical to their best.
  useEffect(() => {
    if (!isGraded) return;
    haptic(overallScore >= 80 ? 'complete' : overallScore >= 60 ? 'warning' : 'incorrect');
  }, [overallScore, isGraded]);
  const improvementDelta = isGraded && previousScore != null ? overallScore - Math.round(previousScore * 100) : null;

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
            backgroundColor: isGraded ? scoreBg : colors.surface.card, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: isGraded ? scoreColor : colors.text.tertiary }}>{isGraded ? overallScore : '—'}</Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: spacing.xs }}>{isGraded ? 'Overall Score' : 'Not graded'}</Text>

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
        {isGraded && <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
          {validScore(feedback.grammarScore) && <ScoreRow label="Grammar" score={feedback.grammarScore} />}
          {validScore(feedback.vocabularyScore) && <ScoreRow label="Vocabulary" score={feedback.vocabularyScore} />}
          {validScore(feedback.coherenceScore) && <ScoreRow label="Coherence" score={feedback.coherenceScore} />}
          {validScore(feedback.task_completion, 25) && <ScoreRow label="Task completion" score={feedback.task_completion * 4} />}
          {validScore(feedback.spellingScore) && <ScoreRow label="Spelling" score={feedback.spellingScore} />}
          {validScore(feedback.sentenceStructureScore) && <ScoreRow label="Sentence Structure" score={feedback.sentenceStructureScore} />}
        </View>}

        {/* Strengths */}
        {strengths.length > 0 && (
          <View style={{ backgroundColor: colors.success.tint, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success.base} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.success.base, marginLeft: 6 }}>Strengths</Text>
            </View>
            {strengths.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: colors.success.light, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Areas for Improvement */}
        {improvements.length > 0 && (
          <View style={{ backgroundColor: colors.warning.tint, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="bulb" size={18} color={colors.warning.base} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.warning.base, marginLeft: 6 }}>Areas to Improve</Text>
            </View>
            {improvements.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: colors.warning.light, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Overall Feedback */}
        <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: spacing.xs, color: colors.text.onPrimary }}>Feedback</Text>
          <Text style={{ fontSize: 15, color: colors.text.tertiary, lineHeight: 22 }}>{overallFeedback ?? 'Written feedback is unavailable for this attempt.'}</Text>

          {/* Google Play generative-AI policy: users must be able to flag AI output. */}
          {reportContent.length > 0 && <Pressable
            onPress={() => setReportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Report this feedback"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, minHeight: 44 }}
          >
            <Ionicons name="flag-outline" size={14} color={colors.text.quaternary} />
            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginLeft: spacing.xxs }}>
              Report this feedback
            </Text>
          </Pressable>}
        </View>

        {/* Corrected Version */}
        {correctedVersion && (
          <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="create" size={18} color={colors.action.accent} />
              <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 6, color: colors.text.onPrimary }}>Corrected Version</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.text.onPrimary, lineHeight: 22, fontStyle: 'italic' }}>
              {correctedVersion}
            </Text>
          </View>
        )}

        {/* Corrections */}
        {corrections.length > 0 && (
          <View style={{ backgroundColor: colors.surface.card, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.md }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: spacing.sm, color: colors.text.onPrimary }}>
              Corrections ({corrections.length})
            </Text>
            {corrections.map((correction, index) => (
              <View key={index} style={{
                marginBottom: index < corrections.length - 1 ? spacing.sm : 0,
                paddingBottom: index < corrections.length - 1 ? spacing.sm : 0,
                borderBottomWidth: index < corrections.length - 1 ? 1 : 0,
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
            onPress={() => {
              haptic('buttonPress');
              onTryAgain();
            }}
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
          onPress={() => {
            haptic('buttonPress');
            onContinue();
          }}
          style={{
            flex: 1, backgroundColor: colors.action.primaryFill, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.onPrimary }}>Continue</Text>
        </Pressable>
      </View>

      <ReportContentSheet
        visible={reportOpen && reportContent.length > 0}
        onDismiss={() => setReportOpen(false)}
        content={reportContent}
        surface="writing"
        context={{ overallScore: assessedScore === null ? null : overallScore }}
      />
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
