import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePageNarrator } from '../../hooks/usePageNarrator';
import { colors, radii, spacing } from '../../config/theme';
import type { ReadingBook, BookAnnotation, ReviewItem } from '../../types';

interface Props {
  book: ReadingBook;
  annotations: BookAnnotation[];
  initialPosition: number;
  isUnlimitedPlan?: boolean;
  onPositionChange: (position: number, percent: number) => void;
  onWordLookup: () => void;
  onAddToReview: (annotation: BookAnnotation) => Promise<ReviewItem | null>;
  onComplete: () => void;
  onExit: () => void;
}

const FONT_SIZES = [14, 16, 18, 20, 22];
const CHARS_PER_PAGE_BASE = 1200; // at default font size

export function BookReader({
  book,
  annotations,
  initialPosition,
  isUnlimitedPlan = false,
  onPositionChange,
  onWordLookup,
  onAddToReview,
  onComplete,
  onExit,
}: Props) {
  const [fontSizeIndex, setFontSizeIndex] = useState(1); // default 16px
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<BookAnnotation | null>(null);
  const [showFontControls, setShowFontControls] = useState(false);
  const [autoAdvance] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrator = usePageNarrator();
  const insets = useSafeAreaInsets();

  const fontSize = FONT_SIZES[fontSizeIndex];

  // Scale chars per page based on font size
  const charsPerPage = Math.round(CHARS_PER_PAGE_BASE * (16 / fontSize));

  // Split content into pages
  const pages = useMemo(() => {
    const content = book.content;
    const result: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = start + charsPerPage;

      // Don't cut words — find the last space before the limit
      if (end < content.length) {
        const lastSpace = content.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace + 1;
        }
      } else {
        end = content.length;
      }

      result.push(content.slice(start, end));
      start = end;
    }

    return result;
  }, [book.content, charsPerPage]);

  const totalPages = pages.length;

  // Set initial page from saved position
  useEffect(() => {
    if (initialPosition > 0 && book.content.length > 0) {
      const page = Math.floor(initialPosition / charsPerPage);
      setCurrentPage(Math.min(page, totalPages - 1));
    }
  }, [initialPosition, charsPerPage, totalPages, book.content.length]);

  // Debounced position save
  const savePosition = useCallback((page: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const position = page * charsPerPage;
      const percent = Math.min(100, ((page + 1) / totalPages) * 100);
      onPositionChange(position, percent);
    }, 500);
  }, [charsPerPage, totalPages, onPositionChange]);

  const goToPage = useCallback((page: number) => {
    narrator.stop();
    const newPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(newPage);
    setSelectedAnnotation(null);
    savePosition(newPage);

    // Check completion
    if (newPage === totalPages - 1) {
      onComplete();
    }
  }, [totalPages, savePosition, onComplete, narrator]);

  // Build annotation lookup for current page text
  const annotationMap = useMemo(() => {
    const map = new Map<string, BookAnnotation>();
    for (const ann of annotations) {
      map.set(ann.wordOrPhrase.toLowerCase(), ann);
    }
    return map;
  }, [annotations]);

  const handleWordPress = useCallback((phrase: string) => {
    const cleaned = phrase.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
    const ann = annotationMap.get(cleaned);
    if (ann) {
      setSelectedAnnotation(ann);
      onWordLookup();
    }
  }, [annotationMap, onWordLookup]);

  const handleAddToReview = useCallback(async (ann: BookAnnotation) => {
    // Adapt BookAnnotation to the ReadingAnnotation-like shape expected by WordTooltip
    return onAddToReview(ann);
  }, [onAddToReview]);

  const currentPageText = pages[currentPage] ?? '';
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
          setSelectedAnnotation(null);
          savePosition(nextPage);
          if (nextPage === totalPages - 1) {
            onComplete();
          }
        }
      });
    }
  }, [narrator, currentPageText, book.language, autoAdvance, currentPage, totalPages, savePosition, onComplete]);

  // Auto-play after page change from narration auto-advance
  useEffect(() => {
    if (shouldAutoPlayRef.current && pages[currentPage]) {
      shouldAutoPlayRef.current = false;
      narrator.speak(pages[currentPage], book.language, () => {
        if (autoAdvance && currentPage < totalPages - 1) {
          shouldAutoPlayRef.current = true;
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          setSelectedAnnotation(null);
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
        <Pressable onPress={() => setSelectedAnnotation(null)}>
          <Text style={{ fontSize, lineHeight: fontSize * 1.7, color: colors.text.primary }}>
            {renderAnnotatedWords(currentPageText, annotationMap, selectedAnnotation, handleWordPress, fontSize)}
          </Text>
        </Pressable>

        {/* Word Tooltip */}
        {selectedAnnotation && (
          <View style={{ marginTop: 12 }}>
            <BookWordTooltip
              annotation={selectedAnnotation}
              onAddToReview={() => handleAddToReview(selectedAnnotation)}
              onDismiss={() => setSelectedAnnotation(null)}
            />
          </View>
        )}
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

// Render words with tap-to-translate for annotated words and phrases
function renderAnnotatedWords(
  text: string,
  annotationMap: Map<string, BookAnnotation>,
  selectedAnnotation: BookAnnotation | null,
  onPress: (phrase: string) => void,
  fontSize: number,
): React.JSX.Element[] {
  const tokens = text.split(/(\s+)/);
  const result: React.JSX.Element[] = [];

  // Determine the max phrase length (in words) from annotation keys
  const maxPhraseWords = Math.max(
    1,
    ...Array.from(annotationMap.keys()).map((k) => k.split(/\s+/).length),
  );

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Whitespace tokens pass through as-is
    if (/^\s+$/.test(token)) {
      result.push(<Text key={i}>{token}</Text>);
      i++;
      continue;
    }

    // Try matching phrases from longest to shortest
    let matched = false;
    for (let phraseLen = maxPhraseWords; phraseLen >= 2; phraseLen--) {
      // Collect the next `phraseLen` word tokens (skipping whitespace)
      const wordTokens: { index: number; raw: string }[] = [];
      let j = i;
      while (wordTokens.length < phraseLen && j < tokens.length) {
        if (!/^\s+$/.test(tokens[j])) {
          wordTokens.push({ index: j, raw: tokens[j] });
        }
        j++;
      }

      if (wordTokens.length < phraseLen) continue;

      const phrase = wordTokens
        .map((wt) => wt.raw.replace(/[.,!?;:"""''()]/g, '').toLowerCase())
        .join(' ');

      if (annotationMap.has(phrase)) {
        const lastIndex = wordTokens[wordTokens.length - 1].index;
        const matchedText = tokens.slice(i, lastIndex + 1).join('');
        const isSelected = selectedAnnotation?.wordOrPhrase.toLowerCase() === phrase;

        result.push(
          <Text
            key={`ann-${i}`}
            onPress={() => onPress(matchedText)}
            style={{
              fontSize,
              lineHeight: fontSize * 1.7,
              color: isSelected ? colors.indigo[400] : colors.text.primary,
              textDecorationLine: 'underline',
              textDecorationColor: 'rgba(200, 162, 74, 0.3)',
              fontWeight: isSelected ? '600' : '400',
            }}
            accessibilityRole="button"
            accessibilityLabel={`Translate: ${matchedText.trim()}`}
          >
            {matchedText}
          </Text>,
        );

        i = lastIndex + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Single-word annotation check
      const cleaned = token.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
      const hasAnnotation = annotationMap.has(cleaned);
      const isSelected = selectedAnnotation?.wordOrPhrase.toLowerCase() === cleaned;

      if (hasAnnotation) {
        result.push(
          <Text
            key={`ann-${i}`}
            onPress={() => onPress(token)}
            style={{
              fontSize,
              lineHeight: fontSize * 1.7,
              color: isSelected ? colors.indigo[400] : colors.text.primary,
              textDecorationLine: 'underline',
              textDecorationColor: 'rgba(200, 162, 74, 0.3)',
              fontWeight: isSelected ? '600' : '400',
            }}
            accessibilityRole="button"
            accessibilityLabel={`Translate: ${token}`}
          >
            {token}
          </Text>,
        );
      } else {
        result.push(<Text key={`word-${i}`}>{token}</Text>);
      }
      i++;
    }
  }

  return result;
}

// Simplified tooltip for book annotations
function BookWordTooltip({
  annotation,
  onAddToReview,
  onDismiss,
}: {
  annotation: BookAnnotation;
  onAddToReview: () => Promise<ReviewItem | null>;
  onDismiss: () => void;
}) {
  const handleAdd = async () => {
    await onAddToReview();
    onDismiss();
  };

  return (
    <View style={{
      backgroundColor: colors.surface.card, borderRadius: radii.lg, padding: spacing.md,
      borderWidth: 1, borderColor: colors.border.default,
    }}>
      <View style={{ marginBottom: spacing.xs }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary }}>
          {annotation.wordOrPhrase}
        </Text>
        <Text style={{ fontSize: 16, color: colors.text.secondary, marginTop: 2 }}>
          {annotation.translation}
        </Text>
        {annotation.partOfSpeech && (
          <Text style={{ fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic', marginTop: 2 }}>
            {annotation.partOfSpeech}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xs }}>
        <Pressable
          onPress={handleAdd}
          style={{ flex: 1, backgroundColor: colors.action.primaryFill, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Add to review queue"
        >
          <Text style={{ color: colors.text.onPrimary, fontSize: 14, fontWeight: '600' }}>Add to Review</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: colors.surface.cardAlt, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
