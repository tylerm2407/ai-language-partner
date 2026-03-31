import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLeagueConfig } from '../../lib/levels';
import type { LeagueTier } from '../../lib/levels';

interface LeagueBadgeProps {
  tier: LeagueTier;
  size?: 'small' | 'medium';
}

export function LeagueBadge({ tier, size = 'medium' }: LeagueBadgeProps) {
  const config = getLeagueConfig(tier);
  const iconSize = size === 'small' ? 14 : 18;
  const textSize = size === 'small' ? 12 : 14;

  return (
    <View
      className="flex-row items-center"
      style={{
        backgroundColor: config.color + '20',
        borderRadius: 8,
        paddingHorizontal: size === 'small' ? 8 : 10,
        paddingVertical: size === 'small' ? 3 : 5,
      }}
    >
      <Ionicons name="shield" size={iconSize} color={config.color} />
      <Text style={{ color: config.color, fontSize: textSize, fontWeight: '700', marginLeft: 4 }}>
        {config.label}
      </Text>
    </View>
  );
}
