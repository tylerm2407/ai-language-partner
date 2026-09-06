/**
 * StepHeader — back chevron, springy progress bar, "n / total".
 * The bar animates to the new width on every step change.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface StepHeaderProps {
  step: number;
  total: number;
  onBack?: () => void;
}

export function StepHeader({ step, total, onBack }: StepHeaderProps) {
  const { c, type } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const pct = Math.max(0, Math.min(1, step / total));
  const width = useSharedValue(pct);

  useEffect(() => {
    width.value = shouldReduce ? pct : withSpring(pct, { damping: 18, stiffness: 140 });
  }, [pct, shouldReduce, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptic('buttonPress');
          onBack?.();
        }}
        disabled={!onBack}
        style={[styles.back, { opacity: onBack ? 1 : 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityElementsHidden={!onBack}
      >
        <Ionicons name="chevron-back" size={22} color={c.muted} />
      </Pressable>
      <View
        style={[styles.track, { backgroundColor: c.track }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: step }}
      >
        <Animated.View style={[styles.fill, { backgroundColor: c.primary }, fill]} />
      </View>
      <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.muted, width: 40, textAlign: 'right' }}>
        {step} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
});
