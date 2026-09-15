/**
 * Sheet — bottom-anchored modal.
 *
 * Slides up from the bottom safe area. Dismissible via backdrop tap,
 * swipe-down, or an explicit close button. Used for correct/incorrect
 * feedback, new-card limit prompts, achievement reveals, join-class,
 * avatar-customizer, settings, etc.
 *
 * Animation honors useMotion; reduced-motion collapses to a dissolve.
 *
 * UI 2.0: the sheet is a slab — `card` fill, `cardBorder` top edge at
 * `shape.border` — and the scrim is the palette-derived one from
 * `components/ui2/Ui2Sheet`, imported rather than re-derived so the two sheets
 * cannot drift. `SCRIM_OPACITY` is why the backdrop animates to 0.55 rather
 * than 1: Dark Glow's `surface.overlay` carried its own alpha, the UI 2.0
 * palette has no overlay token, and an opaque scrim would hide the screen
 * behind it entirely.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  Animated,
  type ViewStyle,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { radii, spacing } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { scrimColor } from '../ui2/Ui2Sheet';

interface SheetProps {
  visible: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
  /** When true, backdrop tap dismisses. Default: true. */
  dismissOnBackdrop?: boolean;
  /** Pin the sheet height to a specific value; otherwise fits content. */
  height?: number | 'auto';
  style?: ViewStyle;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Matches Ui2Sheet — the alpha Dark Glow's `surface.overlay` token used to carry. */
const SCRIM_OPACITY = 0.55;

export function Sheet({
  visible,
  onDismiss,
  children,
  dismissOnBackdrop = true,
  height = 'auto',
  style,
}: SheetProps) {
  const { c, scheme, shape } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (shouldReduce) {
        translateY.setValue(0);
        backdropOpacity.setValue(SCRIM_OPACITY);
      } else {
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
      }
    } else {
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible, shouldReduce, duration, translateY, backdropOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { backgroundColor: scrimColor(scheme, c), opacity: backdropOpacity },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onDismiss : undefined}
          accessibilityLabel="Dismiss sheet"
        />
      </Animated.View>

      {/* Sheet content */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.card,
            borderColor: c.cardBorder,
            borderTopWidth: shape.border,
          },
          height !== 'auto' ? { height } : undefined,
          { transform: [{ translateY }] },
          style,
        ]}
      >
        <View style={styles.grabberWrapper}>
          <View style={[styles.grabber, { backgroundColor: c.idle }]} />
        </View>
        {/* A pinned height is only useful if the content can actually fill it.
            Without this, a caller that passes `height` gets a tall sheet with
            its children collapsed to their intrinsic size at the top — which
            is what happened to the avatar grid. Applied ONLY when the height
            is pinned, so auto-height sheets keep hugging their content. */}
        <View style={[styles.content, height !== 'auto' && styles.contentFilled]}>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  grabberWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  /** Only with a pinned `height` — lets children lay out against the full sheet. */
  contentFilled: {
    flex: 1,
  },
});
