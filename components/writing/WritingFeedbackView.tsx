import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { Ionicons } from '@expo/vector-icons';
import type { WritingFeedback } from '../../types';
import { haptic } from '../../lib/haptics';
import { ReportContentSheet } from '../ui/ReportContentSheet';
import { spacing, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * The three grade tiers, as a FILL and a HUE rather than as a text colour.
 *
 * UI 2.0's `green` and `yellow` are saturated fills picked to be seen at 20px,
 * not read at 14px: on a light card they measure 2.2:1 and 1.5:1, far under AA.
 * So the tier paints the circle's fill and its ring, the row's left rule and
 * the icon well — and every score, label and sentence on top of them stays
 * `ink`, which clears AA on every tint in both schemes. That is the same split
 * `Ui2Badge` documents and `ComprehensionQuestions` already uses for its
 * correct/incorrect answer states, so a graded surface looks the same
 * everywhere in the app.
 */
const scoreHue = (c: Ui2Palette, score: number): string =>
  score >= 80 ? c.green : score >= 60 ? c.yellow : c.error;
const scoreFill = (c: Ui2Palette, score: number): string =>
  score >= 80 ? c.greenTint : score >= 60 ? c.yellowTint : c.pinkTint;

interface Props {
  feedback: WritingFeedback;
  previousScore?: number | null;
  attemptNumber?: number;
  maxAttempts?: number;
  onTryAgain: () => void;
  onContinue: () => void;
}

export function WritingFeedbackView({ feedback, previousScore, attemptNumber = 1, maxAttempts = 3, onTryAgain, onContinue }: Props) {
  const { c, type, shape } = useUi2Theme();
  const spellingScore = feedback.spellingScore ?? 0;
  const sentenceStructureScore = feedback.sentenceStructureScore ?? 0;
  const overallScore = Math.round(
    (feedback.grammarScore + feedback.vocabularyScore + feedback.coherenceScore + spellingScore + sentenceStructureScore) / 5
  );
  const scoreColor = scoreHue(c, overallScore);
  const scoreBg = scoreFill(c, overallScore);

  const [reportOpen, setReportOpen] = useState(false);
  const canRetry = attemptNumber < maxAttempts;

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
    haptic(overallScore >= 80 ? 'complete' : overallScore >= 60 ? 'warning' : 'incorrect');
  }, [overallScore]);
  const improvementDelta = previousScore != null ? overallScore - Math.round(previousScore * 100) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontFamily: type.heading, marginBottom: spacing.xs, textAlign: 'center', color: c.ink }} accessibilityRole="header">
          Writing Feedback
        </Text>

        {/* Attempt indicator */}
        {maxAttempts > 1 && (
          <Text style={{ fontSize: 13, fontFamily: type.ui, color: c.muted, textAlign: 'center', marginBottom: spacing.xs }}>
            Attempt {attemptNumber} of {maxAttempts}
          </Text>
        )}

        {/* Overall Score Circle */}
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, borderWidth: shape.border, borderColor: scoreColor,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, fontFamily: type.heading, color: c.ink }}>{overallScore}</Text>
          </View>
          <Text style={{ fontSize: 14, fontFamily: type.ui, color: c.muted, marginTop: spacing.xs }}>Overall Score</Text>

          {/* Improvement Delta */}
          {improvementDelta !== null && improvementDelta !== 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxs,
              backgroundColor: improvementDelta > 0 ? c.greenTint : c.pinkTint,
              borderWidth: shape.border, borderColor: improvementDelta > 0 ? c.green : c.error,
              borderRadius: shape.radiusButton, paddingHorizontal: 10, paddingVertical: spacing.xxs,
            }}>
              <Ionicons
                name={improvementDelta > 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={c.ink}
              />
              <Text style={{
                fontSize: 14, fontFamily: type.uiBold, marginLeft: spacing.xxs,
                color: c.ink,
              }}>
                {improvementDelta > 0 ? '+' : ''}{improvementDelta} points from last attempt
              </Text>
            </View>
          )}
        </View>

        {/* Category Scores */}
        <View style={{ backgroundColor: c.card, borderWidth: shape.border, borderColor: c.cardBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
          <ScoreRow label="Grammar" score={feedback.grammarScore} />
          <ScoreRow label="Vocabulary" score={feedback.vocabularyScore} />
          <ScoreRow label="Coherence" score={feedback.coherenceScore} />
          <ScoreRow label="Spelling" score={spellingScore} />
          <ScoreRow label="Sentence Structure" score={sentenceStructureScore} />
        </View>

        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <View style={{ backgroundColor: c.greenTint, borderWidth: shape.border, borderColor: c.greenBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="checkmark-circle" size={18} color={c.ink} />
              <Text style={{ fontSize: 16, fontFamily: type.uiBold, color: c.ink, marginLeft: 6 }}>Strengths</Text>
            </View>
            {feedback.strengths.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, fontFamily: type.ui, color: c.ink, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Areas for Improvement */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <View style={{ backgroundColor: c.yellowTint, borderWidth: shape.border, borderColor: c.yellowBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="bulb" size={18} color={c.ink} />
              <Text style={{ fontSize: 16, fontFamily: type.uiBold, color: c.ink, marginLeft: 6 }}>Areas to Improve</Text>
            </View>
            {feedback.improvements.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, fontFamily: type.ui, color: c.ink, lineHeight: 20, marginBottom: spacing.xxs }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Overall Feedback */}
        <View style={{ backgroundColor: c.card, borderWidth: shape.border, borderColor: c.cardBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 16, fontFamily: type.uiBold, marginBottom: spacing.xs, color: c.ink }}>Feedback</Text>
          <Text style={{ fontSize: 15, fontFamily: type.ui, color: c.muted, lineHeight: 22 }}>{feedback.overallFeedback}</Text>

          {/* Google Play generative-AI policy: users must be able to flag AI output. */}
          <Pressable
            onPress={() => setReportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Report this feedback"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, minHeight: 44 }}
          >
            <Ionicons name="flag-outline" size={14} color={c.idle} />
            <Text style={{ fontSize: 12, fontFamily: type.ui, color: c.idle, marginLeft: spacing.xxs }}>
              Report this feedback
            </Text>
          </Pressable>
        </View>

        {/* Corrected Version */}
        {feedback.correctedVersion && (
          <View style={{ backgroundColor: c.card, borderWidth: shape.border, borderColor: c.cardBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Ionicons name="create" size={18} color={c.onTint} />
              <Text style={{ fontSize: 16, fontFamily: type.uiBold, marginLeft: 6, color: c.ink }}>Corrected Version</Text>
            </View>
            <Text style={{ fontSize: 15, fontFamily: type.ui, color: c.ink, lineHeight: 22, fontStyle: 'italic' }}>
              {feedback.correctedVersion}
            </Text>
          </View>
        )}

        {/* Corrections */}
        {feedback.corrections.length > 0 && (
          <View style={{ backgroundColor: c.card, borderWidth: shape.border, borderColor: c.cardBorder, borderBottomWidth: shape.slab, borderRadius: shape.radiusCard, padding: spacing.xl, marginBottom: spacing.md }}>
            <Text style={{ fontSize: 16, fontFamily: type.uiBold, marginBottom: spacing.sm, color: c.ink }}>
              Corrections ({feedback.corrections.length})
            </Text>
            {feedback.corrections.map((correction, index) => (
              <View key={index} style={{
                marginBottom: index < feedback.corrections.length - 1 ? spacing.sm : 0,
                paddingBottom: index < feedback.corrections.length - 1 ? spacing.sm : 0,
                borderBottomWidth: index < feedback.corrections.length - 1 ? 1 : 0,
                borderBottomColor: c.cardBorder,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs }}>
                  <View style={{ backgroundColor: c.primaryTint, borderRadius: 6, paddingHorizontal: spacing.xs, paddingVertical: 2, marginRight: spacing.xs }}>
                    <Text style={{ fontSize: 12, color: c.onTint, fontFamily: type.uiBold }}>{correction.type}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontFamily: type.ui, color: c.error, textDecorationLine: 'line-through', marginBottom: 2 }}>
                  {correction.original}
                </Text>
                <Text style={{ fontSize: 15, fontFamily: type.uiBold, color: c.ink, marginBottom: spacing.xxs }}>
                  {correction.corrected}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: type.ui, color: c.muted, fontStyle: 'italic' }}>{correction.explanation}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ padding: spacing.xl, flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.cardBorder }}>
        {canRetry && (
          <Pressable
            onPress={() => {
              haptic('buttonPress');
              onTryAgain();
            }}
            style={{
              flex: 1, backgroundColor: c.card, borderWidth: shape.border, borderColor: c.cardBorder, borderBottomWidth: shape.slab, paddingVertical: spacing.md, borderRadius: shape.radiusButton, alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={{ fontSize: 18, fontFamily: type.uiBold, color: c.ink }}>Try Again</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            haptic('buttonPress');
            onContinue();
          }}
          style={{
            flex: 1, backgroundColor: c.primary, borderWidth: shape.border, borderColor: c.slab, borderBottomWidth: shape.slab, paddingVertical: spacing.md, borderRadius: shape.radiusButton, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ fontSize: 18, fontFamily: type.uiBold, color: c.onPrimary }}>Continue</Text>
        </Pressable>
      </View>

      <ReportContentSheet
        visible={reportOpen}
        onDismiss={() => setReportOpen(false)}
        content={feedback.overallFeedback}
        surface="writing"
        context={{ overallScore }}
      />
    </SafeAreaView>
    </View>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const { c, type, shape } = useUi2Theme();
  const normalizedScore = Math.min(1, score / 100);
  const color = scoreHue(c, score);

  return (
    <View style={{ marginBottom: spacing.sm, borderLeftWidth: shape.border, borderLeftColor: color, paddingLeft: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs }}>
        <Text style={{ fontSize: 14, fontFamily: type.ui, color: c.muted }}>{label}</Text>
        <Text style={{ fontSize: 14, fontFamily: type.uiBold, color: c.ink }}>{score}/100</Text>
      </View>
      <Ui2ProgressBar progress={normalizedScore} />
    </View>
  );
}
