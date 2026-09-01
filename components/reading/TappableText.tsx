import { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../config/theme';
import { canExplain } from '../../lib/reading-help';
import { tokenize, type Paragraph } from '../../lib/reading-text';

/**
 * Paragraphs of a book or passage, with every word tappable.
 *
 * Shared by BookReader and ReadingPassageViewer, which used to have two
 * incompatible implementations of this — one tokenising and string-matching
 * against `book_annotations`, the other slicing by `reading_annotations`
 * character offsets — and both of which made a word pressable ONLY if a
 * pre-authored row existed for it. Since `reading_annotations` had 0 rows and
 * `book_annotations` covered 28 of 10,375 books, that meant essentially
 * nothing was tappable. Here every word is, and the meaning is fetched when
 * it is tapped.
 *
 * Performance notes, because this renders a few hundred elements per page:
 *  • `selectedRef` is a {paragraphIndex, tokenIndex} pair, never the selected
 *    word itself. A ParagraphBlock compares only its own index against it, so
 *    opening a tooltip re-renders one paragraph instead of the whole page.
 *  • Word styles are hoisted into a useMemo keyed on fontSize. Building a
 *    fresh style object per word — which the old BookReader did — allocated
 *    one object per token per render.
 */

export interface SelectedRef {
  paragraphIndex: number;
  tokenIndex: number;
}

interface Props {
  paragraphs: Paragraph[];
  fontSize: number;
  selectedRef: SelectedRef | null;
  onWordPress: (raw: string, ref: SelectedRef) => void;
  /** Omitted where explanations are not offered (e.g. no entitlement). */
  onExplain?: (paragraph: Paragraph) => void;
}

function useWordStyles(fontSize: number) {
  return useMemo(
    () => ({
      paragraph: {
        fontSize,
        lineHeight: fontSize * 1.7,
        color: colors.text.primary,
      },
      selected: {
        backgroundColor: colors.surface.cardAlt,
        color: colors.text.primary,
      },
    }),
    [fontSize],
  );
}

type Styles = ReturnType<typeof useWordStyles>;

interface BlockProps {
  paragraph: Paragraph;
  styles: Styles;
  /** Only the selected token index within THIS paragraph, or null. */
  selectedTokenIndex: number | null;
  onWordPress: (raw: string, ref: SelectedRef) => void;
  onExplain?: (paragraph: Paragraph) => void;
}

const ParagraphBlock = memo(function ParagraphBlock({
  paragraph,
  styles,
  selectedTokenIndex,
  onWordPress,
  onExplain,
}: BlockProps) {
  const tokens = useMemo(() => tokenize(paragraph.text), [paragraph.text]);

  // A paragraph outside the server's bounds cannot be explained — it refuses
  // rather than truncating — so offering the button would only produce a 400.
  const showExplain = Boolean(onExplain) && canExplain(paragraph.text);

  return (
    <View style={block.wrap}>
      <Text style={styles.paragraph}>
        {tokens.map((token, i) =>
          token.isSpace ? (
            <Text key={i}>{token.raw}</Text>
          ) : (
            <Text
              key={i}
              onPress={() => onWordPress(token.raw, { paragraphIndex: paragraph.index, tokenIndex: i })}
              style={i === selectedTokenIndex ? styles.selected : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Look up ${token.raw}`}
            >
              {token.raw}
            </Text>
          ),
        )}
      </Text>

      {showExplain && (
        <Pressable
          onPress={() => onExplain?.(paragraph)}
          style={block.explain}
          accessibilityRole="button"
          accessibilityLabel="Explain this paragraph"
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.text.tertiary} />
          <Text style={block.explainLabel}>Explain</Text>
        </Pressable>
      )}
    </View>
  );
});

const block = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  explain: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    // 44pt minimum touch target (Apple HIG) — the icon and label alone are
    // ~18pt tall, so the row is padded up to reach it rather than relying on
    // hitSlop, which VoiceOver's element frame does not follow.
    minHeight: 44,
    paddingRight: spacing.xs,
  },
  explainLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginLeft: spacing.xxs,
  },
});

export function TappableText({
  paragraphs,
  fontSize,
  selectedRef,
  onWordPress,
  onExplain,
}: Props) {
  const styles = useWordStyles(fontSize);

  return (
    <View>
      {paragraphs.map((paragraph) => (
        <ParagraphBlock
          key={paragraph.index}
          paragraph={paragraph}
          styles={styles}
          selectedTokenIndex={
            selectedRef && selectedRef.paragraphIndex === paragraph.index
              ? selectedRef.tokenIndex
              : null
          }
          onWordPress={onWordPress}
          onExplain={onExplain}
        />
      ))}
    </View>
  );
}
