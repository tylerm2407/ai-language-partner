/**
 * Home, UI 2.0 — "Your patterns": the first place the learner sees what the
 * tutor already knows about them. Recurring mistakes from `correction_log`
 * and words the SRS says they keep failing, ranked by `lib/insights.ts`.
 *
 * Pure presentation; `app/(app)/index.tsx` owns the data via
 * `useLearnerInsights`. Renders NOTHING for a learner with no history yet —
 * an empty "you have no patterns" card on a first-day home screen is a claim
 * about someone the app has not met — and renders an error with retry when
 * the read failed, because an empty card and a failed one must not look alike.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { Chip } from '../Chip';
import { SectionTitle } from './HomeProgress';
import { useHomeEnter } from './HomeSections';
import { haptic } from '../../../lib/haptics';
import { errorTypeIcon, errorTypeLabel, patternsHeadline, type RecurringMistake, type StrugglingWord } from '../../../lib/insights';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { ErrorCopy } from '../../../lib/error-copy';

/** How many of each list the card shows before deferring to "See all". */
export const HOME_MISTAKE_ROWS = 3;
export const HOME_WORD_CHIPS = 4;

interface PatternsCardProps {
  mistakes: RecurringMistake[];
  words: StrugglingWord[];
  loading: boolean;
  error: ErrorCopy | null;
  onRetry: () => void;
  /** Open the full patterns screen. */
  onOpen: () => void;
  /** Start a review of only the struggling words. */
  onReviewWords: () => void;
}

export function PatternsCard({ mistakes, words, loading, error, onRetry, onOpen, onReviewWords }: PatternsCardProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();

  if (error && mistakes.length === 0 && words.length === 0) {
    return (
      <Animated.View entering={enter(5)} style={styles.section}>
        <SectionTitle title="Your patterns" />
        <SlabCard style={{ gap: 8 }}>
          <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.error }}>{error.title}</Text>
          <Text style={{ fontFamily: type.ui, fontSize: 13, color: c.muted }}>{error.message}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try loading your patterns again" style={styles.retry}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.primary }}>Try again</Text>
          </Pressable>
        </SlabCard>
      </Animated.View>
    );
  }

  // Nothing known yet, or still on the first load: no card. The section
  // appears the day there is something true to say.
  if (loading || (mistakes.length === 0 && words.length === 0)) return null;

  const shownMistakes = mistakes.slice(0, HOME_MISTAKE_ROWS);
  const shownWords = words.slice(0, HOME_WORD_CHIPS);
  const moreWords = words.length - shownWords.length;
  const headline = patternsHeadline(mistakes.length, words.length);

  return (
    <Animated.View entering={enter(5)} style={styles.section}>
      <SectionTitle title="Your patterns" action="See all" onAction={onOpen} />
      <Pressable
        onPress={() => {
          haptic('select');
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${headline}. Opens your patterns`}
      >
        <SlabCard style={{ gap: 14 }}>
          <Text style={{ fontFamily: type.heading, fontSize: 17, lineHeight: 22, color: c.ink }}>{headline}</Text>

          {shownMistakes.map((m) => (
            <View key={m.label} style={styles.row} accessibilityLabel={`${m.label}. ${errorTypeLabel(m.errorType)}, ${m.count} times in 30 days`}>
              <View style={[styles.iconTile, { backgroundColor: c.primaryTint }]}>
                <Ionicons name={errorTypeIcon(m.errorType)} size={16} color={c.onTint} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={{ fontFamily: type.uiHeavy, fontSize: 14, color: c.ink }} numberOfLines={1}>
                  {m.label}
                </Text>
                <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>
                  {errorTypeLabel(m.errorType)} · {m.count}× in 30 days
                </Text>
              </View>
            </View>
          ))}

          {shownWords.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>
                {words.length === 1 ? 'A word that keeps slipping' : `${words.length} words that keep slipping`}
              </Text>
              <View style={styles.chips} accessibilityLabel={`Words: ${words.map((w) => w.card.targetText).join(', ')}`}>
                {shownWords.map((w) => (
                  <Chip key={w.card.id} label={w.card.targetText} variant="error" />
                ))}
                {moreWords > 0 && <Chip label={`+${moreWords}`} variant="neutral" />}
              </View>
              <Pressable
                onPress={() => {
                  haptic('select');
                  onReviewWords();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Review ${words.length === 1 ? 'this word' : `these ${words.length} words`} now`}
                style={styles.inlineAction}
              >
                <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.primary }}>
                  Review {words.length === 1 ? 'it' : 'them'} now
                </Text>
                <Ionicons name="arrow-forward" size={14} color={c.primary} />
              </Pressable>
            </View>
          )}

          <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.idle }}>
            From your chats, lessons and reviews. Not a score — where your next five minutes go furthest.
          </Text>
        </SlabCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
