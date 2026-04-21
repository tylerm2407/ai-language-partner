/**
 * Sheet — bottom-anchored modal.
 *
 * Slides up from the bottom safe area. Dismissible via backdrop tap,
 * swipe-down, or an explicit close button. Used for correct/incorrect
 * feedback, out-of-hearts prompts, achievement reveals, join-class,
 * avatar-customizer, settings, etc.
 *
 * Animation honors useMotion; reduced-motion collapses to a dissolve.
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
import { colors, radii, spacing } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';

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

export function Sheet({
  visible,
  onDismiss,
  children,
  dismissOnBackdrop = true,
  height = 'auto',
  style,
}: SheetProps) {
  const { shouldReduce, duration } = useMotion();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (shouldReduce) {
        translateY.setValue(0);
        backdropOpacity.setValue(1);
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: duration.medium,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
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
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
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
          height !== 'auto' ? { height } : undefined,
          { transform: [{ translateY }] },
          style,
        ]}
      >
        <View style={styles.grabberWrapper}>
          <View style={styles.grabber} />
        </View>
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.sheet,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
  },
  grabberWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border.strong,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
