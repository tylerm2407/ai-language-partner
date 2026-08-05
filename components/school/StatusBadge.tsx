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
// steps (#22C55E, #F59E0B, #EF4444) all land at or under AA as small text on
// dark, which is why the theme carries a lighter variant for exactly this.
const STATUS_STYLES: Record<BadgeStatus, { bg: string; text: string }> = {
  not_started: { bg: colors.surface.cardAlt, text: '#94A3B8' },
  in_progress: { bg: 'rgba(99, 102, 241, 0.2)', text: '#818CF8' },
  submitted: { bg: 'rgba(245, 158, 11, 0.2)', text: '#FCD34D' },
  graded: { bg: 'rgba(34, 197, 94, 0.2)', text: '#6EE7B7' },
  returned: { bg: 'rgba(239, 68, 68, 0.2)', text: '#FCA5A5' },
  draft: { bg: colors.surface.cardAlt, text: '#94A3B8' },
  published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22C55E' },
  closed: { bg: colors.surface.cardAlt, text: '#64748B' },
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
