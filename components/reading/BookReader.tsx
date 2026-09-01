import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePageNarrator } from '../../hooks/usePageNarrator';
import { ReadingHelp } from './ReadingHelp';
import { TappableText, type SelectedRef } from './TappableText';
import type { ExplanationState } from '../../hooks/useWordLookup';
import type { WordLookupState } from './WordTooltip';
import {
  pageForOffset,
  paginateParagraphs,
  splitParagraphs,
  type Paragraph,
} from '../../lib/reading-text';
import { colors, radii, spacing } from '../../config/theme';
import type { ReadingBook, ReviewItem } from '../../types';

interface Props {
  book: ReadingBook;
  /** The book's text. Fetched separately from its metadata — `content`
   *  averages 211 kB and reaches 1.8 MB, so the cover screen does not wait
   *  on it. */
  content: string;
  initialPosition: number;
  isUnlimitedPlan?: boolean;
  onPositionChange: (position: number, percent: number) => void;
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
  onComplete: () => void;
  onExit: () => void;
}

const FONT_SIZES = [14, 16, 18, 20, 22];
const CHARS_PER_PAGE_BASE = 1200; // at default font size

export function BookReader({
  book,
  content,
  initialPosition,
  isUnlimitedPlan = false,
  onPositionChange,
  selectedRef,
  lookup,
  explanation,
  onWordPress,
  onExplain,
  onRetryLookup,
  onDismissHelp,
  onAddToReview,
  onUpgrade,
  onComplete,
  onExit,
}: Props) {
  const [fontSizeIndex, setFontSizeIndex] = useState(1); // default 16px
  const [currentPage, setCurrentPage] = useState(0);
  const [showFontControls, setShowFontControls] = useState(false);
  const [autoAdvance] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrator = usePageNarrator();
  const insets = useSafeAreaInsets();

  const fontSize = FONT_SIZES[fontSizeIndex];

  // Scale chars per page based on font size
  const charsPerPage = Math.round(CHARS_PER_PAGE_BASE * (16 / fontSize));

  // Paragraphs are computed ONCE for the book and do not depend on font size.
  // That is what gives a paragraph a stable identity, which the shared
  // explanation cache is keyed on — the old character slicing moved every
  // boundary when the learner changed the font size, so the same paragraph
  // hashed differently at 14pt and at 20pt and the cache would never hit.
  const paragraphs = useMemo(() => splitParagraphs(content), [content]);

  // Pages are runs of whole paragraphs. Only the packing depends on font size.
  const pages = useMemo(
    () => paginateParagraphs(paragraphs, charsPerPage),
    [paragraphs, charsPerPage],
  );

  const totalPages = pages.length;

  // Set initial page from the saved character offset. Resolved by lookup
  // rather than by dividing — page boundaries are no longer a fixed width, and
  // an offset that no longer exists lands on the last page rather than a blank
  // screen.
  useEffect(() => {
    if (initialPosition > 0 && pages.length > 0) {
      setCurrentPage(pageForOffset(pages, initialPosition));
    }
  }, [initialPosition, pages]);

  // Debounced position save. The saved value is the offset of the page's first
  // paragraph, so it stays comparable with what was stored before this change
  // and survives a font-size change — which used to move the reader.
  const savePosition = useCallback((page: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const position = pages[page]?.offset ?? 0;
      const percent = Math.min(100, ((page + 1) / totalPages) * 100);
      onPositionChange(position, percent);
    }, 500);
  }, [pages, totalPages, onPositionChange]);

  const goToPage = useCallback((page: number) => {
    narrator.stop();
    const newPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(newPage);
    onDismissHelp();
    savePosition(newPage);

    // Check completion
    if (newPage === totalPages - 1) {
      onComplete();
    }
  }, [totalPages, savePosition, onComplete, narrator, onDismissHelp]);

  const currentPageParagraphs = pages[currentPage]?.paragraphs ?? EMPTY_PARAGRAPHS;
  // Narration reads the page aloud, so it wants the text, not the structure.
  const currentPageText = useMemo(
    () => currentPageParagraphs.map((p) => p.text).join('\n\n'),
    [currentPageParagraphs],
  );
  const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  // Track whether we should auto-play the next page after navigation
  const shouldAutoPlayRef = useRef(false);

  const handlePlayPause = useCallback(() => {
    if (narrator.isPlaying && !narrator.isPaused) {
      narrator.pause();
    } else if (narrator.isPaused) {
      narrator.resume();
    } else {
      narrator.speak(currentPageText, book.language, () => {
        // When narration finishes, auto-advance and continue playing
        if (autoAdvance && currentPage < totalPages - 1) {
          shouldAutoPlayRef.current = true;
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          onDismissHelp();
          savePosition(nextPage);
          if (nextPage === totalPages - 1) {
            onComplete();
          }
        }
      });
    }
  }, [narrator, currentPageText, book.language, autoAdvance, currentPage, totalPages, savePosition, onComplete, onDismissHelp]);

  // Auto-play after page change from narration auto-advance
  useEffect(() => {
    if (shouldAutoPlayRef.current && pages[currentPage]) {
      shouldAutoPlayRef.current = false;
      narrator.speak(currentPageText, book.language, () => {
        if (autoAdvance && currentPage < totalPages - 1) {
          shouldAutoPlayRef.current = true;
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          onDismissHelp();
          savePosition(nextPage);
          if (nextPage === totalPages - 1) {
            onComplete();
          }
        }
      });
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = useCallback(() => {
    narrator.stop();
    onExit();
  }, [narrator, onExit]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.raised }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={handleExit} style={{ padding: spacing.xs }} accessibilityRole="button" accessibilityLabel="Exit reading">
          <Ionicons name="close" size={24} color={colors.text.secondary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.xs }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
            Page {currentPage + 1} of {totalPages}
          </Text>
        </View>
        {isUnlimitedPlan && (
          <>
            <Pressable
              onPress={narrator.cycleSpeed}
              style={{ paddingHorizontal: 6, paddingVertical: spacing.xxs, marginRight: spacing.xxs }}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${narrator.speed}x`}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.indigo[400] }}>{narrator.speed}x</Text>
            </Pressable>
            <Pressable
              onPress={handlePlayPause}
              style={{ padding: spacing.xs }}
              accessibilityRole="button"
              accessibilityLabel={narrator.isPlaying && !narrator.isPaused ? 'Pause narration' : 'Play narration'}
            >
              <Ionicons
                name={narrator.isPlaying && !narrator.isPaused ? 'pause-circle' : 'play-circle'}
                size={28}
                color={colors.indigo[400]}
              />
            </Pressable>
          </>
        )}
        <Pressable
          onPress={() => setShowFontControls(!showFontControls)}
          style={{ padding: spacing.xs }}
          accessibilityRole="button"
          accessibilityLabel="Font size"
        >
          <Ionicons name="text" size={20} color={colors.indigo[400]} />
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={{ height: 3, backgroundColor: colors.surface.cardAlt, marginHorizontal: spacing.md }}>
        <View style={{ height: 3, backgroundColor: colors.action.primaryFill, width: `${progressPercent}%` }} />
      </View>

      {/* Font Size Controls */}
      {showFontControls && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm }}>
          <Pressable
            onPress={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
            disabled={fontSizeIndex === 0}
            style={{ padding: spacing.xs, opacity: fontSizeIndex === 0 ? 0.3 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Decrease font size"
          >
            <Text style={{ fontSize: 14, color: colors.indigo[400], fontWeight: '600' }}>A-</Text>
          </Pressable>
          <Text style={{ fontSize: 14, color: colors.text.secondary }}>{fontSize}px</Text>
          <Pressable
            onPress={() => setFontSizeIndex(Math.min(FONT_SIZES.length - 1, fontSizeIndex + 1))}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            style={{ padding: spacing.xs, opacity: fontSizeIndex === FONT_SIZES.length - 1 ? 0.3 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Increase font size"
          >
            <Text style={{ fontSize: 18, color: colors.indigo[400], fontWeight: '600' }}>A+</Text>
          </Pressable>
        </View>
      )}

      {/* Page Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <TappableText
          paragraphs={currentPageParagraphs}
          fontSize={fontSize}
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
      </ScrollView>

      {/* Page Navigation — always visible at bottom */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm + insets.bottom + 60, gap: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.default, backgroundColor: colors.surface.raised,
      }}>
        <Pressable
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: radii.lg, alignItems: 'center',
            backgroundColor: currentPage === 0 ? colors.surface.cardAlt : colors.surface.card,
          }}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: currentPage === 0 ? colors.text.tertiary : colors.text.primary }}>
            Previous
          </Text>
        </Pressable>
        <Pressable
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: radii.lg, alignItems: 'center',
            backgroundColor: currentPage >= totalPages - 1 ? colors.indigo[200] : colors.action.primaryFill,
          }}
          accessibilityRole="button"
          accessibilityLabel="Next page"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.onPrimary }}>
            {currentPage >= totalPages - 1 ? 'Finish' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Stable empty array so an out-of-range page does not remount TappableText. */
const EMPTY_PARAGRAPHS: Paragraph[] = [];
