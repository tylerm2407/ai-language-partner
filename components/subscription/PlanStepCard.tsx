/**
 * PlanStepCard — one rung of the paywall ladder (design 7c).
 *
 * Three of these stack in app/(app)/plans.tsx. Each shows the tier, what it
 * adds over the rung below, its DAILY price, and a capacity meter labelled in
 * commute terms. Selection is controlled by the parent.
 *
 * Deliberately not a variant of components/subscription/PlanCard.tsx: that one
 * is a self-contained card with its own CTA and feature list, used by the
 * profile subscription screen. This is a radio row feeding one shared CTA.
 */
import { View, Text, Pressable } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { colors, radii, spacing, typography } from '../../config/theme';
import type { PlanId } from '../../lib/plans';
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
  const capacity = CAPACITY[tier];
  const name = tier === 'vip' ? 'VIP' : tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${name}, ${perDayString(pkg)} per day, ${billedLine(pkg)}. ${STEP_ADDS[tier]}`}
      style={{
        padding: spacing.md - 2,
        borderRadius: radii.xl,
        borderWidth: 1.5,
        backgroundColor: selected ? colors.action.primaryTint : colors.surface.raised,
        borderColor: selected ? colors.action.primaryBorder : colors.border.subtle,
        // 44pt minimum target is satisfied by the row's own height (~86pt).
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text
              style={{
                fontFamily: typography.family.extrabold,
                fontSize: 15,
                lineHeight: 21,
                color: colors.text.primary,
              }}
            >
              {name}
            </Text>
            {isPopular && (
              <View
                style={{
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 3,
                  borderRadius: radii.sm - 1,
                  backgroundColor: colors.action.primaryTint,
                  borderWidth: 1,
                  borderColor: colors.action.primaryBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.family.monoMedium,
                    fontSize: 9,
                    lineHeight: 12,
                    letterSpacing: 1,
                    color: colors.indigo[300],
                  }}
                >
                  MOST POPULAR
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{
              fontFamily: typography.family.semibold,
              fontSize: 12,
              lineHeight: 17,
              color: colors.text.tertiary,
              marginTop: 4,
            }}
          >
            {STEP_ADDS[tier]}
          </Text>
        </View>

        {/* Daily figure leads; the billed amount sits directly beneath it so the
            derived number is never the only price on screen (3.1.2). */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: typography.family.display,
              fontSize: 20,
              lineHeight: 25,
              letterSpacing: -0.5,
              color: colors.text.onPrimary,
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
              color: colors.text.quaternary,
            }}
          >
            PER DAY
          </Text>
        </View>
      </View>

      {/* Capacity meter. Decorative — the label beside it carries the meaning,
          and the row's accessibilityLabel already reads the numbers. */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 11 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: METER_BLOCKS }).map((_, i) => (
          <View
            key={i}
            style={{
              height: 7,
              flex: 1,
              borderRadius: 2,
              backgroundColor: i < capacity.fill ? colors.action.accent : colors.surface.track,
            }}
          />
        ))}
        <Text
          style={{
            fontFamily: typography.family.monoMedium,
            fontSize: 9,
            lineHeight: 12,
            letterSpacing: 1,
            color: colors.text.tertiary,
            marginLeft: 6,
          }}
        >
          {capacity.label}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: typography.family.monoMedium,
          fontSize: 10,
          lineHeight: 14,
          color: colors.text.quaternary,
          marginTop: 9,
        }}
      >
        {billedLine(pkg)}
      </Text>
    </Pressable>
  );
}
