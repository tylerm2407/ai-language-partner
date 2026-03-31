import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StreakShieldBadgeProps {
  active: boolean;
}

export function StreakShieldBadge({ active }: StreakShieldBadgeProps) {
  if (!active) return null;

  return (
    <View className="flex-row items-center gap-1" style={{ backgroundColor: '#F59E0B20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Ionicons name="shield-checkmark" size={12} color="#F59E0B" />
      <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '700' }}>PROTECTED</Text>
    </View>
  );
}
