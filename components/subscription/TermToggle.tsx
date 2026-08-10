/**
 * Monthly / Annual segmented control for the paywall. Annual carries the
 * saving badge because that is the term we want chosen, and a discount the
 * learner has to switch terms to discover is a discount that does not convert.
 */
import { View, Text, Pressable } from 'react-native';

export type BillingTerm = 'monthly' | 'annual';

interface TermToggleProps {
  term: BillingTerm;
  onChange: (term: BillingTerm) => void;
  /** Best saving across the annual plans; 0 hides the badge. */
  savingsPct?: number;
}

const OPTIONS: { value: BillingTerm; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

export function TermToggle({ term, onChange, savingsPct = 0 }: TermToggleProps) {
  return (
    <View
      className="flex-row rounded-2xl p-1 mb-4 bg-dark-card-alt border border-dark-border"
      accessibilityRole="tablist"
    >
      {OPTIONS.map((opt) => {
        const selected = term === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              opt.value === 'annual' && savingsPct > 0
                ? `Annual billing, save ${savingsPct} percent`
                : `${opt.label} billing`
            }
            // 44pt minimum touch target (Apple HIG).
            className={`flex-1 flex-row items-center justify-center rounded-xl py-3 min-h-[44px] ${
              selected ? 'bg-primary' : ''
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                selected ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {opt.label}
            </Text>
            {opt.value === 'annual' && savingsPct > 0 && (
              <View
                className={`rounded-lg px-2 py-0.5 ml-2 ${
                  selected ? 'bg-white/20' : 'bg-success-bg'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${selected ? 'text-white' : 'text-success'}`}
                >
                  −{savingsPct}%
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
