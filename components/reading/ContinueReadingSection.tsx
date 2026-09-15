import { View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingBook, UserBookProgress } from '../../types';
import { cefrBandColors, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { Body, Caption, Heading } from '../ui2/Ui2Text';
import { spacing } from '../../config/theme';
import { formatReadDuration, remainingReadMinutes } from '../../lib/reading-speed';

interface InProgressBook {
  book: ReadingBook;
  progress: UserBookProgress;
}

interface ContinueReadingSectionProps {
  books: InProgressBook[];
  onPress: (bookId: string) => void;
}

/** The "pick up where you left off" shelf. Tint-block cards on the UI 2.0
 *  tokens; the band tint is still `cefrBandColors` (see BookCard). */
export function ContinueReadingSection({ books, onPress }: ContinueReadingSectionProps) {
  const { c, shape, type } = useUi2Theme();

  if (books.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs + 2 }}>
        <Ionicons name="book" size={18} color={c.primary} />
        <Heading level={3} style={{ marginLeft: spacing.xs }}>Continue Reading</Heading>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {books.map(({ book, progress }) => {
          const cefrColor = cefrBandColors(book.cefrLevel);
          const percent = Math.round(progress.percentComplete);
          // What is left, not what is done. The card already draws the
          // proportion as a bar, so a "34%" caption underneath it was the same
          // fact twice; minutes remaining is the thing the bar cannot say and
          // the thing that decides whether this gets picked up tonight.
          const leftLabel = formatReadDuration(
            remainingReadMinutes(book.wordCount, progress.percentComplete),
          );

          return (
            <Pressable
              key={book.id}
              onPress={() => onPress(book.id)}
              accessibilityRole="button"
              // The 200pt card shows the code alone; the label carries its meaning.
              accessibilityLabel={`Continue reading ${book.title}, ${percent}% complete${leftLabel ? `, about ${leftLabel} left` : ''}. ${cefrAccessibilityLabel(book.cefrLevel)}`}
              style={{
                width: 200,
                backgroundColor: c.card,
                borderWidth: shape.border,
                borderColor: c.cardBorder,
                borderRadius: shape.radiusCard,
                padding: spacing.md,
              }}
            >
              <Body size="sm" weight="semibold" numberOfLines={2} style={{ marginBottom: spacing.xs }}>
                {book.title}
              </Body>

              {/* CEFR badge */}
              <View
                style={{
                  backgroundColor: cefrColor.bg,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  alignSelf: 'flex-start',
                  marginBottom: spacing.xs + 2,
                }}
              >
                <Caption size="sm" style={{ color: cefrColor.text, fontFamily: type.uiBold }}>{book.cefrLevel}</Caption>
              </View>

              {/* Its own line, above the bar. Sharing the bottom row with
                  "Continue →" left it about 90pt in a 200pt card, which
                  truncated a long book to "~2 hr 38 min…" — losing the one
                  word that says what the number means. */}
              {leftLabel ? (
                <Caption
                  tone="secondary"
                  numberOfLines={1}
                  style={{ marginBottom: 6 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  ~{leftLabel} left
                </Caption>
              ) : null}

              <Ui2ProgressBar
                progress={percent / 100}
                height={4}
                onCard
                accessibilityLabel={`${percent} percent read`}
                style={{ marginBottom: 6 }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caption tone="secondary">{percent}%</Caption>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Body size="sm" weight="semibold" tone="accent">Continue</Body>
                  <Ionicons name="arrow-forward" size={14} color={c.onTint} style={{ marginLeft: 2 }} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
