import React from 'react';
import { View, Text } from 'react-native';
import type { SubmissionStatus } from '../../types';

type BadgeStatus = SubmissionStatus | 'draft' | 'published' | 'closed';

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'small' | 'medium';
}

const STATUS_STYLES: Record<BadgeStatus, { bg: string; text: string }> = {
  not_started: { bg: 'rgba(30, 35, 50, 0.8)', text: '#64748B' },
  in_progress: { bg: 'rgba(99, 102, 241, 0.2)', text: '#6366F1' },
  submitted: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' },
  graded: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22C55E' },
  returned: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444' },
  draft: { bg: 'rgba(30, 35, 50, 0.8)', text: '#64748B' },
  published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22C55E' },
  closed: { bg: 'rgba(30, 35, 50, 0.8)', text: '#64748B' },
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
          fontFamily: 'Inter_600SemiBold',
        }}
      >
        {formatLabel(status)}
      </Text>
    </View>
  );
}
