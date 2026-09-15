/**
 * Visual free-trial timeline for the paywall. See lib/trial-timeline.ts for why
 * this exists; the step math lives there so it can be tested without rendering.
 */
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { trialTimelineSteps } from '../../lib/trial-timeline';

interface TrialTimelineProps {
  /** Length of the free trial in days. */
  trialDays: number;
  /** Localized renewal price, e.g. "$59.99". */
  priceString: string;
}

export function TrialTimeline({ trialDays, priceString }: TrialTimelineProps) {
  const { c } = useUi2Theme();
  const steps = trialTimelineSteps(trialDays, priceString);

  return (
    <SlabCard
      style={{ padding: 20, marginBottom: 24 }}
      accessibilityRole="summary"
      accessibilityLabel={`How your ${trialDays}-day free trial works. ${steps
        .map((s) => `${s.title}: ${s.detail}`)
        .join(' ')}`}
    >
      <Text className="text-base font-semibold mb-4" style={{ color: c.ink }}>
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
                  backgroundColor: isLast ? c.yellowTint : c.primaryTint,
                }}
              >
                {/* `ink` on the yellow tint rather than `yellow` on it: the
                    renewal step has to stay visible in light mode, where the
                    two land near 1.7:1. The tint carries the distinction. */}
                <Ionicons
                  name={step.icon as never}
                  size={16}
                  color={isLast ? c.ink : c.onTint}
                />
              </View>
              {/* Connector between steps, omitted after the last one. */}
              {!isLast && (
                <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: c.cardBorder }} />
              )}
            </View>
            <View className={isLast ? 'flex-1' : 'flex-1 pb-4'}>
              <Text className="text-sm font-semibold" style={{ color: c.ink }}>{step.title}</Text>
              <Text className="text-sm mt-0.5" style={{ color: c.muted }}>{step.detail}</Text>
            </View>
          </View>
        );
      })}

      <Text className="text-sm mt-2" style={{ color: c.muted }}>
        Cancel in Settings → Subscription, or in your App Store account. Two taps,
        no email required.
      </Text>
    </SlabCard>
  );
}
