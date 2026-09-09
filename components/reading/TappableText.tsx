import { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
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
  /** Line height as a multiple of fontSize. Defaults to the 1.7 the reader
   *  has always used; the display sheet offers 1.45 and 1.95 around it. */
  lineHeightMultiplier?: number;
  /** Body face. Omitted = the platform default, which is how the reader
   *  rendered before the display sheet. Never pair this with `fontWeight`:
   *  Android substitutes a different family when both are set. */
  fontFamily?: string;
  selectedRef: SelectedRef | null;
  onWordPress: (raw: string, ref: SelectedRef) => void;
  /** Omitted where explanations are not offered (e.g. no entitlement). */
  onExplain?: (paragraph: Paragraph) => void;
}

/**
 * Paragraph and selected-word styles for one font size.
 *
 * The selected word is NOT marked by colour alone — it takes the tint fill AND
 * an underline, so it still reads for someone who cannot separate the two hues,
 * and in either scheme. `c` joins the dependency array because the styles now
 * carry colour; it is one of two module-level palette constants, so it changes
 * only when the phone's scheme does and the memo still holds across renders.
 */
export const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.7;

function useWordStyles(fontSize: number, lineHeightMultiplier: number, fontFamily: string | undefined) {
  const { c } = useUi2Theme();
  return useMemo(
    () => ({
      paragraph: {
        fontSize,
        lineHeight: fontSize * lineHeightMultiplier,
        color: c.ink,
        ...(fontFamily ? { fontFamily } : null),
      },
      selected: {
        backgroundColor: c.primaryTint,
        color: c.onTint,
        textDecorationLine: 'underline' as const,
      },
    }),
    [fontSize, lineHeightMultiplier, fontFamily, c],
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
  const { c } = useUi2Theme();
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
          <Ionicons name="help-circle-outline" size={18} color={c.muted} />
          <Text style={[block.explainLabel, { color: c.muted }]}>Explain</Text>
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
    marginLeft: spacing.xxs,
  },
});

export function TappableText({
  paragraphs,
  fontSize,
  lineHeightMultiplier = DEFAULT_LINE_HEIGHT_MULTIPLIER,
  fontFamily,
  selectedRef,
  onWordPress,
  onExplain,
}: Props) {
  const styles = useWordStyles(fontSize, lineHeightMultiplier, fontFamily);

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
