/**
 * OptionRow — a selectable slab card for pickers.
 *
 * Selected state is "pressed in": the card sits 3px lower on a 2px slab
 * instead of 5px, tinted, with a check that pops in with overshoot. Rows
 * cascade in 40ms apart on mount (`index`), which is the Duolingo/Speak
 * rhythm the onboarding boards specified. Every motion gates on Reduce Motion.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface OptionRowProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  /** Position in the list; drives the entrance stagger. */
  index?: number;
  /** Leading slot: flag tile, signal bars, a chip. */
  lead?: React.ReactNode;
  /** Trailing slot shown when NOT selected (the check replaces it). */
  trail?: React.ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const SELECT_SPRING = { damping: 16, stiffness: 300, mass: 0.7 };
const POP_SPRING = { damping: 12, stiffness: 420, mass: 0.6 };
export const ROW_STAGGER_MS = 40;

export function OptionRow({
  title,
  subtitle,
  selected,
  onSelect,
  index = 0,
  lead,
  trail,
  accessibilityLabel,
  style,
}: OptionRowProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const sel = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (shouldReduce) {
      sel.value = selected ? 1 : 0;
      pop.value = selected ? 1 : 0;
      return;
    }
    sel.value = withSpring(selected ? 1 : 0, SELECT_SPRING);
    pop.value = selected ? withSpring(1, POP_SPRING) : 0;
  }, [selected, shouldReduce, sel, pop]);

  const sink = shape.slab - shape.slabPressed;
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sel.value * sink }],
    borderBottomWidth: shape.slab - sel.value * sink,
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    opacity: pop.value > 0.05 ? 1 : 0,
  }));

  const entering = shouldReduce ? undefined : FadeInDown.delay(80 + index * ROW_STAGGER_MS).duration(360);

  return (
    <Animated.View entering={entering} style={style}>
      <Pressable
        onPress={() => {
          haptic('select');
          onSelect();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}: ${subtitle}` : title)}
        accessibilityState={{ selected }}
      >
        <View style={{ paddingBottom: shape.slab }}>
          <Animated.View
            style={[
              styles.row,
              {
                backgroundColor: selected ? c.primaryTint : c.card,
                borderColor: selected ? c.primary : c.cardBorder,
                borderWidth: shape.border,
                borderRadius: shape.radiusCard,
                marginBottom: -shape.slab,
              },
              cardStyle,
            ]}
          >
            {lead}
            <View style={styles.text}>
              <Text style={{ fontFamily: type.uiHeavy, fontSize: 16, lineHeight: 22, color: c.ink }}>{title}</Text>
              {subtitle ? (
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>{subtitle}</Text>
              ) : null}
            </View>
            {selected ? (
              <Animated.View style={[styles.check, { backgroundColor: c.primary }, checkStyle]}>
                <Ionicons name="checkmark" size={16} color={c.onPrimary} />
              </Animated.View>
            ) : (
              trail
            )}
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
