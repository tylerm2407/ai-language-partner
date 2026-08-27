import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../config/theme';

interface HeartsDisplayProps {
  hearts: number;
  maxHearts: number;
  isUnlimited: boolean;
  /** Glyph size. 18 is the standard; the Home stats row uses 16 to sit level
   *  with the XP chip beside it. */
  size?: number;
}

export function HeartsDisplay({ hearts, maxHearts, isUnlimited, size = 18 }: HeartsDisplayProps) {
  if (isUnlimited) {
    return (
      <View className="flex-row items-center gap-1">
        <Ionicons name="heart" size={size} color={colors.heart.filled} />
        <Text
          style={{
            color: colors.heart.filled,
            fontSize: 16,
            fontFamily: typography.family.bold,
          }}
        >
          ∞
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < hearts ? 'heart' : 'heart-outline'}
          size={size}
          color={i < hearts ? colors.heart.filled : colors.heart.empty}
        />
      ))}
    </View>
  );
}
