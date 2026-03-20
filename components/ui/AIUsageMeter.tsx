import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AIUsageMeterProps {
  label: string;
  used: number;
  limit: number | 'unlimited';
}

export function AIUsageMeter({ label, used, limit }: AIUsageMeterProps) {
  if (limit === 'unlimited') {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.unlimited}>Unlimited</Text>
      </View>
    );
  }

  const ratio = Math.min(used / limit, 1);
  const isLow = ratio >= 0.8;
  const barColor = isLow ? '#EF4444' : '#6366F1';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.count, isLow && styles.countLow]}>
          {used}/{limit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  count: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  countLow: {
    color: '#EF4444',
  },
  unlimited: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
  },
  track: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
