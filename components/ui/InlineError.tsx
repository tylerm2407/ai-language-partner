import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body } from './Text';
import { colors, spacing } from '../../config/theme';
import type { ErrorCopy } from '../../lib/error-copy';

/**
 * Inline failure state with a retry, used everywhere this screen loads
 * something. Preferred over `Alert.alert('Error', …)`: the learner keeps the
 * screen they were on, the copy says what to do next, and the retry is one tap
 * away rather than a full re-navigation (CLAUDE.md §5).
 */
export function InlineError({
  copy,
  onRetry,
  retryLabel = 'Try again',
}: {
  copy: ErrorCopy;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons name="alert-circle" size={16} color={colors.error.base} style={{ marginTop: 2 }} />
        <View style={{ marginLeft: spacing.xxs, flexShrink: 1 }}>
          <Body size="sm" weight="semibold" tone="error">{copy.title}</Body>
          <Body size="sm" tone="tertiary">{copy.message}</Body>
        </View>
      </View>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }}
      >
        <Body size="sm" weight="semibold" tone="accent">{retryLabel}</Body>
      </Pressable>
    </View>
  );
}
