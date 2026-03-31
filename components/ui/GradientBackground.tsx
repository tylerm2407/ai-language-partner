import { type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BG_GRADIENT_COLORS } from '../../config/gradients';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  return (
    <LinearGradient
      colors={[...BG_GRADIENT_COLORS]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}
