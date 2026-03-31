import { View, Text } from 'react-native';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'streak';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary-tint', text: 'text-primary' },
  success: { bg: 'bg-success-bg', text: 'text-success' },
  warning: { bg: 'bg-warning-bg', text: 'text-warning' },
  streak: { bg: 'bg-warning-bg', text: 'text-streak' },
};

export function Badge({ label, variant = 'primary' }: BadgeProps) {
  const config = variantClasses[variant];
  return (
    <View className={`${config.bg} rounded-lg px-3 py-1`}>
      <Text className={`${config.text} text-xs font-sans-bold`}>{label}</Text>
    </View>
  );
}
