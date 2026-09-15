/**
 * One purchasable plan. Shared by the profile subscription screen and the
 * post-signup paywall so the two can never disagree about how a price is
 * presented — an annual card showing a monthly label is a 3.1.2 problem, and
 * the surest way to get one is to maintain the markup in two places.
 */
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { isAnnualPackage } from '../../lib/purchases';
import { PLAN_FEATURES, type PlanId } from '../../lib/plans';
import { SlabButton } from '../ui2/SlabButton';
import { SlabCard } from '../ui2/SlabCard';
import { Ui2Badge } from '../ui2/Ui2Badge';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface PlanCardProps {
  pkg: PurchasesPackage;
  tier: PlanId;
  isCurrentPlan: boolean;
  isPopular: boolean;
  /** Whole-percent saving vs twelve monthly payments; 0 hides the badge. */
  savingsPct: number;
  onPurchase: () => void;
  loading: boolean;
  disabled: boolean;
  ctaLabel?: string;
}

export function PlanCard({
  pkg,
  tier,
  isCurrentPlan,
  isPopular,
  savingsPct,
  onPurchase,
  loading,
  disabled,
  ctaLabel = 'Subscribe',
}: PlanCardProps) {
  const { c } = useUi2Theme();
  const features = PLAN_FEATURES[tier] ?? [];

  // Annual plans lead with their true per-month equivalent; the full amount
  // and billing term stay visible directly beneath it.
  const isAnnual = isAnnualPackage(pkg);
  const perMonthString = isAnnual ? pkg.product.pricePerMonthString : null;

  return (
    // The state that used to be a border colour is now the slab's TINT, and
    // the "Current Plan" badge still spells it out — plan state is never
    // carried by colour alone.
    <SlabCard
      tint={isCurrentPlan ? 'green' : isPopular ? 'primary' : 'card'}
      style={{ padding: 20, marginBottom: 16 }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        {isCurrentPlan && <Ui2Badge variant="success" label="Current Plan" />}
        {isPopular && !isCurrentPlan && (
          <View className="rounded-lg px-3 py-1" style={{ backgroundColor: c.primary }}>
            <Text className="text-xs font-bold" style={{ color: c.onPrimary }}>MOST POPULAR</Text>
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap items-baseline mb-1">
        <Text className="text-2xl font-bold" style={{ color: c.ink }}>
          {perMonthString ?? pkg.product.priceString}
        </Text>
        <Text className="text-sm ml-1" style={{ color: c.muted }}>
          /{isAnnual && perMonthString ? 'mo' : 'month'}
        </Text>
        {savingsPct > 0 && (
          <View className="rounded-lg px-2 py-0.5 ml-2" style={{ backgroundColor: c.greenTint }}>
            <Text className="text-xs font-bold" style={{ color: c.ink }}>SAVE {savingsPct}%</Text>
          </View>
        )}
      </View>
      {isAnnual && (
        <Text className="text-sm mb-1" style={{ color: c.muted }}>
          Billed annually at {pkg.product.priceString}
        </Text>
      )}
      <Text className="text-lg font-semibold mb-3" style={{ color: c.ink }}>{pkg.product.title}</Text>

      {features.map((feature, idx) => (
        <View key={idx} className="flex-row items-center mb-2">
          <Ionicons name="checkmark-circle" size={18} color={c.green} />
          <Text className="flex-1 text-sm ml-2" style={{ color: c.muted }}>{feature}</Text>
        </View>
      ))}

      {!isCurrentPlan && (
        <View className="mt-4">
          {/* UI 2.0 has no filled "secondary": the popular card is already set
              apart by its tint and badge, and a ghost CTA on a purchase card
              would read as the weaker of two real actions. */}
          <SlabButton
            label={ctaLabel}
            variant="primary"
            onPress={onPurchase}
            loading={loading}
            disabled={disabled}
            arrow={false}
          />
        </View>
      )}
    </SlabCard>
  );
}
