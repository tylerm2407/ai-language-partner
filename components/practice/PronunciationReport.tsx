import { View, Text, Pressable } from 'react-native';
import type { PronunciationResult, WordScore } from '../../types';

function getWordColor(confidence: number): string {
  if (confidence >= 0.8) return '#22C55E'; // green
  if (confidence >= 0.7) return '#F59E0B'; // yellow/amber
  return '#EF4444'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Needs Work';
  return 'Keep Practicing';
}

interface PronunciationReportProps {
  result: PronunciationResult;
  onWordPress?: (word: WordScore) => void;
  onPracticeAgain?: () => void;
}

export function PronunciationReport({
  result,
  onWordPress,
  onPracticeAgain,
}: PronunciationReportProps) {
  const flaggedWords = result.wordScores.filter((w) => w.flagged);

  return (
    <View style={{ gap: 20 }}>
      {/* Overall Score Circle */}
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            borderWidth: 6,
            borderColor: getWordColor(result.overallScore / 100),
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827' }}>
            {result.overallScore}%
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 8 }}>
          {getScoreLabel(result.overallScore)}
        </Text>
      </View>

      {/* Word-by-Word Scores */}
      <View>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Word Scores</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {result.wordScores.map((ws, i) => (
            <Pressable
              key={`${ws.word}-${i}`}
              onPress={() => onWordPress?.(ws)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: getWordColor(ws.confidence) + '18',
                borderWidth: 1,
                borderColor: getWordColor(ws.confidence) + '40',
              }}
              accessibilityLabel={`${ws.word}: ${Math.round(ws.confidence * 100)}% confidence`}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: ws.flagged ? '700' : '500',
                  color: getWordColor(ws.confidence),
                }}
              >
                {ws.word}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Flagged Words */}
      {flaggedWords.length > 0 && (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Words to Practice
          </Text>
          {flaggedWords.map((ws, i) => (
            <View
              key={`flag-${i}`}
              style={{
                backgroundColor: '#FEF2F2',
                padding: 12,
                borderRadius: 10,
                marginBottom: 6,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>{ws.word}</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                {Math.round(ws.confidence * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Feedback */}
      {result.feedback && (
        <View style={{ backgroundColor: '#F0F9FF', padding: 14, borderRadius: 12 }}>
          <Text style={{ fontSize: 14, color: '#0369A1', lineHeight: 20 }}>{result.feedback}</Text>
        </View>
      )}

      {/* Practice Again */}
      {onPracticeAgain && (
        <Pressable
          onPress={onPracticeAgain}
          style={{
            backgroundColor: '#6366F1',
            padding: 16,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Practice Again</Text>
        </Pressable>
      )}
    </View>
  );
}
