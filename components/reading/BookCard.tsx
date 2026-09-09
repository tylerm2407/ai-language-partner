import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingBook, UserBookProgress } from '../../types';
import { cefrBandColors, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { Chip } from '../ui2/Chip';
import { Body, Caption } from '../ui2/Ui2Text';
import { spacing } from '../../config/theme';

interface BookCardProps {
  book: ReadingBook;
  progress?: UserBookProgress | null;
  onPress: () => void;
}

/** Cover height for the two-column grid. */
const COVER_HEIGHT = 140;

/**
 * A library tile. UI 2.0 tint block: no outline, card radius, type from
 * `Ui2Text`, the cover through expo-image so a 10,000-book shelf caches to
 * disk and does not re-decode on every scroll.
 *
 * The CEFR band tint still comes from `lib/cefr-labels.ts`, which reads the
 * fixed Dark Glow palette; moving those six hues onto the scheme-aware
 * tokens is its own change (they are shared with the Learn hub).
 */
export function BookCard({ book, progress, onPress }: BookCardProps) {
  const { c, shape, type } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
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
        borderWidth: shape.border,
        borderColor: c.cardBorder,
        borderRadius: shape.radiusCard,
        overflow: 'hidden',
        marginBottom: spacing.sm,
      }}
    >
      {/* Cover area */}
      <View
        style={{
          height: COVER_HEIGHT,
          backgroundColor: cefrColor.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.sm,
        }}
      >
        {book.imageUrl ? (
          <Image
            source={{ uri: book.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={shouldReduce ? 0 : duration.micro}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <>
            <Ionicons
              name={book.source === 'ai_generated' ? 'sparkles' : 'book-outline'}
              size={32}
              color={cefrColor.text}
            />
            <Body
              size="sm"
              weight="semibold"
              numberOfLines={2}
              style={{ color: cefrColor.text, textAlign: 'center', marginTop: spacing.xs }}
            >
              {book.title}
            </Body>
          </>
        )}

        {/* Completed badge: glyph AND the word "completed" in the card's label. */}
        {isCompleted && (
          <View
            style={{
              position: 'absolute',
              top: spacing.xs,
              right: spacing.xs,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: c.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={16} color={c.onGreen} />
          </View>
        )}
      </View>

      {/* Info area */}
      <View style={{ padding: spacing.sm }}>
        <Body size="sm" weight="semibold" numberOfLines={1}>{book.title}</Body>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxs, gap: 6 }}>
          <Caption tone="secondary">{book.wordCount} words</Caption>
          <View
            style={{
              backgroundColor: cefrColor.bg,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Caption size="sm" style={{ color: cefrColor.text, fontFamily: type.uiBold }}>{book.cefrLevel}</Caption>
          </View>
        </View>

        {/* Progress bar or "New" label */}
        {hasProgress ? (
          <View style={{ marginTop: spacing.xs }}>
            <Ui2ProgressBar progress={percent / 100} height={4} onCard accessibilityLabel={`${Math.round(percent)} percent read`} />
            <Caption size="sm" tone="secondary" style={{ marginTop: 2 }}>{Math.round(percent)}%</Caption>
          </View>
        ) : (
          <Chip label="New" style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }} />
        )}
      </View>
    </Pressable>
  );
}
