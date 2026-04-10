import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../ui/ProgressBar';
import { Ionicons } from '@expo/vector-icons';
import type { WritingFeedback } from '../../types';
import { GradientBackground } from '../ui/GradientBackground';

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
  const scoreColor = overallScore >= 80 ? '#22C55E' : overallScore >= 60 ? '#CA8A04' : '#EF4444';
  const scoreBg = overallScore >= 80 ? '#DCFCE7' : overallScore >= 60 ? '#FEF9C3' : '#FEE2E2';

  const canRetry = attemptNumber < maxAttempts;
  const improvementDelta = previousScore != null ? overallScore - Math.round(previousScore * 100) : null;

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: '#FFFFFF' }} accessibilityRole="header">
          Writing Feedback
        </Text>

        {/* Attempt indicator */}
        {maxAttempts > 1 && (
          <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 8 }}>
            Attempt {attemptNumber} of {maxAttempts}
          </Text>
        )}

        {/* Overall Score Circle */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: scoreColor }}>{overallScore}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Overall Score</Text>

          {/* Improvement Delta */}
          {improvementDelta !== null && improvementDelta !== 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 4,
              backgroundColor: improvementDelta > 0 ? '#DCFCE7' : '#FEE2E2',
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
            }}>
              <Ionicons
                name={improvementDelta > 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={improvementDelta > 0 ? '#22C55E' : '#EF4444'}
              />
              <Text style={{
                fontSize: 14, fontWeight: '600', marginLeft: 4,
                color: improvementDelta > 0 ? '#22C55E' : '#EF4444',
              }}>
                {improvementDelta > 0 ? '+' : ''}{improvementDelta} points from last attempt
              </Text>
            </View>
          )}
        </View>

        {/* Category Scores */}
        <View style={{ backgroundColor: '#151921', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <ScoreRow label="Grammar" score={feedback.grammarScore} />
          <ScoreRow label="Vocabulary" score={feedback.vocabularyScore} />
          <ScoreRow label="Coherence" score={feedback.coherenceScore} />
          <ScoreRow label="Spelling" score={spellingScore} />
          <ScoreRow label="Sentence Structure" score={sentenceStructureScore} />
        </View>

        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <View style={{ backgroundColor: '#DCFCE7', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#22C55E', marginLeft: 6 }}>Strengths</Text>
            </View>
            {feedback.strengths.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 4 }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Areas for Improvement */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <View style={{ backgroundColor: '#FEF9C3', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="bulb" size={18} color="#CA8A04" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#CA8A04', marginLeft: 6 }}>Areas to Improve</Text>
            </View>
            {feedback.improvements.map((s, i) => (
              <Text key={i} style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 20, marginBottom: 4 }}>
                {'\u2022'} {s}
              </Text>
            ))}
          </View>
        )}

        {/* Overall Feedback */}
        <View style={{ backgroundColor: '#151921', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#FFFFFF' }}>Feedback</Text>
          <Text style={{ fontSize: 15, color: '#9CA3AF', lineHeight: 22 }}>{feedback.overallFeedback}</Text>
        </View>

        {/* Corrected Version */}
        {feedback.correctedVersion && (
          <View style={{ backgroundColor: '#151921', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="create" size={18} color="#6366F1" />
              <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 6, color: '#FFFFFF' }}>Corrected Version</Text>
            </View>
            <Text style={{ fontSize: 15, color: '#FFFFFF', lineHeight: 22, fontStyle: 'italic' }}>
              {feedback.correctedVersion}
            </Text>
          </View>
        )}

        {/* Corrections */}
        {feedback.corrections.length > 0 && (
          <View style={{ backgroundColor: '#151921', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#FFFFFF' }}>
              Corrections ({feedback.corrections.length})
            </Text>
            {feedback.corrections.map((correction, index) => (
              <View key={index} style={{
                marginBottom: index < feedback.corrections.length - 1 ? 12 : 0,
                paddingBottom: index < feedback.corrections.length - 1 ? 12 : 0,
                borderBottomWidth: index < feedback.corrections.length - 1 ? 1 : 0,
                borderBottomColor: '#2A2F3A',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ backgroundColor: '#E0E7FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6366F1', fontWeight: '600' }}>{correction.type}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, color: '#EF4444', textDecorationLine: 'line-through', marginBottom: 2 }}>
                  {correction.original}
                </Text>
                <Text style={{ fontSize: 15, color: '#22C55E', fontWeight: '600', marginBottom: 4 }}>
                  {correction.corrected}
                </Text>
                <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>{correction.explanation}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#2A2F3A' }}>
        {canRetry && (
          <Pressable
            onPress={onTryAgain}
            style={{
              flex: 1, backgroundColor: '#151921', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>Try Again</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onContinue}
          style={{
            flex: 1, backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
    </GradientBackground>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const normalizedScore = Math.min(1, score / 100);
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#CA8A04' : '#EF4444';

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, color: '#9CA3AF' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color }}>{score}/100</Text>
      </View>
      <ProgressBar progress={normalizedScore} />
    </View>
  );
}
