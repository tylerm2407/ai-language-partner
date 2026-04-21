/**
 * CelebrationOverlay — full-screen reward moment.
 *
 * Composes mascot + confetti + headline + subtitle + primary CTA into a
 * single reusable modal. Designed for:
 *   - correct answer reveal (mood="correct")
 *   - lesson complete (mood="lessonComplete")
 *   - streak milestone (mood="streakMilestone")
 *   - level up (mood="levelUp")
 *
 * Haptic + confetti scale with mood intensity. All motion honors
 * useMotion().shouldReduce — reduced-motion collapses to a dissolve +
 * static mascot (no confetti particles, no scale bounce).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Animated,
  StyleSheet,
  type ViewStyle,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, motion, spacing } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';
import { Mascot, type MascotState } from '../mascot/Mascot';
import { Body, Hero } from './Text';
import { TactileButton } from './TactileButton';

type Mood = 'correct' | 'lessonComplete' | 'streakMilestone' | 'levelUp';

interface CelebrationOverlayProps {
  visible: boolean;
  mood: Mood;
  title: string;
  subtitle?: string;
  /** Primary CTA label. If absent, overlay auto-dismisses after 1200ms. */
  ctaLabel?: string;
  onDismiss?: () => void;
}

const MOOD_CONFIG: Record<
  Mood,
  { mascot: MascotState; particles: number; haptic: Haptics.NotificationFeedbackType | null }
> = {
  correct: { mascot: 'happy', particles: 10, haptic: Haptics.NotificationFeedbackType.Success },
  lessonComplete: { mascot: 'cheering', particles: 25, haptic: Haptics.NotificationFeedbackType.Success },
  streakMilestone: { mascot: 'cheering', particles: 40, haptic: Haptics.NotificationFeedbackType.Success },
  levelUp: { mascot: 'cheering', particles: 40, haptic: Haptics.NotificationFeedbackType.Success },
};

const PARTICLE_COLORS = [
  colors.indigo[400],
  colors.success.base,
  colors.warning.base,
  colors.premium.base,
  colors.indigo[200],
];

function Particle({
  index,
  shouldAnimate,
}: {
  index: number;
  shouldAnimate: boolean;
}) {
  const angle = (index * (360 / 20) + Math.random() * 30) * (Math.PI / 180);
  const distance = 90 + Math.random() * 80;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shouldAnimate) return;
    Animated.sequence([
      Animated.delay(index * 15),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(tx, {
          toValue: Math.cos(angle) * distance,
          duration: motion.duration.celebration + 100,
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: Math.sin(angle) * distance,
          duration: motion.duration.celebration + 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1 + Math.random(),
          duration: motion.duration.celebration,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [shouldAnimate, angle, distance, index, opacity, tx, ty, rotate]);

  const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: color,
          opacity,
          transform: [
            { translateX: tx },
            { translateY: ty },
            {
              rotate: rotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export function CelebrationOverlay({
  visible,
  mood,
  title,
  subtitle,
  ctaLabel,
  onDismiss,
}: CelebrationOverlayProps) {
  const { shouldReduce, duration } = useMotion();
  const config = MOOD_CONFIG[mood];
  const scale = useRef(new Animated.Value(0.8)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.8);
      overlayOpacity.setValue(0);
      return;
    }

    if (config.haptic) {
      Haptics.notificationAsync(config.haptic).catch(() => {});
    }

    if (shouldReduce) {
      scale.setValue(1);
      overlayOpacity.setValue(1);
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: duration.medium,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Auto-dismiss if no CTA
    if (!ctaLabel && onDismiss) {
      const t = setTimeout(onDismiss, 1200);
      return () => clearTimeout(t);
    }
  }, [visible, shouldReduce, duration, config.haptic, ctaLabel, onDismiss, scale, overlayOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={ctaLabel ? undefined : onDismiss} />

        {/* Confetti — omitted entirely when reduced-motion */}
        {!shouldReduce && (
          <View style={styles.particleContainer} pointerEvents="none">
            {Array.from({ length: config.particles }).map((_, i) => (
              <Particle key={i} index={i} shouldAnimate={visible} />
            ))}
          </View>
        )}

        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale }] },
          ]}
        >
          <Mascot state={config.mascot} size="lg" />

          <Hero tone="primary" style={styles.title}>
            {title}
          </Hero>

          {subtitle && (
            <Body size="lg" tone="secondary" style={styles.subtitle}>
              {subtitle}
            </Body>
          )}

          {ctaLabel && onDismiss && (
            <View style={styles.cta}>
              <TactileButton label={ctaLabel} onPress={onDismiss} fullWidth />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    maxWidth: 320,
    width: '80%',
  } as ViewStyle,
  title: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
