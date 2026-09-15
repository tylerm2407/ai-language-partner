import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { haptic } from '../../lib/haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import type { ReviewItem, WordLookup } from '../../types';
import { radii, spacing, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * What the reader currently knows about the tapped word.
 *
 * Lookups used to be preloaded annotations, so this panel never needed a
 * loading or a failed state. They are fetched on demand now, so it does — and
 * "out of lookups for today" is a distinct state from "that didn't work",
 * because one of them is worth a retry button and the other is not.
 */
export type WordLookupState =
  | { status: 'loading'; word: string }
  | { status: 'ready'; lookup: WordLookup }
  | { status: 'quota'; word: string }
  | { status: 'error'; word: string };

interface Props {
  state: WordLookupState;
  onAddToReview: () => Promise<ReviewItem | null>;
  onRetry: () => void;
  onDismiss: () => void;
  /** Shown under the quota message. Omitted where there is nothing to sell. */
  onUpgrade?: () => void;
}

// The palette is a parameter rather than a module-level read: these objects
// are built once per render from whichever scheme the phone is in, and a
// module-level colour would pin the panel to one of them.
const cardStyle = (c: Ui2Palette) =>
  ({
    backgroundColor: c.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: c.cardBorder,
  }) as const;

// 44pt minimum touch target (Apple HIG).
const buttonBase = {
  flex: 1,
  paddingVertical: spacing.sm,
  minHeight: 44,
  borderRadius: radii.md,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const secondaryButton = (c: Ui2Palette) =>
  ({ ...buttonBase, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.cardBorder }) as const;
const primaryButton = (c: Ui2Palette) => ({ ...buttonBase, backgroundColor: c.primary }) as const;

export function WordTooltip({ state, onAddToReview, onRetry, onDismiss, onUpgrade }: Props) {
  const { c } = useUi2Theme();

  const handleAddToReview = async () => {
    const result = await onAddToReview();
    if (result) {
      haptic('confirm');
    }
    onDismiss();
  };

  const word = state.status === 'ready' ? state.lookup.word : state.word;

  return (
    <View style={cardStyle(c)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: c.ink }}>
            {word}
          </Text>

          {state.status === 'loading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxs }}>
              <ActivityIndicator size="small" color={c.muted} />
              <Text style={{ fontSize: 15, color: c.muted, marginLeft: spacing.xs }}>
                Looking it up…
              </Text>
            </View>
          )}

          {state.status === 'ready' && (
            <>
              <Text style={{ fontSize: 16, color: c.ink, marginTop: 2 }}>
                {state.lookup.translation}
              </Text>
              {state.lookup.partOfSpeech && (
                <Text style={{ fontSize: 13, color: c.muted, fontStyle: 'italic', marginTop: 2 }}>
                  {state.lookup.partOfSpeech}
                </Text>
              )}
            </>
          )}

          {state.status === 'quota' && (
            <Text style={{ fontSize: 15, color: c.muted, marginTop: 4 }}>
              That&apos;s all your word lookups for today. They reset overnight.
            </Text>
          )}

          {state.status === 'error' && (
            <Text style={{ fontSize: 15, color: c.muted, marginTop: 4 }}>
              Couldn&apos;t look that up.
            </Text>
          )}
        </View>

        {state.status === 'ready' && state.lookup.audioUrl && (
          <AudioPlayButton audioUrl={state.lookup.audioUrl} size={44} />
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {state.status === 'ready' && (
          <Pressable
            onPress={handleAddToReview}
            style={primaryButton(c)}
            accessibilityRole="button"
            accessibilityLabel="Add to review queue"
          >
            <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '600' }}>Add to Review</Text>
          </Pressable>
        )}

        {state.status === 'error' && (
          <Pressable
            onPress={onRetry}
            style={primaryButton(c)}
            accessibilityRole="button"
            accessibilityLabel="Try the lookup again"
          >
            <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        )}

        {/* No retry on the quota state: it will not succeed again today, and
            offering the button would be a lie the learner pays attention to. */}
        {state.status === 'quota' && onUpgrade && (
          <Pressable
            onPress={onUpgrade}
            style={primaryButton(c)}
            accessibilityRole="button"
            accessibilityLabel="See plans"
          >
            <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '600' }}>See Plans</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onDismiss}
          style={secondaryButton(c)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
