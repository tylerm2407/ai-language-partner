import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

const VARIANTS: Record<string, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: '#6366F1' },
    text: { color: '#fff' },
  },
  secondary: {
    container: { backgroundColor: '#F3F4F6' },
    text: { color: '#111' },
  },
  danger: {
    container: { backgroundColor: '#FEE2E2' },
    text: { color: '#DC2626' },
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
}: ButtonProps) {
  const styles = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          paddingHorizontal: 24,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center' as const,
          opacity: disabled ? 0.5 : 1,
        },
        styles.container,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {loading ? (
        <ActivityIndicator color={styles.text.color} />
      ) : (
        <Text style={[{ fontSize: 16, fontWeight: '600' }, styles.text]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
