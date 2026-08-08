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
// steps (#3FB950, #E2E6EA, #F85149) all land at or under AA as small text on
// dark, which is why the theme carries a lighter variant for exactly this.
const STATUS_STYLES: Record<BadgeStatus, { bg: string; text: string }> = {
  not_started: { bg: colors.surface.cardAlt, text: '#80868C' },
  in_progress: { bg: 'rgba(242, 244, 246, 0.2)', text: '#C9CDD2' },
  submitted: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F2F4F6' },
  graded: { bg: 'rgba(34, 197, 94, 0.2)', text: '#56D364' },
  returned: { bg: 'rgba(239, 68, 68, 0.2)', text: '#FF7B72' },
  draft: { bg: colors.surface.cardAlt, text: '#80868C' },
  published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#3FB950' },
  closed: { bg: colors.surface.cardAlt, text: '#5C6166' },
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
