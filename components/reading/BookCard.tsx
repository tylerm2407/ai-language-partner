import { View, Text, Pressable, Image } from 'react-native';
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

interface BookCardProps {
  book: ReadingBook;
  progress?: UserBookProgress | null;
  onPress: () => void;
}

export function BookCard({ book, progress, onPress }: BookCardProps) {
  const cefrColor = CEFR_BADGE_COLORS[book.cefrLevel] ?? { bg: '#F3F4F6', text: '#666666' };
  const isCompleted = !!progress?.completedAt;
  const hasProgress = progress && progress.percentComplete > 0;
  const percent = progress?.percentComplete ?? 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}${isCompleted ? ', completed' : ''}`}
      style={{
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Cover area */}
      <View
        style={{
          height: 140,
          backgroundColor: cefrColor.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        {book.imageUrl ? (
          <Image
            source={{ uri: book.imageUrl }}
            style={{ width: '100%', height: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}
            resizeMode="cover"
          />
        ) : (
          <>
            <Ionicons
              name={book.source === 'ai_generated' ? 'sparkles' : 'book-outline'}
              size={32}
              color={cefrColor.text}
            />
            <Text
              numberOfLines={2}
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: cefrColor.text,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {book.title}
            </Text>
          </>
        )}

        {/* Completed badge */}
        {isCompleted && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#22C55E',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Info area */}
      <View style={{ padding: 10 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '600', color: '#111111' }}
        >
          {book.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '400', color: '#666666' }}>
            {book.wordCount} words
          </Text>
          <View
            style={{
              backgroundColor: cefrColor.bg,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: cefrColor.text }}>
              {book.cefrLevel}
            </Text>
          </View>
        </View>

        {/* Progress bar or "New" label */}
        {hasProgress ? (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                height: 4,
                backgroundColor: '#F3F4F6',
                borderRadius: 2,
                overflow: 'hidden',
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
            <Text style={{ fontSize: 11, fontWeight: '400', color: '#666666', marginTop: 2 }}>
              {Math.round(percent)}%
            </Text>
          </View>
        ) : (
          <View
            style={{
              marginTop: 8,
              backgroundColor: '#E0E7FF',
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6366F1' }}>New</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
