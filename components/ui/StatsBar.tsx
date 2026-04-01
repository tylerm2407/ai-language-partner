import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';

export function StatsBar() {
  const profile = useAppStore((s) => s.profile);
  const { hearts, isUnlimited } = useHearts();
  const insets = useSafeAreaInsets();

  const streak = profile?.streak ?? 0;
  const totalXp = profile?.totalXp ?? 0;

  return (
    <View style={{ backgroundColor: 'rgba(12, 15, 20, 0.95)', paddingTop: insets.top }}>
      <View className="flex-row items-center justify-around" style={{ height: 48 }}>
        {/* Streak */}
        <Pressable
          className="flex-row items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          accessibilityLabel={`${streak} day streak`}
          accessibilityRole="button"
        >
          <Ionicons name="flame" size={20} color="#FBBF24" />
          <Text
            className="ml-1"
            style={{ color: '#FBBF24', fontSize: 14, fontWeight: 'bold' }}
          >
            {streak}
          </Text>
        </Pressable>

        {/* XP */}
        <Pressable
          className="flex-row items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          accessibilityLabel={`${totalXp} total XP`}
          accessibilityRole="button"
        >
          <Ionicons name="flash" size={20} color="#38BDF8" />
          <Text
            className="ml-1"
            style={{ color: '#38BDF8', fontSize: 14, fontWeight: 'bold' }}
          >
            {totalXp}
          </Text>
        </Pressable>

        {/* Hearts */}
        <Pressable
          className="flex-row items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          accessibilityLabel={isUnlimited ? 'Unlimited hearts' : `${hearts} hearts remaining`}
          accessibilityRole="button"
        >
          <Ionicons name="heart" size={20} color="#EF4444" />
          <Text
            className="ml-1"
            style={{ color: '#EF4444', fontSize: 14, fontWeight: 'bold' }}
          >
            {isUnlimited ? '∞' : hearts}
          </Text>
        </Pressable>
      </View>

      {/* Gradient bottom border */}
      <LinearGradient
        colors={[GRADIENT_COLORS[0], GRADIENT_COLORS[1]]}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={{ height: 1 }}
      />
    </View>
  );
}
