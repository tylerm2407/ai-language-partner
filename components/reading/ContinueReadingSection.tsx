import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingBook, UserBookProgress } from '../../types';
import { cefrBandColors, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { colors } from '../../config/theme';

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
        <Ionicons name="book" size={18} color="#818CF8" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary, marginLeft: 8 }}>
          Continue Reading
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {books.map(({ book, progress }) => {
          const cefrColor = cefrBandColors(book.cefrLevel);
          const percent = Math.round(progress.percentComplete);

          return (
            <Pressable
              key={book.id}
              onPress={() => onPress(book.id)}
              accessibilityRole="button"
              // The 200pt card shows the code alone; the label carries its meaning.
              accessibilityLabel={`Continue reading ${book.title}, ${percent}% complete. ${cefrAccessibilityLabel(book.cefrLevel)}`}
              style={{
                width: 200,
                backgroundColor: colors.surface.card,
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Text
                numberOfLines={2}
                style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 }}
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
                  backgroundColor: colors.surface.cardAlt,
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: '#4F46E5',
                    borderRadius: 2,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '400', color: colors.text.tertiary }}>
                  {percent}%
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.action.accent }}>
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
