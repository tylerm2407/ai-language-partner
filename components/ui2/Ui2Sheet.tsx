/**
 * Ui2Sheet — the UI 2.0 counterpart to `components/ui/Sheet.tsx`.
 *
 * Same props ({ visible, onDismiss, children, dismissOnBackdrop, height,
 * style }), same `height: number | 'auto'` contract, and the same behaviour on
 * a pinned height: the content wrapper only becomes `flex: 1` when a height was
 * actually pinned. That carve-out is load-bearing — without it a caller that
 * passes `height` gets a tall sheet with its children collapsed at the top,
 * which is exactly what happened to the avatar grid — so it is carried across
 * verbatim rather than tidied away.
 *
 * WHERE THE SCRIM COLOUR COMES FROM
 *
 * Dark Glow had a `colors.surface.overlay` token; UI 2.0's palette has no
 * overlay entry, and inventing an `rgba(0,0,0,.5)` here would be the same
 * hardcoded-colour mistake this migration exists to undo. So the scrim is
 * derived from the palette instead: `ink` in light (a near-black navy) and
 * `bg` in dark (the near-black violet ground), each dimmed with `opacity`.
 * Both are dark in their own scheme, which is the property a scrim needs.
 * Using `ink` in BOTH would paint a white veil in dark mode — `ink` inverts
 * between schemes and `opacity` does not care, which is the trap here.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme, type Ui2Scheme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';

interface Ui2SheetProps {
  visible: boolean;
  onDismiss?: () => void;
  children: ReactNode;
  /** When true, backdrop tap dismisses. Default: true. */
  dismissOnBackdrop?: boolean;
  /** Pin the sheet height to a specific value; otherwise fits content. */
  height?: number | 'auto';
  /**
   * Lift the sheet above the keyboard. Off by default, because a sheet with no
   * text field gains nothing from a KeyboardAvoidingView and every existing
   * caller is one of those — opting in keeps their layout byte-identical.
   *
   * A sheet is pinned to the bottom of the screen, so the keyboard covers it
   * completely: without this, the learner types into a field they cannot see
   * and reaches for a Save button that is not on screen.
   */
  avoidKeyboard?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCRIM_OPACITY = 0.55;

/** Pure so both schemes can be asserted without a render harness. */
export function scrimColor(scheme: Ui2Scheme, c: Ui2Palette): string {
  return scheme === 'dark' ? c.bg : c.ink;
}

export function Ui2Sheet({
  visible,
  onDismiss,
  children,
  dismissOnBackdrop = true,
  height = 'auto',
  avoidKeyboard = false,
  style,
}: Ui2SheetProps) {
  const { c, scheme, shape } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // No exit animation: the Modal unmounts on the same frame, so animating
      // out would only be visible as a flicker. Reset so the next open starts
      // from off-screen.
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      return;
    }
    if (shouldReduce) {
      translateY.setValue(0);
      backdropOpacity.setValue(SCRIM_OPACITY);
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: duration.medium,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: SCRIM_OPACITY,
        duration: duration.medium,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, shouldReduce, duration, translateY, backdropOpacity]);

  const pinned = height !== 'auto';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: scrimColor(scheme, c), opacity: backdropOpacity },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onDismiss : undefined}
          disabled={!dismissOnBackdrop || !onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />
      </Animated.View>

      <KeyboardAvoidingView
        // `pointerEvents: box-none` so the backdrop behind it still receives the
        // dismiss tap: this view spans the screen whenever it is doing its job.
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, avoidKeyboard && styles.avoiding]}
        behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={avoidKeyboard}
      >
        <Animated.View
          style={[
            styles.sheet,
            // Absolute positioning is what makes a sheet a sheet, and it is
            // also what makes KeyboardAvoidingView useless: the padding it adds
            // is on the wrapper, and `bottom: 0` pins the child past it, so the
            // keyboard lands on top of the field the learner is typing into.
            // When avoidance is on, the sheet becomes an ordinary flex child of
            // a bottom-justified wrapper instead — same place on screen, but it
            // now moves when the wrapper shrinks.
            avoidKeyboard && styles.sheetInFlow,
            {
              backgroundColor: c.card,
              borderColor: c.cardBorder,
              borderTopWidth: shape.border,
              borderTopLeftRadius: shape.radiusHero,
              borderTopRightRadius: shape.radiusHero,
            },
            pinned ? { height } : undefined,
            { transform: [{ translateY }] },
            style,
          ]}
        >
          <View style={styles.grabberWrapper}>
            <View style={[styles.grabber, { backgroundColor: c.idle }]} />
          </View>
          <View style={[styles.content, pinned && styles.contentFilled]}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingBottom: 32,
  },
  /** Bottom-justified so the in-flow sheet sits where the absolute one did. */
  avoiding: { justifyContent: 'flex-end' },
  sheetInFlow: { position: 'relative' },
  grabberWrapper: { alignItems: 'center', marginBottom: 12 },
  grabber: { width: 40, height: 4, borderRadius: 999 },
  content: { paddingHorizontal: 24 },
  /** Only with a pinned `height` — lets children lay out against the full sheet. */
  contentFilled: { flex: 1 },
});
