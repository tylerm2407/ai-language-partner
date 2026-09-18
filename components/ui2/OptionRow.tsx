/**
 * OptionRow — a selectable slab card for pickers.
 *
 * Selected state inverts the block: solid primary fill, white text, and a
 * white check that pops in with overshoot (Tint blocks, 2026-09-07 — it used
 * to sink onto a slab, which read as Duolingo). Rows cascade in 40ms apart on
 * mount (`index`). Every motion gates on Reduce Motion.
 *
 * The `lead` slot renders as given: a lead that paints in `c.primary` will
 * vanish on the selected fill, so pass it `selected` and let it swap to
 * `c.onPrimary` (see `BandTile` in onboarding).
 */
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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
  /**
   * Opens under the row while it is selected — the one place a picker can
   * say what the choice means without lengthening every row (the onboarding
   * level step's can-do line). Paints on the primary fill, so give it
   * `c.onPrimary` text.
   */
  detail?: React.ReactNode;
  /**
   * Grid-tile density for short labels in a two-column grid: tighter padding,
   * one-line title, and no trailing check — the solid fill already says
   * "selected", and a 170px tile has no room for a 26px disc beside a word
   * like "Portuguese".
   */
  tile?: boolean;
  accessibilityLabel?: string;
  /**
   * Screen-reader role. 'button' (default) for a one-shot pick; 'radio' or
   * 'checkbox' for a choice list, where the state is read as checked.
   */
  role?: 'button' | 'radio' | 'checkbox';
  /** Not pressable (an action is in flight); announced as dimmed. */
  disabled?: boolean;
  style?: ViewStyle;
}

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
  detail,
  accessibilityLabel,
  role = 'button',
  disabled = false,
  style,
  tile = false,
}: OptionRowProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const pop = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (shouldReduce) {
      pop.value = selected ? 1 : 0;
      return;
    }
    pop.value = selected ? withSpring(1, POP_SPRING) : 0;
  }, [selected, shouldReduce, pop]);

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
        disabled={disabled}
        // iOS has no radio or checkbox trait: React Native maps those roles to
        // no trait at all, so VoiceOver would drop "button" and the row would
        // read as static text. On iOS a choice row stays a button and says
        // "checked"/"unchecked" through its state; Android keeps the real role.
        accessibilityRole={role !== 'button' && Platform.OS === 'ios' ? 'button' : role}
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}: ${subtitle}` : title)}
        accessibilityState={role === 'button' ? { selected, disabled } : { checked: selected, disabled }}
        style={disabled ? styles.disabled : undefined}
      >
        <Animated.View
          style={[
            styles.block,
            {
              backgroundColor: selected ? c.primary : c.card,
              borderRadius: shape.radiusCard,
            },
          ]}
        >
          <View style={[styles.row, tile && styles.tileRow]}>
            {lead}
            <View style={styles.text}>
              <Text
                numberOfLines={tile ? 1 : undefined}
                style={{ fontFamily: type.uiHeavy, fontSize: tile ? 15 : 16, lineHeight: 22, color: selected ? c.onPrimary : c.ink }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: selected ? c.onPrimaryMuted : c.muted }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {selected && !tile ? (
              <Animated.View style={[styles.check, { backgroundColor: c.onPrimary }, checkStyle]}>
                <Ionicons name="checkmark" size={16} color={c.primary} />
              </Animated.View>
            ) : (
              trail
            )}
          </View>
          {selected && detail ? <View style={styles.detail}>{detail}</View> : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.55 },
  block: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  tileRow: { gap: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 64 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  detail: { paddingHorizontal: 16, paddingBottom: 14, marginTop: -4 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
