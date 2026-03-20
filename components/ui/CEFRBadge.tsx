import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CEFRLevel } from '../../types';

const LEVEL_COLORS: Record<CEFRLevel, { bg: string; text: string }> = {
  A1: { bg: '#DCFCE7', text: '#166534' },
  A2: { bg: '#D1FAE5', text: '#065F46' },
  B1: { bg: '#DBEAFE', text: '#1E40AF' },
  B2: { bg: '#C7D2FE', text: '#3730A3' },
  C1: { bg: '#FDE68A', text: '#92400E' },
  C2: { bg: '#FECACA', text: '#991B1B' },
};

interface CEFRBadgeProps {
  level: CEFRLevel;
  size?: 'small' | 'medium';
}

export function CEFRBadge({ level, size = 'small' }: CEFRBadgeProps) {
  const colors = LEVEL_COLORS[level];
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall ? styles.small : styles.medium]}>
      <Text style={[styles.text, { color: colors.text }, isSmall ? styles.textSmall : styles.textMedium]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 14,
  },
});
