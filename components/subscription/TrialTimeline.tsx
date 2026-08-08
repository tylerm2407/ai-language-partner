/**
 * Visual free-trial timeline for the paywall. See lib/trial-timeline.ts for why
 * this exists; the step math lives there so it can be tested without rendering.
 */
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../config/theme';
import { trialTimelineSteps } from '../../lib/trial-timeline';

interface TrialTimelineProps {
  /** Length of the free trial in days. */
  trialDays: number;
  /** Localized renewal price, e.g. "$59.99". */
  priceString: string;
}

export function TrialTimeline({ trialDays, priceString }: TrialTimelineProps) {
  const steps = trialTimelineSteps(trialDays, priceString);

  return (
    <View
      className="rounded-2xl p-5 mb-6"
      style={{ backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.default }}
      accessibilityRole="summary"
      accessibilityLabel={`How your ${trialDays}-day free trial works. ${steps
        .map((s) => `${s.title}: ${s.detail}`)
        .join(' ')}`}
    >
      <Text className="text-base font-semibold text-text-primary mb-4">
        How your {trialDays}-day free trial works
      </Text>

      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          // The row itself is hidden from screen readers — the container above
          // carries the whole timeline as one label, so VoiceOver reads it as a
          // single coherent explanation instead of six disconnected fragments.
          <View key={step.day} className="flex-row" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View className="items-center mr-3">
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isLast ? colors.premium.tint : colors.action.primaryTint,
                }}
              >
                <Ionicons
                  name={step.icon as never}
                  size={16}
                  color={isLast ? colors.premium.base : colors.action.accent}
                />
              </View>
              {/* Connector between steps, omitted after the last one. */}
              {!isLast && (
                <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: colors.border.default }} />
              )}
            </View>
            <View className={isLast ? 'flex-1' : 'flex-1 pb-4'}>
              <Text className="text-sm font-semibold text-text-primary">{step.title}</Text>
              <Text className="text-sm text-text-secondary mt-0.5">{step.detail}</Text>
            </View>
          </View>
        );
      })}

      <Text className="text-sm text-text-secondary mt-2">
        Cancel in Settings → Subscription, or in your App Store account. Two taps,
        no email required.
      </Text>
    </View>
  );
}
