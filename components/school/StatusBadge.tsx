import React from 'react';
import { View, Text } from 'react-native';
import type { SubmissionStatus } from '../../types';
import type { Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

type BadgeStatus = SubmissionStatus | 'draft' | 'published' | 'closed';

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'small' | 'medium';
}

// The semantic lives in the TINT behind the chip, not in the label's colour:
// UI 2.0 runs in light mode as well, and green/amber label text on a pale tint
// lands nowhere near AA there. `ink` on the tint clears it in both schemes, and
// the label itself already names the status, so nothing here is colour-only.
const STATUS_STYLES = (c: Ui2Palette): Record<BadgeStatus, { bg: string; text: string }> => ({
  not_started: { bg: c.surface2, text: c.muted },
  in_progress: { bg: c.primaryTint, text: c.onTint },
  submitted: { bg: c.yellowTint, text: c.ink },
  graded: { bg: c.greenTint, text: c.ink },
  returned: { bg: c.pinkTint, text: c.ink },
  draft: { bg: c.surface2, text: c.muted },
  published: { bg: c.greenTint, text: c.ink },
  closed: { bg: c.surface2, text: c.idle },
});

function formatLabel(status: BadgeStatus): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const { c } = useUi2Theme();
  const styles = STATUS_STYLES(c)[status];
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
