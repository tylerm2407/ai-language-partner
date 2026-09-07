import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { ReadingHelp } from './ReadingHelp';
import { TappableText, type SelectedRef } from './TappableText';
import type { ExplanationState } from '../../hooks/useWordLookup';
import type { WordLookupState } from './WordTooltip';
import { splitParagraphs, type Paragraph } from '../../lib/reading-text';
import type { ReadingPassage, ReviewItem } from '../../types';
import { cefrCanDo, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';

const PASSAGE_FONT_SIZE = 16;

interface Props {
  passage: ReadingPassage;
  /** Word-lookup and explanation state, from useWordLookup. */
  selectedRef: SelectedRef | null;
  lookup: WordLookupState | null;
  explanation: ExplanationState | null;
  onWordPress: (raw: string, ref: SelectedRef) => void;
  onExplain: (paragraph: Paragraph) => void;
  onRetryLookup: () => void;
  onDismissHelp: () => void;
  onAddToReview: () => Promise<ReviewItem | null>;
  onUpgrade?: () => void;
  onContinue: () => void;
  onExit: () => void;
}

export function ReadingPassageViewer({
  passage,
  selectedRef,
  lookup,
  explanation,
  onWordPress,
  onExplain,
  onRetryLookup,
  onDismissHelp,
  onAddToReview,
  onUpgrade,
  onContinue,
  onExit,
}: Props) {
  const { c } = useUi2Theme();

  // A passage is short enough to render in one scroll, so it needs paragraphs
  // but not pagination. Splitting still matters: it is what gives a span the
  // stable identity the shared explanation cache is keyed on.
  const paragraphs = useMemo(() => splitParagraphs(passage.content), [passage.content]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onExit} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Exit reading">
          <Text style={{ fontSize: 24, color: c.muted }}>x</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          {/* Pre-existing: this carried no color at all, so it rendered in RN's
              default black on the dark header. */}
          <Text style={{ fontSize: 18, fontWeight: '600', color: c.ink }} numberOfLines={1}>{passage.title}</Text>
          {/* The meta line used to end at "| B1" and stop. The code stays — it is
              what the library and the badges are keyed on — but the line under it
              is what tells the reader why this passage is the right one. */}
          <Text
            style={{ fontSize: 13, color: c.muted }}
            accessibilityLabel={`${passage.wordCount} words. ${cefrAccessibilityLabel(passage.cefrLevel)}`}
          >
            {passage.wordCount} words {'·'} {passage.cefrLevel}
          </Text>
          {cefrCanDo(passage.cefrLevel) ? (
            <Text
              style={{ fontSize: 12, color: c.muted, marginTop: 2 }}
              numberOfLines={2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {cefrCanDo(passage.cefrLevel)}
            </Text>
          ) : null}
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
        <View style={{
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.cardBorder,
          borderRadius: 16,
          padding: 20,
          minHeight: 200,
        }}>
          <TappableText
            paragraphs={paragraphs}
            fontSize={PASSAGE_FONT_SIZE}
            selectedRef={selectedRef}
            onWordPress={onWordPress}
            onExplain={onExplain}
          />
        </View>

        <ReadingHelp
          lookup={lookup}
          explanation={explanation}
          onAddToReview={onAddToReview}
          onRetryLookup={onRetryLookup}
          onDismiss={onDismissHelp}
          onUpgrade={onUpgrade}
        />

        {/* Source Attribution */}
        {passage.sourceAttribution && (
          <Text style={{ fontSize: 12, color: c.muted, fontStyle: 'italic', marginTop: 12 }}>
            Source: {passage.sourceAttribution}
          </Text>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 20, backgroundColor: c.bg,
        borderTopWidth: 1, borderTopColor: c.cardBorder,
      }}>
        <Pressable
          onPress={onContinue}
          style={{
            backgroundColor: c.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue to questions"
        >
          <Text style={{ color: c.onPrimary, fontSize: 18, fontWeight: '600' }}>Continue to Questions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
