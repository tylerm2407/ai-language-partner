/**
 * PlanStepCard — one rung of the paywall ladder.
 *
 * Three of these stack in app/(app)/plans.tsx. Each shows the tier, its DAILY
 * price with the billed amount beside it, a capacity meter labelled in commute
 * terms, and what it adds over the rung below. Selection is controlled by the
 * parent.
 *
 * T4 · Pace (canvas Part 2, "Paywall · tint blocks", picked 2026-09-11): the
 * row is drawn in Home's unit-row language — a coloured badge on the left
 * carrying the one number Free actually meters, new words a day (20 on Basic,
 * no ceiling above), the tier's own tint on the badge and its meter, and the
 * selected rung in the violet tint with a violet edge. The numbers come from
 * lib/plans.ts, never typed here.
 *
 * Deliberately not a variant of components/subscription/PlanCard.tsx: that one
 * is a self-contained card with its own CTA and feature list, used by the
 * profile subscription screen. This is a radio row feeding one shared CTA.
 */
import { View, Text, Pressable } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { radii, spacing, typography } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { paceCopy, type PlanId } from '../../lib/plans';
import { perDayString, billedLine, CAPACITY, METER_BLOCKS, STEP_ADDS } from '../../lib/plan-pricing';

interface PlanStepCardProps {
  pkg: PurchasesPackage;
  tier: Exclude<PlanId, 'starter'>;
  selected: boolean;
  isPopular: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function PlanStepCard({ pkg, tier, selected, isPopular, onSelect, disabled }: PlanStepCardProps) {
  const { c } = useUi2Theme();
  const capacity = CAPACITY[tier];
  const name = tier === 'vip' ? 'VIP' : tier.charAt(0).toUpperCase() + tier.slice(1);
  const pace = paceCopy(tier);
  // Each rung has its own tint — violet, green, amber — on the badge and the
  // meter, so the ladder reads as three blocks rather than three greys.
  const tone =
    tier === 'basic'
      ? { bg: c.primaryTint, fg: c.onTint, meter: c.primary }
      : tier === 'premium'
        ? { bg: c.greenTint, fg: c.green, meter: c.green }
        : { bg: c.yellowTint, fg: c.ink, meter: c.yellow };

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${name}, ${pace.badge === '∞' ? 'no word ceiling' : `${pace.badge} new words a day`}, ${perDayString(pkg)} per day, ${billedLine(pkg)}. ${STEP_ADDS[tier]}`}
      style={{
        padding: spacing.md - 2,
        borderRadius: radii.xl,
        borderWidth: 1.5,
        backgroundColor: selected ? c.primaryTint : c.card,
        borderColor: selected ? c.primary : c.cardBorder,
        gap: spacing.sm - 2,
        // 44pt minimum target is satisfied by the row's own height (~96pt).
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            backgroundColor: tone.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: typography.family.extrabold,
              fontSize: pace.badge === '∞' ? 22 : 15,
              lineHeight: pace.badge === '∞' ? 26 : 20,
              color: tone.fg,
            }}
          >
            {pace.badge}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text
              style={{
                fontFamily: typography.family.extrabold,
                fontSize: 17,
                lineHeight: 22,
                color: c.ink,
              }}
            >
              {name}
            </Text>
            {isPopular && (
              <View
                style={{
                  paddingHorizontal: spacing.xs + 1,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                  backgroundColor: c.primaryTint,
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.family.monoMedium,
                    fontSize: 9,
                    lineHeight: 12,
                    letterSpacing: 1,
                    color: c.onTint,
                  }}
                >
                  MOST POPULAR
                </Text>
              </View>
            )}
          </View>
          {/* The billed amount sits beside the pace so the derived per-day
              figure is never the only price on screen (3.1.2). */}
          <Text
            style={{
              fontFamily: typography.family.semibold,
              fontSize: 12,
              lineHeight: 17,
              color: c.muted,
            }}
            numberOfLines={2}
          >
            {pace.line} · {billedLine(pkg)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: typography.family.display,
              fontSize: 20,
              lineHeight: 25,
              letterSpacing: -0.5,
              color: c.ink,
            }}
          >
            {perDayString(pkg)}
          </Text>
          <Text
            style={{
              fontFamily: typography.family.monoMedium,
              fontSize: 9,
              lineHeight: 12,
              letterSpacing: 1.2,
              color: c.muted,
            }}
          >
            PER DAY
          </Text>
        </View>
      </View>

      {/* Capacity meter. Decorative — the label beside it carries the meaning,
          and the row's accessibilityLabel already reads the numbers. */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: METER_BLOCKS }).map((_, i) => (
          <View
            key={i}
            style={{
              height: 6,
              flex: 1,
              borderRadius: 3,
              backgroundColor: i < capacity.fill ? tone.meter : c.trackOnCard,
            }}
          />
        ))}
        <Text
          style={{
            fontFamily: typography.family.monoMedium,
            fontSize: 9,
            lineHeight: 12,
            letterSpacing: 1,
            color: c.muted,
            marginLeft: 6,
          }}
        >
          {capacity.label}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: typography.family.semibold,
          fontSize: 12,
          lineHeight: 17,
          color: c.muted,
        }}
      >
        {STEP_ADDS[tier]}
      </Text>
    </Pressable>
  );
}
