import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
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
import { spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';
import { ReaderDisplaySheet } from './ReaderDisplaySheet';
import { NarrationBar } from './NarrationBar';
import { SlabButton } from '../ui2/SlabButton';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { Body, Caption } from '../ui2/Ui2Text';
import { ReaderThemeScope } from './ReaderThemeScope';
import { DEFAULT_LINE_HEIGHT_MULTIPLIER } from './TappableText';
import { floatingTabBarSpace } from '../navigation/FloatingTabBar';
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

const CHARS_PER_PAGE_BASE = 1200; // at 16pt, normal spacing
/** ~200 words a minute at ~6 characters a word, spaces included. */
const CHARS_PER_MINUTE = 1200;

/**
 * The shell mounts the theme boundary ABOVE the body, because the body reads
 * `useUi2Theme()` at its own top level and a provider rendered inside it
 * would arrive one level too late for its own chrome.
 */
export function BookReader(props: Props) {
  return (
    <ReaderThemeScope>
      <BookReaderBody {...props} />
    </ReaderThemeScope>
  );
}

function BookReaderBody({
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
  const { c } = useUi2Theme();
  const { fontSize, lineHeightMultiplier, fontFamily } = useReadingPreferences();
  const [currentPage, setCurrentPage] = useState(0);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrator = usePageNarrator();
  const insets = useSafeAreaInsets();

  // Scale chars per page with the type: bigger or looser text packs fewer
  // paragraphs per screen.
  const charsPerPage = Math.round(
    CHARS_PER_PAGE_BASE * (16 / fontSize) * (DEFAULT_LINE_HEIGHT_MULTIPLIER / lineHeightMultiplier),
  );

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
  const progress = totalPages > 0 ? (currentPage + 1) / totalPages : 0;
  // Time left at a comfortable 200 words per minute, from the characters
  // still ahead. Rounded up so the last page never says "0 min".
  const minutesLeft = useMemo(() => {
    const remaining = pages.slice(currentPage + 1).reduce(
      (sum, page) => sum + page.paragraphs.reduce((n, p) => n + p.text.length, 0),
      0,
    );
    return Math.ceil(remaining / CHARS_PER_MINUTE);
  }, [pages, currentPage]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header: close, title and meta, display settings. Narration lives in
          its own bar above the pager now, where a thumb can reach it. */}
      <View style={{ paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={handleExit}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Exit reading"
        >
          <Ionicons name="close" size={24} color={c.muted} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: spacing.xxs }}>
          <Body weight="semibold" numberOfLines={1}>{book.title}</Body>
          <Caption
            tone="secondary"
            accessibilityLabel={`Page ${currentPage + 1} of ${totalPages}. About ${minutesLeft} minutes left`}
          >
            Page {currentPage + 1} of {totalPages}
            {minutesLeft > 0 ? ` · about ${minutesLeft} min left` : ''}
          </Caption>
        </View>
        <Pressable
          onPress={() => setDisplayOpen(true)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Display settings"
          accessibilityHint="Text size, spacing, font, brightness and night reading"
        >
          <Ionicons name="text-outline" size={22} color={c.primary} />
        </Pressable>
      </View>

      <Ui2ProgressBar
        progress={progress}
        height={3}
        accessibilityLabel="Progress through the book"
        style={{ marginHorizontal: spacing.md }}
      />

      {/* Page Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <TappableText
          paragraphs={currentPageParagraphs}
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
      </ScrollView>

      {isUnlimitedPlan && (
        <NarrationBar
          isPlaying={narrator.isPlaying}
          isPaused={narrator.isPaused}
          speed={narrator.speed}
          page={currentPage + 1}
          autoAdvance={autoAdvance}
          onPlayPause={handlePlayPause}
          onCycleSpeed={narrator.cycleSpeed}
          onToggleAutoAdvance={() => setAutoAdvance((v) => !v)}
        />
      )}

      {/* Pager — always visible at the bottom. */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm + insets.bottom + floatingTabBarSpace(),
        gap: spacing.sm,
        backgroundColor: c.bg,
      }}>
        <SlabButton
          label="Previous"
          variant="tint"
          arrow={false}
          disabled={currentPage === 0}
          onPress={() => goToPage(currentPage - 1)}
          style={{ flex: 1 }}
        />
        <SlabButton
          label={currentPage >= totalPages - 1 ? 'Finish' : 'Next'}
          variant="primary"
          arrow={currentPage < totalPages - 1}
          onPress={() => goToPage(currentPage + 1)}
          style={{ flex: 1 }}
        />
      </View>

      <ReaderDisplaySheet visible={displayOpen} onDismiss={() => setDisplayOpen(false)} />
    </SafeAreaView>
  );
}

/** Stable empty array so an out-of-range page does not remount TappableText. */
const EMPTY_PARAGRAPHS: Paragraph[] = [];
