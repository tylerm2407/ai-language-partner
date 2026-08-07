import React from 'react';
import { View, Text } from 'react-native';
import type { SubmissionStatus } from '../../types';
import { colors } from '../../config/theme';

type BadgeStatus = SubmissionStatus | 'draft' | 'published' | 'closed';

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'small' | 'medium';
}

// Chip labels use each semantic's `.light` step on its own tint — the base
// steps (#4E9F6B, #D9913C, #C0555F) all land at or under AA as small text on
// dark, which is why the theme carries a lighter variant for exactly this.
const STATUS_STYLES: Record<BadgeStatus, { bg: string; text: string }> = {
  not_started: { bg: colors.surface.cardAlt, text: '#9C968A' },
  in_progress: { bg: 'rgba(200, 162, 74, 0.2)', text: '#E0BE6B' },
  submitted: { bg: 'rgba(245, 158, 11, 0.2)', text: '#EFBB7C' },
  graded: { bg: 'rgba(34, 197, 94, 0.2)', text: '#7FC79A' },
  returned: { bg: 'rgba(239, 68, 68, 0.2)', text: '#E39098' },
  draft: { bg: colors.surface.cardAlt, text: '#9C968A' },
  published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4E9F6B' },
  closed: { bg: colors.surface.cardAlt, text: '#7A756B' },
};

function formatLabel(status: BadgeStatus): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const isSmall = size === 'small';

  return (
    <View
      style={{
        backgroundColor: styles.bg,
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical: isSmall ? 2 : 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
      accessibilityLabel={`Status: ${formatLabel(status)}`}
      accessibilityRole="text"
    >
      <Text
        style={{
          color: styles.text,
          fontSize: isSmall ? 10 : 12,
          fontFamily: 'Nunito_600SemiBold',
        }}
      >
        {formatLabel(status)}
      </Text>
    </View>
  );
}
