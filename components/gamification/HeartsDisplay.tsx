import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeartsDisplayProps {
  hearts: number;
  maxHearts: number;
  isUnlimited: boolean;
}

export function HeartsDisplay({ hearts, maxHearts, isUnlimited }: HeartsDisplayProps) {
  if (isUnlimited) {
    return (
      <View className="flex-row items-center gap-1">
        <Ionicons name="heart" size={18} color="#EF4444" />
        <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>∞</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < hearts ? 'heart' : 'heart-outline'}
          size={18}
          color={i < hearts ? '#EF4444' : '#64748B'}
        />
      ))}
    </View>
  );
}
