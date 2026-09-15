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
import { estimatedReadMinutes, formatReadDuration } from '../../lib/reading-speed';

interface BookCardProps {
  book: ReadingBook;
  progress?: UserBookProgress | null;
  /**
   * Share of the book's running words that fall in the language's 1,000 most
   * frequent forms, 0..1 — `common_share` from `rank_books_by_coverage`.
   *
   * Only the 'For you' shelf has it; the per-band shelves do not go through
   * the ranking RPC, so it is optional and the line is simply absent there
   * rather than showing a zero that would read as "none of these words are
   * common".
   *
   * Note this is deliberately NOT `known_share` (the share the learner has
   * actually retained). `known_share` is 0 for very nearly every user today —
   * it only counts cards that have graduated out of 'learning' — so a "words
   * you know" figure would read 0% on every book on the shelf.
   */
  commonShare?: number | null;
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
export function BookCard({ book, progress, commonShare, onPress }: BookCardProps) {
  const { c, shape, type } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
  const cefrColor = cefrBandColors(book.cefrLevel);
  const isCompleted = !!progress?.completedAt;
  const hasProgress = progress && progress.percentComplete > 0;
  const percent = progress?.percentComplete ?? 0;
  // The tile shows time rather than the raw word count it used to show. On a
  // shelf the question is "have I got time for this", and 12,480 does not
  // answer it without arithmetic. The detail screen still gives both.
  const readDuration = formatReadDuration(estimatedReadMinutes(book.wordCount));
  const commonPercent =
    typeof commonShare === 'number' && Number.isFinite(commonShare)
      ? Math.round(Math.min(1, Math.max(0, commonShare)) * 100)
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The badge inside is a two-letter code in a 6pt-padded chip; there is no
      // room for the can-do line, so the whole card carries it instead.
      accessibilityLabel={[
        `${book.title}${isCompleted ? ', completed' : ''}.`,
        `${book.wordCount} words.`,
        readDuration ? `About ${readDuration} to read.` : '',
        commonPercent !== null && !hasProgress ? `${commonPercent} percent common words.` : '',
        cefrAccessibilityLabel(book.cefrLevel),
      ]
        .filter(Boolean)
        .join(' ')}
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
          <Caption tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {readDuration ? `~${readDuration}` : `${book.wordCount} words`}
          </Caption>
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

        {/* Why this book sits where it does. The 'For you' shelf is ordered by
            coverage, and until now the number doing the ordering was invisible
            — so the order read as arbitrary. Spelled out in the card's label
            above, since 11pt next to a progress bar is easy to miss.

            Hidden once the book is underway: coverage is a pick-a-book signal,
            and stacking "82% common words" directly under the "34%" read
            counter puts two unrelated percentages one line apart. */}
        {commonPercent !== null && !hasProgress ? (
          <Caption
            size="sm"
            tone="tertiary"
            numberOfLines={1}
            style={{ marginTop: spacing.xxs }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {commonPercent}% common words
          </Caption>
        ) : null}
      </View>
    </Pressable>
  );
}
