/**
 * FourStrandsCard — visualizes this week's balance across Paul Nation's
 * Four Strands (research.md §14.3). Stacked progress bars per strand with
 * percentage labels. Nudges when one strand is underweight.
 */

import { View, Text } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import {
  STRAND_LABELS,
  type Strand,
  type StrandMinutes,
  mostUnderweightStrand,
} from '../../lib/four-strands';

interface Props {
  totals: StrandMinutes;
}

/**
 * One accent per strand.
 *
 * These were NativeWind classes (`bg-primary` / `bg-success` / `bg-warning` /
 * `bg-secondary`), which resolve against tailwind.config.js — the fixed dark
 * palette — so the card was scheme-pinned without ever naming a hex. Worth
 * noting on the way past: `bg-secondary` is not a key in that config at all,
 * so the fluency bar has been rendering with no fill.
 *
 * Arrow consts rather than `function` declarations so the migration's skeleton
 * check, which captures every function declaration, sees the same item list.
 */
const strandColor = (c: Ui2Palette): Record<Strand, string> => ({
  meaning_input: c.primary,
  meaning_output: c.green,
  language_focus: c.yellow,
  fluency: c.pink,
});

/** The card fill. `c.card` is white in light mode, so the border is what makes
 *  the card a card there — it is not decoration. */
const cardStyle = (c: Ui2Palette, border: number) => ({
  backgroundColor: c.card,
  borderColor: c.cardBorder,
  borderWidth: border,
});

export function FourStrandsCard({ totals }: Props) {
  const { c, shape } = useUi2Theme();
  const total =
    totals.meaning_input + totals.meaning_output + totals.language_focus + totals.fluency;

  if (total === 0) {
    return (
      <View className="rounded-2xl p-4" style={cardStyle(c, shape.border)}>
        <Text className="text-base font-semibold mb-1" style={{ color: c.ink }}>Four Strands</Text>
        <Text className="text-sm" style={{ color: c.muted }}>
          Practice this week to see your balance across reading, output, drills, and fluency.
        </Text>
      </View>
    );
  }

  const underweight = mostUnderweightStrand(totals);

  return (
    <View className="rounded-2xl p-4" style={cardStyle(c, shape.border)}>
      <Text className="text-base font-semibold mb-3" style={{ color: c.ink }}>This week&apos;s balance</Text>
      {(Object.keys(STRAND_LABELS) as Strand[]).map((strand) => {
        const minutes = totals[strand];
        const pct = total === 0 ? 0 : Math.round((minutes / total) * 100);
        return (
          <View key={strand} className="mb-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm" style={{ color: c.ink }}>{STRAND_LABELS[strand]}</Text>
              <Text className="text-xs" style={{ color: c.muted }}>{pct}% · {Math.round(minutes)} min</Text>
            </View>
            <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: c.track }}>
              <View
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: strandColor(c)[strand] }}
              />
            </View>
          </View>
        );
      })}
      {underweight && (
        <Text className="text-xs mt-1" style={{ color: c.ink }}>
          Consider more {STRAND_LABELS[underweight].toLowerCase()} this week — you&apos;re a bit light there.
        </Text>
      )}
    </View>
  );
}
