import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../ui/ProgressBar';
import type { WritingFeedback } from '../../types';

interface Props {
  feedback: WritingFeedback;
  onTryAgain: () => void;
  onContinue: () => void;
}

export function WritingFeedbackView({ feedback, onTryAgain, onContinue }: Props) {
  const overallScore = Math.round(
    (feedback.grammarScore + feedback.vocabularyScore + feedback.coherenceScore) / 3
  );
  const scoreColor = overallScore >= 80 ? '#22C55E' : overallScore >= 60 ? '#CA8A04' : '#EF4444';
  const scoreBg = overallScore >= 80 ? '#DCFCE7' : overallScore >= 60 ? '#FEF9C3' : '#FEE2E2';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center' }} accessibilityRole="header">
          Writing Feedback
        </Text>

        {/* Overall Score Circle */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: scoreColor }}>{overallScore}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8 }}>Overall Score</Text>
        </View>

        {/* Category Scores */}
        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <ScoreRow label="Grammar" score={feedback.grammarScore} />
          <ScoreRow label="Vocabulary" score={feedback.vocabularyScore} />
          <ScoreRow label="Coherence" score={feedback.coherenceScore} />
        </View>

        {/* Overall Feedback */}
        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Feedback</Text>
          <Text style={{ fontSize: 15, color: '#666', lineHeight: 22 }}>{feedback.overallFeedback}</Text>
        </View>

        {/* Corrections */}
        {feedback.corrections.length > 0 && (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              Corrections ({feedback.corrections.length})
            </Text>
            {feedback.corrections.map((correction, index) => (
              <View key={index} style={{
                marginBottom: index < feedback.corrections.length - 1 ? 12 : 0,
                paddingBottom: index < feedback.corrections.length - 1 ? 12 : 0,
                borderBottomWidth: index < feedback.corrections.length - 1 ? 1 : 0,
                borderBottomColor: '#E5E7EB',
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
                <Text style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>{correction.explanation}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
        <Pressable
          onPress={onTryAgain}
          style={{
            flex: 1, backgroundColor: '#F9FAFB', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111' }}>Try Again</Text>
        </Pressable>
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
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const normalizedScore = Math.min(1, score / 100);
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#CA8A04' : '#EF4444';

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, color: '#666' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color }}>{score}/100</Text>
      </View>
      <ProgressBar progress={normalizedScore} color={color} />
    </View>
  );
}
