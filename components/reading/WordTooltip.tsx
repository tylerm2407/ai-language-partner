import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import type { ReadingAnnotation, ReviewItem } from '../../types';
import { colors } from '../../config/theme';

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
      backgroundColor: colors.surface.card,
      borderRadius: 14,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border.default,
    }}>
      {/* Word & Translation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary }}>
            {annotation.wordOrPhrase}
          </Text>
          <Text style={{ fontSize: 16, color: colors.text.tertiary, marginTop: 2 }}>
            {annotation.translation}
          </Text>
          {annotation.partOfSpeech && (
            <Text style={{ fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic', marginTop: 2 }}>
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
            backgroundColor: '#C8A24A',
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Add to review queue"
        >
          <Text style={{ color: '#14120E', fontSize: 14, fontWeight: '600' }}>Add to Review</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{
            flex: 1,
            backgroundColor: colors.surface.cardAlt,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
