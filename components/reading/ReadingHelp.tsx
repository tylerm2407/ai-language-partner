import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WordTooltip, type WordLookupState } from './WordTooltip';
import type { ExplanationState } from '../../hooks/useWordLookup';
import type { ReviewItem } from '../../types';
import { colors, radii, spacing } from '../../config/theme';

/**
 * Whichever piece of help is currently open: a tapped word, or a paragraph
 * explanation. Never both — asking for one closes the other — so one component
 * renders either and both readers mount it in one line.
 */

interface Props {
  lookup: WordLookupState | null;
  explanation: ExplanationState | null;
  onAddToReview: () => Promise<ReviewItem | null>;
  onRetryLookup: () => void;
  onDismiss: () => void;
  onUpgrade?: () => void;
}

export function ReadingHelp({
  lookup,
  explanation,
  onAddToReview,
  onRetryLookup,
  onDismiss,
  onUpgrade,
}: Props) {
  if (lookup) {
    return (
      <WordTooltip
        state={lookup}
        onAddToReview={onAddToReview}
        onRetry={onRetryLookup}
        onDismiss={onDismiss}
        onUpgrade={onUpgrade}
      />
    );
  }

  if (!explanation) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        padding: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
      }}
    >
      {explanation.status === 'loading' && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.text.tertiary} />
          <Text style={{ fontSize: 15, color: colors.text.tertiary, marginLeft: spacing.xs }}>
            Working it out…
          </Text>
        </View>
      )}

      {explanation.status === 'ready' && (
        <Text style={{ fontSize: 15, lineHeight: 23, color: colors.text.primary }}>
          {explanation.text}
        </Text>
      )}

      {explanation.status === 'quota' && (
        <Text style={{ fontSize: 15, color: colors.text.tertiary }}>
          That&apos;s all your explanations for today. They reset overnight — word
          lookups are separate and still available.
        </Text>
      )}

      {explanation.status === 'error' && (
        <Text style={{ fontSize: 15, color: colors.text.tertiary }}>
          Couldn&apos;t explain that one. Try again in a moment.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        {explanation.status === 'quota' && onUpgrade && (
          <Pressable
            onPress={onUpgrade}
            style={{
              flex: 1,
              backgroundColor: colors.action.primaryFill,
              paddingVertical: spacing.sm,
              minHeight: 44,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="See plans"
          >
            <Text style={{ color: colors.text.onPrimary, fontSize: 14, fontWeight: '600' }}>See Plans</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onDismiss}
          style={{
            flex: 1,
            backgroundColor: colors.surface.cardAlt,
            paddingVertical: spacing.sm,
            minHeight: 44,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 14, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
