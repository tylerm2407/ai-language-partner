/**
 * OnboardingChecklistFab — floating "Get started" progress button.
 *
 * Mobile-app onboarding pattern used by Appcues, Userpilot, Pendo,
 * Intercom product tours, and Figma's widget bar: a compact circular
 * button anchored in the bottom-right with a progress ring showing
 * "N of M complete" at a glance. Tap to expand into a bottom sheet
 * that lists the actual checklist items.
 *
 * Positioning: absolute, bottom-right, lifted above the tab bar
 * (bottom: 100) to match the ScrollView paddingBottom in index.tsx.
 *
 * Auto-hides when:
 *   - isVisible is false (dismissed or all-complete)
 *   - allComplete is true (brief confetti then fade)
 *
 * Keeps all the existing onboarding-checklist behaviour: XP reward on
 * 100%, confetti, notification-permission request for dailyReminder,
 * route-navigation per item.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { Heading, Body, Caption } from '../ui/Text';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { useProfile } from '../../hooks/useProfile';
import { colors, radii, spacing } from '../../config/theme';

const FAB_SIZE = 60;
const RING_STROKE = 4;
const RING_RADIUS = (FAB_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

const CONFETTI_COLORS = ['#FBBF24', '#34D399', '#38BDF8', '#A855F7', '#F472B6', '#60A5FA'];
const PARTICLE_COUNT = 12;

function ConfettiParticle({ index }: { index: number }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 80 + Math.random() * 40;

    Animated.sequence([
      Animated.delay(index * 25),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
        Animated.spring(translateX, {
          toValue: Math.cos(angle) * distance,
          speed: 10,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: Math.sin(angle) * distance,
          speed: 10,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [index, translateX, translateY, opacity, scale]);

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + (index % 3) * 3;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
      }}
      pointerEvents="none"
    >
      <Ionicons name={(index % 2 === 0 ? 'star' : 'ellipse') as any} size={size} color={color} />
    </Animated.View>
  );
}

interface OnboardingChecklistFabProps {
  /** Optional distance from bottom to lift above the tab bar. Default 100. */
  bottomOffset?: number;
}

