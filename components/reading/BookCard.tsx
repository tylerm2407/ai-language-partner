import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingBook, UserBookProgress } from '../../types';
import { cefrBandColors, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface BookCardProps {
  book: ReadingBook;
  progress?: UserBookProgress | null;
  onPress: () => void;
}

export function BookCard({ book, progress, onPress }: BookCardProps) {
  const { c } = useUi2Theme();
  const cefrColor = cefrBandColors(book.cefrLevel);
  const isCompleted = !!progress?.completedAt;
  const hasProgress = progress && progress.percentComplete > 0;
  const percent = progress?.percentComplete ?? 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The badge inside is a two-letter code in a 6pt-padded chip; there is no
      // room for the can-do line, so the whole card carries it instead.
      accessibilityLabel={`${book.title}${isCompleted ? ', completed' : ''}. ${book.wordCount} words. ${cefrAccessibilityLabel(book.cefrLevel)}`}
      style={{
        flex: 1,
        backgroundColor: c.card,
        // A white card on a white ground is only a card if it is outlined.
        borderWidth: 1,
        borderColor: c.cardBorder,
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
              backgroundColor: c.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={16} color={c.onPrimary} />
          </View>
        )}
      </View>

      {/* Info area */}
      <View style={{ padding: 10 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '600', color: c.ink }}
        >
          {book.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '400', color: c.muted }}>
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
                backgroundColor: c.track,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 4,
                  width: `${Math.min(percent, 100)}%`,
                  backgroundColor: c.primary,
                  borderRadius: 2,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '400', color: c.muted, marginTop: 2 }}>
              {Math.round(percent)}%
            </Text>
          </View>
        ) : (
          <View
            style={{
              marginTop: 8,
              backgroundColor: c.primaryTint,
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: c.onTint }}>New</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
