import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { trackEvent } from '../../lib/analytics';
import type { TranscriptEntry, VoiceCorrection, VocabItem } from '../../types';

interface ConversationReviewProps {
  durationSeconds: number;
  xpEarned: number;
  transcript: TranscriptEntry[];
  corrections: VoiceCorrection[];
  vocabulary: VocabItem[];
  onAddToFlashcards?: (vocab: VocabItem) => void;
  onPracticeAgain?: () => void;
  onGoBack?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function ConversationReview({
  durationSeconds,
  xpEarned,
  transcript,
  corrections,
  vocabulary,
  onAddToFlashcards,
  onPracticeAgain,
  onGoBack,
}: ConversationReviewProps) {
  const handleAddVocab = (vocab: VocabItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackEvent('vocab_added_to_srs', { word: vocab.word });
    onAddToFlashcards?.(vocab);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Header Stats */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700' }} accessibilityRole="header">
          Session Complete
        </Text>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#6366F1' }}>
              {formatDuration(durationSeconds)}
            </Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Duration</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#F59E0B' }}>{xpEarned}</Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>XP Earned</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#22C55E' }}>
              {vocabulary.length}
            </Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>New Words</Text>
          </View>
        </View>
      </View>

      {/* Transcript */}
      {transcript.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Transcript</Text>
          {transcript.map((entry) => (
            <View
              key={entry.id}
              style={{
                backgroundColor: entry.speaker === 'user' ? '#EEF2FF' : '#F3F4F6',
                padding: 12,
                borderRadius: 12,
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: '600' }}>
                {entry.speaker === 'user' ? 'You' : 'AI Tutor'}
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#111827' }}>{entry.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Corrections</Text>
          {corrections.map((c, i) => (
            <View
              key={`c-${i}`}
              style={{
                backgroundColor: '#FEF2F2',
                padding: 14,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: '#DC2626',
                  textDecorationLine: 'line-through',
                }}
              >
                {c.original}
              </Text>
              <Text style={{ fontSize: 15, color: '#16A34A', fontWeight: '600', marginTop: 4 }}>
                {c.corrected}
              </Text>
              {c.explanation && (
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>
                  {c.explanation}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Vocabulary */}
      {vocabulary.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>New Vocabulary</Text>
          {vocabulary.map((v, i) => (
            <View
              key={`v-${i}`}
              style={{
                backgroundColor: '#F0FDF4',
                padding: 14,
                borderRadius: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{v.word}</Text>
                <Text style={{ fontSize: 14, color: '#6B7280' }}>{v.translation}</Text>
                {v.context && (
                  <Text
                    style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 }}
                  >
                    "{v.context}"
                  </Text>
                )}
              </View>
              {onAddToFlashcards && (
                <Pressable
                  onPress={() => handleAddVocab(v)}
                  style={{
                    backgroundColor: '#22C55E',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${v.word} to flashcards`}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>+ SRS</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        {onGoBack && (
          <Pressable
            onPress={onGoBack}
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>Back</Text>
          </Pressable>
        )}
        {onPracticeAgain && (
          <Pressable
            onPress={onPracticeAgain}
            style={{
              flex: 1,
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
    </ScrollView>
  );
}
