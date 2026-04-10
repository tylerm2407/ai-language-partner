import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END, GLASS_BG, GLASS_HIGHLIGHT, GLASS_BORDER } from '../../config/gradients';

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
  innerBg = GLASS_BG,
  style,
  innerStyle,
}: GradientBorderCardProps) {
  const innerRadius = borderRadius - borderWidth;

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
            flex: 1,
            backgroundColor: innerBg,
            borderRadius: innerRadius,
            borderWidth: 1,
            borderColor: GLASS_BORDER,
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {/* Specular highlight sheen */}
        <LinearGradient
          colors={[...GLASS_HIGHLIGHT]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: innerRadius,
          }}
          pointerEvents="none"
        />
        {children}
      </View>
    </LinearGradient>
  );
}
