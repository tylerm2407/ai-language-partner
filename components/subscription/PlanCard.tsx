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
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { colors } from '../../config/theme';

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
  const features = PLAN_FEATURES[tier] ?? [];

  // Annual plans lead with their true per-month equivalent; the full amount
  // and billing term stay visible directly beneath it.
  const isAnnual = isAnnualPackage(pkg);
  const perMonthString = isAnnual ? pkg.product.pricePerMonthString : null;

  return (
    <View
      className={`rounded-2xl p-5 mb-4 border-2 ${
        isCurrentPlan
          ? 'border-success bg-success-bg'
          : isPopular
          ? 'border-primary bg-dark-card'
          : 'border-dark-border bg-dark-card'
      }`}
    >
      <View className="flex-row items-center gap-2 mb-2">
        {isCurrentPlan && <Badge variant="success" label="Current Plan" />}
        {isPopular && !isCurrentPlan && (
          <View className="bg-primary rounded-lg px-3 py-1">
            <Text className="text-white text-xs font-bold">MOST POPULAR</Text>
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap items-baseline mb-1">
        <Text className="text-2xl font-bold text-text-primary">
          {perMonthString ?? pkg.product.priceString}
        </Text>
        <Text className="text-sm text-text-secondary ml-1">
          /{isAnnual && perMonthString ? 'mo' : 'month'}
        </Text>
        {savingsPct > 0 && (
          <View className="bg-success-bg rounded-lg px-2 py-0.5 ml-2">
            <Text className="text-xs font-bold text-success">SAVE {savingsPct}%</Text>
          </View>
        )}
      </View>
      {isAnnual && (
        <Text className="text-sm text-text-secondary mb-1">
          Billed annually at {pkg.product.priceString}
        </Text>
      )}
      <Text className="text-lg font-semibold text-text-primary mb-3">{pkg.product.title}</Text>

      {features.map((feature, idx) => (
        <View key={idx} className="flex-row items-center mb-2">
          <Ionicons name="checkmark-circle" size={18} color={colors.success.light} />
          <Text className="flex-1 text-sm text-text-secondary ml-2">{feature}</Text>
        </View>
      ))}

      {!isCurrentPlan && (
        <View className="mt-4">
          <Button
            label={ctaLabel}
            variant={isPopular ? 'primary' : 'secondary'}
            onPress={onPurchase}
            loading={loading}
            disabled={disabled}
          />
        </View>
      )}
    </View>
  );
}
