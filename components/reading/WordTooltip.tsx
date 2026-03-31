import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import type { ReadingAnnotation, ReviewItem } from '../../types';

interface Props {
  annotation: ReadingAnnotation;
  onAddToReview: () => Promise<ReviewItem | null>;
  onDismiss: () => void;
}

export function WordTooltip({ annotation, onAddToReview, onDismiss }: Props) {
  const handleAddToReview = async () => {
    const result = await onAddToReview();
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onDismiss();
  };

  return (
    <View style={{
      backgroundColor: '#F9FAFB',
      borderRadius: 14,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    }}>
      {/* Word & Translation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111' }}>
            {annotation.wordOrPhrase}
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginTop: 2 }}>
            {annotation.translation}
          </Text>
          {annotation.partOfSpeech && (
            <Text style={{ fontSize: 13, color: '#999', fontStyle: 'italic', marginTop: 2 }}>
              {annotation.partOfSpeech}
            </Text>
          )}
        </View>
        {annotation.audioUrl && (
          <AudioPlayButton audioUrl={annotation.audioUrl} size={44} />
        )}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={handleAddToReview}
          style={{
            flex: 1,
            backgroundColor: '#6366F1',
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Add to review queue"
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add to Review</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{
            flex: 1,
            backgroundColor: '#F3F4F6',
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: '#666', fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
