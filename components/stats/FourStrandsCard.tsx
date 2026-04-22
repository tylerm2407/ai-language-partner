/**
 * FourStrandsCard — visualizes this week's balance across Paul Nation's
 * Four Strands (research.md §14.3). Stacked progress bars per strand with
 * percentage labels. Nudges when one strand is underweight.
 */

import { View, Text } from 'react-native';
import {
  STRAND_LABELS,
  type Strand,
  type StrandMinutes,
  mostUnderweightStrand,
} from '../../lib/four-strands';

interface Props {
  totals: StrandMinutes;
}

const STRAND_COLOR: Record<Strand, string> = {
  meaning_input: 'bg-primary',
  meaning_output: 'bg-success',
  language_focus: 'bg-warning',
  fluency: 'bg-secondary',
};

export function FourStrandsCard({ totals }: Props) {
  const total =
    totals.meaning_input + totals.meaning_output + totals.language_focus + totals.fluency;

  if (total === 0) {
    return (
      <View className="bg-dark-card rounded-2xl p-4">
        <Text className="text-base font-semibold text-text-primary mb-1">Four Strands</Text>
        <Text className="text-sm text-text-secondary">
          Practice this week to see your balance across reading, output, drills, and fluency.
        </Text>
      </View>
    );
  }

  const underweight = mostUnderweightStrand(totals);

  return (
    <View className="bg-dark-card rounded-2xl p-4">
      <Text className="text-base font-semibold text-text-primary mb-3">This week&apos;s balance</Text>
      {(Object.keys(STRAND_LABELS) as Strand[]).map((strand) => {
        const minutes = totals[strand];
        const pct = total === 0 ? 0 : Math.round((minutes / total) * 100);
        return (
          <View key={strand} className="mb-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm text-text-primary">{STRAND_LABELS[strand]}</Text>
              <Text className="text-xs text-text-secondary">{pct}% · {Math.round(minutes)} min</Text>
            </View>
            <View className="h-2 bg-dark-card-alt rounded-full overflow-hidden">
              <View
                className={`h-full ${STRAND_COLOR[strand]}`}
                style={{ width: `${pct}%` }}
              />
            </View>
          </View>
        );
      })}
      {underweight && (
        <Text className="text-xs text-warning mt-1">
          Consider more {STRAND_LABELS[underweight].toLowerCase()} this week — you&apos;re a bit light there.
        </Text>
      )}
    </View>
  );
}
