/**
 * Ui2ListRow — the tappable settings/list row.
 *
 * Modelled on what `app/(app)/profile/settings.tsx` builds by hand today:
 * every row there is the same `<Pressable className="bg-dark-card rounded-2xl
 * p-5 flex-row items-center">` with a 24px leading icon, a title, sometimes a
 * second line, and sometimes a trailing glyph. Copied nine times, they had
 * already drifted — the legal rows carry an `open-outline`, the AI-consent row
 * carries nothing, and the trailing glyph is tinted with
 * `colors.correctionChip.grammar.text`, a token borrowed from an unrelated
 * feature because it happened to be the right grey.
 *
 * So this is not a mirror of one old component but the shape those rows were
 * converging on, with the two things they kept getting wrong made structural:
 *
 *   - `role` drives BOTH the accessibility role and the trailing glyph, so a
 *     row that leaves the app can no longer announce itself as a button while
 *     showing an external-link arrow, or the reverse.
 *   - A row with no `onPress` renders as a plain View. A Pressable with an
 *     undefined handler still takes focus and still announces as a button,
 *     which is how a read-only row ends up promising a tap that does nothing.
 *
 * The press sinks the slab into its bottom edge, the same gesture as
 * `SlabButton`, so the row reads as the same material as the rest of UI 2.0.
 */
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Body, Caption } from './Ui2Text';

export type Ui2ListRowRole = 'button' | 'link';

interface Ui2ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading glyph. Rows in a group should either all have one or none. */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** 'link' for rows that leave the app (a web page, the OS settings). */
  role?: Ui2ListRowRole;
  /** Trailing slot — a switch, a value, a badge. Replaces the default glyph. */
  right?: ReactNode;
  /**
   * Destructive actions (sign out, delete account). Tints the icon and title
   * `error`; the words still say what it does, so colour is never the only cue.
   */
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Which glyph closes the row, given its role and whether it is tappable.
 * Pure so the "a non-tappable row shows no affordance" rule can be asserted
 * without a render harness.
 */
export function trailingGlyph(
  role: Ui2ListRowRole,
  tappable: boolean,
): keyof typeof Ionicons.glyphMap | null {
  if (!tappable) return null;
  return role === 'link' ? 'open-outline' : 'chevron-forward';
}

const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

export function Ui2ListRow({
  title,
  subtitle,
  icon,
  onPress,
  role = 'button',
  right,
  destructive,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Ui2ListRowProps) {
  const { c, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const pressed = useSharedValue(0);

  const tappable = !!onPress && !disabled;
  const sink = shape.slab - shape.slabPressed;

  const onPressIn = useCallback(() => {
    haptic('select');
    pressed.value = shouldReduce ? 1 : withSpring(1, PRESS_SPRING);
  }, [pressed, shouldReduce]);
  const onPressOut = useCallback(() => {
    pressed.value = shouldReduce ? 0 : withSpring(0, PRESS_SPRING);
  }, [pressed, shouldReduce]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * sink }],
    borderBottomWidth: shape.slab - pressed.value * sink,
  }));

  const accent = destructive ? c.error : c.onTint;
  const glyph = trailingGlyph(role, tappable);

  const body = (
    // The slab lives in a wrapper so the sink does not shift the row below it.
    <View style={{ paddingBottom: shape.slab }}>
      <Animated.View
        style={[
          styles.row,
          {
            backgroundColor: c.card,
            borderColor: c.cardBorder,
            borderWidth: shape.border,
            borderRadius: shape.radiusCard,
            marginBottom: -shape.slab,
            opacity: disabled ? 0.5 : 1,
          },
          animated,
        ]}
      >
        {icon ? (
          <View style={[styles.iconWell, { backgroundColor: destructive ? c.pinkTint : c.primaryTint }]}>
            <Ionicons name={icon} size={20} color={accent} />
          </View>
        ) : null}

        <View style={styles.text}>
          <Body weight="bold" tone={destructive ? 'error' : 'primary'}>
            {title}
          </Body>
          {subtitle ? <Caption tone="secondary">{subtitle}</Caption> : null}
        </View>

        {right ?? (glyph ? <Ionicons name={glyph} size={18} color={c.idle} /> : null)}
      </Animated.View>
    </View>
  );

  if (!tappable) {
    // Not a Pressable at all — see the header comment.
    return <View style={style}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      style={style}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // 44pt is the floor; 60 gives a two-line row room without reflowing.
    minHeight: 60,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
});
