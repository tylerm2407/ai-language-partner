import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SlabButton } from '../ui2/SlabButton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { ReaderDisplaySheet } from './ReaderDisplaySheet';
import { ReaderThemeScope } from './ReaderThemeScope';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';
import { spacing } from '../../config/theme';
import { ReadingHelp } from './ReadingHelp';
import { TappableText, type SelectedRef } from './TappableText';
import type { ExplanationState } from '../../hooks/useWordLookup';
import type { WordLookupState } from './WordTooltip';
import { splitParagraphs, type Paragraph } from '../../lib/reading-text';
import type { ReadingPassage, ReviewItem } from '../../types';
import { cefrCanDo, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { isSegmentedLanguage } from '../../lib/writing-length';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * "67 words" / "286 word segments" — never a Japanese or Chinese count called
 * words. Those two languages are written without spaces, so `word_count` holds
 * dictionary word-like segments (Intl.Segmenter) rather than whitespace words;
 * the writing surface already names that unit the same way
 * (components/writing/WritingExercise.tsx).
 */
function passageLengthLabel(count: number, language: string | null | undefined): string {
  const noun = isSegmentedLanguage(language) ? 'word segment' : 'word';
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

interface Props {
  passage: ReadingPassage;
  /** Course language of the passage. Decides whether `wordCount` is named
   * words or (ja/zh) word segments; omitted means words. */
  language?: string | null;
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

/** Theme boundary above the body — see BookReader for why. */
export function ReadingPassageViewer(props: Props) {
  return (
    <ReaderThemeScope>
      <ReadingPassageViewerBody {...props} />
    </ReaderThemeScope>
  );
}

function ReadingPassageViewerBody({
  passage,
  language,
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
  const { fontSize, lineHeightMultiplier, fontFamily } = useReadingPreferences();
  const insets = useSafeAreaInsets();
  const [displayOpen, setDisplayOpen] = useState(false);
  // The fixed footer covers this much of the scroll. No tab-bar reservation:
  // the bar is hidden while this surface is mounted (immersive flag).
  const footerHeight = spacing.lg * 2 + 56 + insets.bottom;

  // A passage is short enough to render in one scroll, so it needs paragraphs
  // but not pagination. Splitting still matters: it is what gives a span the
  // stable identity the shared explanation cache is keyed on.
  const paragraphs = useMemo(() => splitParagraphs(passage.content), [passage.content]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={onExit}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Exit reading"
        >
          <Ionicons name="close" size={24} color={c.muted} />
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
            accessibilityLabel={`${passageLengthLabel(passage.wordCount, language)}. ${cefrAccessibilityLabel(passage.cefrLevel)}`}
          >
            {passageLengthLabel(passage.wordCount, language)} {'·'} {passage.cefrLevel}
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
        <Pressable
          onPress={() => setDisplayOpen(true)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xxs }}
          accessibilityRole="button"
          accessibilityLabel="Display settings"
          accessibilityHint="Text size, spacing, font and night reading"
        >
          <Ionicons name="text-outline" size={22} color={c.primary} />
        </Pressable>
      </View>

      {/* Passage Content */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: footerHeight }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full-bleed on the ground, the same surface as a book page. The old
            card-in-a-card made a passage look like a form field. */}
        <TappableText
          paragraphs={paragraphs}
          fontSize={fontSize}
          lineHeightMultiplier={lineHeightMultiplier}
          fontFamily={fontFamily}
          selectedRef={selectedRef}
          onWordPress={onWordPress}
          onExplain={onExplain}
        />

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
        padding: 20, paddingBottom: 20 + insets.bottom, backgroundColor: c.bg,
      }}>
        <SlabButton
          label="Continue to Questions"
          onPress={onContinue}
          accessibilityHint="Opens the comprehension questions for this passage"
        />
      </View>

      <ReaderDisplaySheet visible={displayOpen} onDismiss={() => setDisplayOpen(false)} />
    </SafeAreaView>
  );
}
