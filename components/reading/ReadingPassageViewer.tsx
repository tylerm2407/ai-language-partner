import { useCallback, type ReactElement } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { WordTooltip } from './WordTooltip';
import type { ReadingPassage, ReadingAnnotation, ReviewItem } from '../../types';
import { colors } from '../../config/theme';

interface Props {
  passage: ReadingPassage;
  annotations: ReadingAnnotation[];
  selectedAnnotation: ReadingAnnotation | null;
  onSelectWord: (annotation: ReadingAnnotation) => void;
  onDismissTooltip: () => void;
  onAddToReview: (annotation: ReadingAnnotation) => Promise<ReviewItem | null>;
  onContinue: () => void;
  onExit: () => void;
}

export function ReadingPassageViewer({
  passage,
  annotations,
  selectedAnnotation,
  onSelectWord,
  onDismissTooltip,
  onAddToReview,
  onContinue,
  onExit,
}: Props) {
  const renderAnnotatedText = useCallback(() => {
    const { content } = passage;
    if (annotations.length === 0) {
      return <Text style={{ fontSize: 16, lineHeight: 26, color: colors.text.primary }}>{content}</Text>;
    }

    const segments: ReactElement[] = [];
    let lastIndex = 0;

    // Sort annotations by start_index
    const sorted = [...annotations].sort((a, b) => a.startIndex - b.startIndex);

    sorted.forEach((annotation, i) => {
      // Plain text before this annotation
      if (annotation.startIndex > lastIndex) {
        segments.push(
          <Text key={`plain-${i}`} style={{ fontSize: 16, lineHeight: 26, color: colors.text.primary }}>
            {content.slice(lastIndex, annotation.startIndex)}
          </Text>
        );
      }

      // Annotated word
      const isSelected = selectedAnnotation?.id === annotation.id;
      segments.push(
        <Text
          key={`ann-${annotation.id}`}
          onPress={() => onSelectWord(annotation)}
          style={{
            fontSize: 16,
            lineHeight: 26,
            // Unselected annotated words are body copy on a dark card. This was
            // `#111` — a leftover from when the reading surface was a light
            // island, and near-black on `surface.card` is invisible.
            color: isSelected ? colors.action.primaryFill : colors.text.primary,
            textDecorationLine: 'underline',
            textDecorationColor: 'rgba(242, 244, 246, 0.3)',
            fontWeight: isSelected ? '600' : '400',
          }}
          accessibilityRole="button"
          accessibilityLabel={`Tap to translate: ${annotation.wordOrPhrase}`}
        >
          {content.slice(annotation.startIndex, annotation.endIndex)}
        </Text>
      );

      lastIndex = annotation.endIndex;
    });

    // Remaining plain text
    if (lastIndex < content.length) {
      segments.push(
        <Text key="plain-end" style={{ fontSize: 16, lineHeight: 26, color: colors.text.primary }}>
          {content.slice(lastIndex)}
        </Text>
      );
    }

    return <Text>{segments}</Text>;
  }, [passage, annotations, selectedAnnotation, onSelectWord]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.raised }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onExit} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Exit reading">
          <Text style={{ fontSize: 24, color: colors.text.tertiary }}>x</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          {/* Pre-existing: this carried no color at all, so it rendered in RN's
              default black on the dark header. */}
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary }} numberOfLines={1}>{passage.title}</Text>
          <Text style={{ fontSize: 13, color: colors.text.tertiary }}>{passage.wordCount} words | {passage.cefrLevel}</Text>
        </View>
        {passage.audioUrl && (
          <AudioPlayButton audioUrl={passage.audioUrl} size={40} />
        )}
      </View>

      {/* Passage Content */}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onDismissTooltip} style={{ minHeight: 200 }}>
          <View style={{
            backgroundColor: colors.surface.card,
            borderRadius: 16,
            padding: 20,
          }}>
            {renderAnnotatedText()}
          </View>
        </Pressable>

        {/* Tooltip */}
        {selectedAnnotation && (
          <WordTooltip
            annotation={selectedAnnotation}
            onAddToReview={() => onAddToReview(selectedAnnotation)}
            onDismiss={onDismissTooltip}
          />
        )}

        {/* Source Attribution */}
        {passage.sourceAttribution && (
          <Text style={{ fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic', marginTop: 12 }}>
            Source: {passage.sourceAttribution}
          </Text>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 20, backgroundColor: colors.surface.raised,
        borderTopWidth: 1, borderTopColor: colors.border.default,
      }}>
        <Pressable
          onPress={onContinue}
          style={{
            backgroundColor: '#F2F4F6', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue to questions"
        >
          <Text style={{ color: '#08090A', fontSize: 18, fontWeight: '600' }}>Continue to Questions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
