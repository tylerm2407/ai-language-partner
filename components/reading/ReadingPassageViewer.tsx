import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { WordTooltip } from './WordTooltip';
import type { ReadingPassage, ReadingAnnotation, ReviewItem } from '../../types';

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
      return <Text style={{ fontSize: 16, lineHeight: 26, color: '#111' }}>{content}</Text>;
    }

    const segments: JSX.Element[] = [];
    let lastIndex = 0;

    // Sort annotations by start_index
    const sorted = [...annotations].sort((a, b) => a.startIndex - b.startIndex);

    sorted.forEach((annotation, i) => {
      // Plain text before this annotation
      if (annotation.startIndex > lastIndex) {
        segments.push(
          <Text key={`plain-${i}`} style={{ fontSize: 16, lineHeight: 26, color: '#111' }}>
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
            color: isSelected ? '#6366F1' : '#111',
            textDecorationLine: 'underline',
            textDecorationColor: 'rgba(99, 102, 241, 0.3)',
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
        <Text key="plain-end" style={{ fontSize: 16, lineHeight: 26, color: '#111' }}>
          {content.slice(lastIndex)}
        </Text>
      );
    }

    return <Text>{segments}</Text>;
  }, [passage, annotations, selectedAnnotation, onSelectWord]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onExit} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Exit reading">
          <Text style={{ fontSize: 24, color: '#666' }}>x</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }} numberOfLines={1}>{passage.title}</Text>
          <Text style={{ fontSize: 13, color: '#999' }}>{passage.wordCount} words | {passage.cefrLevel}</Text>
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
            backgroundColor: '#F9FAFB',
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
          <Text style={{ fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 12 }}>
            Source: {passage.sourceAttribution}
          </Text>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 20, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#E5E7EB',
      }}>
        <Pressable
          onPress={onContinue}
          style={{
            backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue to questions"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue to Questions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
