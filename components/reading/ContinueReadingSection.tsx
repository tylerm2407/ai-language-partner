import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingBook, UserBookProgress } from '../../types';

const CEFR_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#DCFCE7', text: '#22C55E' },
  A2: { bg: '#E0E7FF', text: '#6366F1' },
  B1: { bg: '#FEF9C3', text: '#CA8A04' },
  B2: { bg: '#FEE2E2', text: '#EF4444' },
  C1: { bg: '#E0E7FF', text: '#6366F1' },
  C2: { bg: '#FEE2E2', text: '#EF4444' },
};

interface InProgressBook {
  book: ReadingBook;
  progress: UserBookProgress;
}

interface ContinueReadingSectionProps {
  books: InProgressBook[];
  onPress: (bookId: string) => void;
}

export function ContinueReadingSection({ books, onPress }: ContinueReadingSectionProps) {
  if (books.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="book" size={18} color="#6366F1" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111111', marginLeft: 8 }}>
          Continue Reading
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {books.map(({ book, progress }) => {
          const cefrColor = CEFR_BADGE_COLORS[book.cefrLevel] ?? { bg: '#F3F4F6', text: '#666666' };
          const percent = Math.round(progress.percentComplete);

          return (
            <Pressable
              key={book.id}
              onPress={() => onPress(book.id)}
              accessibilityRole="button"
              accessibilityLabel={`Continue reading ${book.title}, ${percent}% complete`}
              style={{
                width: 200,
                backgroundColor: '#F9FAFB',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Text
                numberOfLines={2}
                style={{ fontSize: 14, fontWeight: '600', color: '#111111', marginBottom: 8 }}
              >
                {book.title}
              </Text>

              {/* CEFR badge */}
              <View
                style={{
                  backgroundColor: cefrColor.bg,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  alignSelf: 'flex-start',
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: cefrColor.text }}>
                  {book.cefrLevel}
                </Text>
              </View>

              {/* Progress bar */}
              <View
                style={{
                  height: 4,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: '#6366F1',
                    borderRadius: 2,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '400', color: '#666666' }}>
                  {percent}%
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>
                  Continue →
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