export function OnboardingChecklistFab({ bottomOffset = 100 }: OnboardingChecklistFabProps) {
  const router = useRouter();
  const { earnXp } = useProfile();
  const {
    isVisible,
    items,
    completedCount,
    totalCount,
    allComplete,
    progress,
    markItem,
    dismiss,
  } = useOnboardingChecklist();

  const [open, setOpen] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Pulse the FAB subtly while it has pending items — draws the eye
  // without being noisy. Gated off once all items are complete.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isVisible || allComplete) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [isVisible, allComplete, pulse]);

  // Animate the progress ring as `progress` advances
  const progressAnim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false, // strokeDashoffset can't use native driver
    }).start();
  }, [progress, progressAnim]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  // All-complete side effects: +50 XP, confetti, auto-dismiss after a beat
  useEffect(() => {
    if (!isVisible) return;
    if (!allComplete || xpAwarded) return;

    setXpAwarded(true);
    setShowConfetti(true);
    earnXp(50).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const closeConfetti = setTimeout(() => setShowConfetti(false), 2500);
    const autoDismiss = setTimeout(() => {
      dismiss().catch(() => {});
      setOpen(false);
    }, 3200);
    return () => {
      clearTimeout(closeConfetti);
      clearTimeout(autoDismiss);
    };
  }, [allComplete, xpAwarded, isVisible, earnXp, dismiss]);

  const handleItemPress = useCallback(
    async (key: string, route: string | null) => {
      // Haptic feedback on item tap
      Haptics.selectionAsync().catch(() => {});

      if (key === 'dailyReminder') {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            await markItem('dailyReminder');
          } else {
            Alert.alert(
              'Notifications Disabled',
              'Enable notifications in your device settings to set daily reminders.',
              [{ text: 'OK' }],
            );
          }
        } catch {
          Alert.alert('Error', 'Could not request notification permissions.');
        }
        return;
      }

      if (route) {
        setOpen(false); // close the sheet before navigating
        router.push(route as any);
      }
    },
    [markItem, router],
  );

  const handleOpen = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setOpen(true);
  }, []);

  const handleDismissAll = useCallback(async () => {
    setOpen(false);
    await dismiss().catch(() => {});
  }, [dismiss]);

  if (!isVisible) return null;

  return (
    <>
      {/* Floating action button */}
      <Animated.View
        style={[
          styles.fabWrapper,
          { bottom: bottomOffset, transform: [{ scale: pulse }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Confetti burst anchored on the FAB */}
        {showConfetti && (
          <View style={styles.confettiAnchor} pointerEvents="none">
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
          </View>
        )}

        <Pressable
          onPress={handleOpen}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={`Onboarding checklist, ${completedCount} of ${totalCount} complete`}
          accessibilityHint="Opens the getting-started checklist"
        >
          {/* Progress ring */}
          <Svg
            width={FAB_SIZE}
            height={FAB_SIZE}
            style={StyleSheet.absoluteFill}
          >
            {/* Track */}
            <SvgCircle
              cx={FAB_SIZE / 2}
              cy={FAB_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.border.default}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Progress arc — rotates -90deg so 0% starts at 12 o'clock */}
            <AnimatedCircle
              cx={FAB_SIZE / 2}
              cy={FAB_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.indigo[400]}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              rotation={-90}
              originX={FAB_SIZE / 2}
              originY={FAB_SIZE / 2}
            />
          </Svg>

          {/* Center label — count / rocket icon */}
          <View style={styles.fabInner}>
            <Ionicons name="rocket" size={14} color={colors.indigo[300]} />
            <Body size="sm" weight="bold" style={styles.fabCount}>
              {completedCount}/{totalCount}
            </Body>
          </View>
        </Pressable>
      </Animated.View>

      {/* Expandable sheet */}
      <Sheet visible={open} onDismiss={() => setOpen(false)}>
        <View style={{ paddingBottom: spacing.sm }}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Ionicons name="rocket" size={20} color={colors.indigo[400]} />
              <Heading level={3} style={{ marginLeft: spacing.xs }}>
                Get started
              </Heading>
            </View>
            <Pressable
              onPress={handleDismissAll}
              accessibilityRole="button"
              accessibilityLabel="Hide checklist"
              style={styles.hideButton}
              hitSlop={8}
            >
              <Caption tone="tertiary">Hide</Caption>
            </Pressable>
          </View>

          {/* Progress summary */}
          <Body tone="secondary" size="sm" style={{ marginBottom: spacing.sm }}>
            {completedCount} of {totalCount} complete
            {allComplete ? ' — nice work!' : ''}
          </Body>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>

          {/* Items */}
          <View style={{ marginTop: spacing.sm }}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                style={styles.itemRow}
                onPress={() => !item.completed && handleItemPress(item.key, item.route)}
                disabled={item.completed}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}${item.completed ? ', completed' : ''}`}
                accessibilityState={{ checked: item.completed, disabled: item.completed }}
              >
                <View
                  style={[
                    styles.checkCircle,
                    item.completed
                      ? { backgroundColor: colors.success.base, borderColor: 'transparent' }
                      : { borderColor: colors.text.tertiary },
                  ]}
                >
                  {item.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={item.completed ? colors.success.base : colors.text.tertiary}
                  style={{ marginRight: spacing.xs }}
                />
                <Text
                  style={[
                    styles.itemLabel,
                    item.completed
                      ? { color: colors.success.light, textDecorationLine: 'line-through' }
                      : { color: colors.text.primary },
                  ]}
                >
                  {item.label}
                </Text>
                {!item.completed && item.route && (
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    right: spacing.md,
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow — the only place in chrome where elevation is allowed
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabCount: {
    color: colors.text.primary,
    marginTop: 1,
  },
  confettiAnchor: {
    position: 'absolute',
    top: FAB_SIZE / 2,
    left: FAB_SIZE / 2,
    width: 0,
    height: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hideButton: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.cardAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.indigo[400],
    borderRadius: radii.pill,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
