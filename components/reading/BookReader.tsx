import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WordTooltip } from './WordTooltip';
import type { ReadingBook, BookAnnotation, ReviewItem } from '../../types';

interface Props {
  book: ReadingBook;
  annotations: BookAnnotation[];
  initialPosition: number;
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const newPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(newPage);
    setSelectedAnnotation(null);
    savePosition(newPage);

    // Check completion
    if (newPage === totalPages - 1) {
      onComplete();
    }
  }, [totalPages, savePosition, onComplete]);

  // Build annotation lookup for current page text
  const annotationMap = useMemo(() => {
    const map = new Map<string, BookAnnotation>();
    for (const ann of annotations) {
      map.set(ann.wordOrPhrase.toLowerCase(), ann);
    }
    return map;
  }, [annotations]);

  const handleWordPress = useCallback((word: string) => {
    const cleaned = word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onExit} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Exit reading">
          <Ionicons name="close" size={24} color="#666" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>
            Page {currentPage + 1} of {totalPages}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowFontControls(!showFontControls)}
          style={{ padding: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Font size"
        >
          <Ionicons name="text" size={20} color="#6366F1" />
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={{ height: 3, backgroundColor: '#F3F4F6', marginHorizontal: 16 }}>
        <View style={{ height: 3, backgroundColor: '#6366F1', width: `${progressPercent}%` }} />
      </View>

      {/* Font Size Controls */}
      {showFontControls && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, gap: 12 }}>
          <Pressable
            onPress={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
            disabled={fontSizeIndex === 0}
            style={{ padding: 8, opacity: fontSizeIndex === 0 ? 0.3 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Decrease font size"
          >
            <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600' }}>A-</Text>
          </Pressable>
          <Text style={{ fontSize: 14, color: '#666' }}>{fontSize}px</Text>
          <Pressable
            onPress={() => setFontSizeIndex(Math.min(FONT_SIZES.length - 1, fontSizeIndex + 1))}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            style={{ padding: 8, opacity: fontSizeIndex === FONT_SIZES.length - 1 ? 0.3 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Increase font size"
          >
            <Text style={{ fontSize: 18, color: '#6366F1', fontWeight: '600' }}>A+</Text>
          </Pressable>
        </View>
      )}

      {/* Page Content */}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => setSelectedAnnotation(null)}>
          <Text style={{ fontSize, lineHeight: fontSize * 1.7, color: '#111' }}>
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

      {/* Navigation */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', padding: 16, backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 12,
      }}>
        <Pressable
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: currentPage === 0 ? '#F3F4F6' : '#F9FAFB',
          }}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: currentPage === 0 ? '#999' : '#111' }}>
            Previous
          </Text>
        </Pressable>
        <Pressable
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: currentPage >= totalPages - 1 ? '#C7D2FE' : '#6366F1',
          }}
          accessibilityRole="button"
          accessibilityLabel="Next page"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
            {currentPage >= totalPages - 1 ? 'Finish' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Render words with tap-to-translate for annotated words
function renderAnnotatedWords(
  text: string,
  annotationMap: Map<string, BookAnnotation>,
  selectedAnnotation: BookAnnotation | null,
  onPress: (word: string) => void,
  fontSize: number,
): React.JSX.Element[] {
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    if (/^\s+$/.test(word)) {
      return <Text key={i}>{word}</Text>;
    }

    const cleaned = word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
    const hasAnnotation = annotationMap.has(cleaned);
    const isSelected = selectedAnnotation?.wordOrPhrase.toLowerCase() === cleaned;

    if (hasAnnotation) {
      return (
        <Text
          key={i}
          onPress={() => onPress(word)}
          style={{
            fontSize,
            lineHeight: fontSize * 1.7,
            color: isSelected ? '#6366F1' : '#111',
            textDecorationLine: 'underline',
            textDecorationColor: 'rgba(99, 102, 241, 0.3)',
            fontWeight: isSelected ? '600' : '400',
          }}
          accessibilityRole="button"
          accessibilityLabel={`Translate: ${word}`}
        >
          {word}
        </Text>
      );
    }

    return <Text key={i}>{word}</Text>;
  });
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
      backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: '#E5E7EB',
    }}>
      <View style={{ marginBottom: 8 }}>
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
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={handleAdd}
          style={{ flex: 1, backgroundColor: '#6366F1', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Add to review queue"
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add to Review</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: '#666', fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
