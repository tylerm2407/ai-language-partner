import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="bg-dark-card rounded-2xl p-8 items-center">
      <Ionicons name={icon} size={48} color="#7DD3FC" />
      <Text className="text-lg font-sans-semibold text-text-primary mt-4 mb-2">{title}</Text>
      <Text className="text-sm font-sans text-text-secondary text-center mb-4">{description}</Text>
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="primary" onPress={onAction} />
      )}
    </View>
  );
}
