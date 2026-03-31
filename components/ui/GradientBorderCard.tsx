import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END, DARK_CARD } from '../../config/gradients';

interface GradientBorderCardProps {
  children: React.ReactNode;
  borderWidth?: number;
  borderRadius?: number;
  innerBg?: string;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
}

export function GradientBorderCard({
  children,
  borderWidth = 1.5,
  borderRadius = 18,
  innerBg = DARK_CARD,
  style,
  innerStyle,
}: GradientBorderCardProps) {
  return (
    <LinearGradient
      colors={[...GRADIENT_COLORS]}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[{ borderRadius, padding: borderWidth }, style]}
    >
      <View
        style={[
          {
            backgroundColor: innerBg,
            borderRadius: borderRadius - borderWidth,
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}
