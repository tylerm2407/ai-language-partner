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
 * Visibility is decided entirely by persisted state — `dismissed` or
 * `celebratedAt` — never by a timer or a heuristic. The previous version's
 * auto-dismiss could not fire at all: it wrote `xpAwarded` inside an effect
 * that listed `xpAwarded` as a dependency, so the re-render's cleanup cleared
 * both of its timers before either ran. Deterministic, not a race — which is
 * why the rocket never went away. See `celebratingRef` below.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Alert,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Sheet } from '../ui/Sheet';
import { Heading, Body, Caption } from '../ui/Text';
import {
  useOnboardingChecklist,
  type OnboardingRow,
} from '../../hooks/useOnboardingChecklist';
import { useMotion } from '../../hooks/useMotion';
import { useAppStore, effectiveTier } from '../../stores/useAppStore';
import { incrementXpIdempotent } from '../../lib/supabase-queries';
import {
  ONBOARDING_COMPLETE_XP,
  ONBOARDING_COMPLETE_XP_KEY,
} from '../../lib/onboarding-checklist';
import { colors, radii, spacing } from '../../config/theme';

const FAB_SIZE = 60;
const RING_STROKE = 4;
const RING_RADIUS = (FAB_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

const CONFETTI_COLORS = ['#FBBF24', '#34D399', '#38BDF8', '#A855F7', '#F472B6', '#60A5FA'];
const PARTICLE_COUNT = 12;

/** How long the confetti stays up before the checklist retires itself. */
const CELEBRATION_MS = 2500;

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
  const {
    isVisible,
    items,
    completedCount,
    totalCount,
    isResolved,
    celebrationPending,
    progress,
    markItem,
    skipItem,
    markCelebrated,
    dismiss,
  } = useOnboardingChecklist();

  // The AI tutor is uncompletable on the free tier — `_shared/plan-limits.ts`
  // sets `starter.dailyTextMessages = 0` — so for those learners that step has
  // to be resolvable some other way or the checklist can never retire.
  const subscription = useAppStore((s) => s.subscription);
  const entitledTier = useAppStore((s) => s.entitledTier);
  const isFreeTier = effectiveTier(subscription, entitledTier) === 'starter';

  const [open, setOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Pulse the FAB subtly while it has pending items — draws the eye
  // without being noisy. Gated off once all items are complete, and off
  // entirely under Reduce Motion: an indefinite pulse on the home screen is
  // WCAG 2.2 SC 2.2.2 territory, and the ring already conveys progress.
  const { shouldReduce } = useMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isVisible || isResolved || shouldReduce) return;
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
  }, [isVisible, isResolved, shouldReduce, pulse]);

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

  /**
   * The celebration: +50 XP, confetti, then retire.
   *
   * Two things here are load-bearing and easy to undo by accident.
   *
   * `celebratingRef` is a ref rather than state so that the once-only guard can
   * never appear in the dependency array. The previous version used state, so
   * setting the guard re-ran the effect, and the cleanup cleared both timers
   * before either fired — the checklist could not dismiss itself, ever.
   *
   * The XP goes through `incrementXpIdempotent` under a fixed key rather than
   * through `earnXp`, which mints a random key per call. With a random key the
   * `client_events` de-dupe protected nothing, and since the dismiss never
   * landed, every app launch re-ran this and paid out another 50 XP. The stable
   * key makes the server the guard: a second award is impossible even if every
   * client-side flag write fails.
   *
   * `isFocused` matters because the bottom tabs keep Home mounted while it is
   * hidden, so without it the confetti plays behind whatever screen the learner
   * is actually looking at. `completedAt` is already persisted by the time we
   * get here, so deferring to the next Home visit loses nothing — not even
   * across an app kill.
   */
  const isFocused = useIsFocused();
  const celebratingRef = useRef(false);
  useEffect(() => {
    if (!celebrationPending || !isFocused || celebratingRef.current) return;
    celebratingRef.current = true;

    incrementXpIdempotent(ONBOARDING_COMPLETE_XP, ONBOARDING_COMPLETE_XP_KEY).catch((err) => {
      Sentry.captureException(err, {
        tags: { area: 'onboarding-checklist', op: 'complete-xp' },
      });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!shouldReduce) setShowConfetti(true);

    const timer = setTimeout(() => {
      setShowConfetti(false);
      setOpen(false);
      markCelebrated().catch((err) => {
        // The ref stays set, so this does not retry within the session. It does
        // not need to: `completedAt` is persisted, so the next launch finds the
        // celebration still pending and tries again — and the XP key means that
        // retry cannot pay twice.
        Sentry.captureException(err, {
          tags: { area: 'onboarding-checklist', op: 'mark-celebrated' },
        });
      });
    }, shouldReduce ? 0 : CELEBRATION_MS);
    return () => clearTimeout(timer);
    // Primitives only. Anything derived from `profile` would re-run this on
    // every unrelated store write and cancel the timer mid-celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrationPending, isFocused, shouldReduce]);

  const handleItemPress = useCallback(
    async (row: OnboardingRow) => {
      // Haptic feedback on item tap
      Haptics.selectionAsync().catch(() => {});

      if (row.stepKey === 'dailyReminder') {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            // Reconciliation would derive this on the next launch, but the
            // learner just tapped a thing and expects the tick now.
            await markItem('dailyReminder');
            return;
          }
        } catch (err) {
          Sentry.captureException(err, {
            tags: { area: 'onboarding-checklist', op: 'request-notifications' },
          });
          Alert.alert('Something went wrong', 'We could not ask for notification permission just now.');
          return;
        }
        // Denied. The OS will not ask again, so an "enable it in Settings"
        // message with an OK button is a dead end — the step becomes
        // permanently un-tickable and the checklist never resolves. Offer the
        // two things that actually move: go turn it on, or say no properly.
        Alert.alert(
          'Reminders are off',
          'iOS only asks once. You can turn reminders on in Settings, or skip this step — it will stop asking either way.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Skip this step', onPress: () => { skipItem('dailyReminder').catch(() => {}); } },
            { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
          ],
        );
        return;
      }

      if (row.stepKey === 'aiConversation' && isFreeTier) {
        // The free tier's chat quota is zero server-side, so sending them to
        // /chat is sending them to a paywall they cannot pass. Offer the
        // upgrade at the moment of want, and an honest way out if the answer
        // is no — otherwise this step alone keeps the rocket on screen forever.
        Alert.alert(
          'AI conversation is a paid feature',
          'Practising with the AI tutor needs a paid plan. You can see what is included, or skip this step.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Skip this step', onPress: () => { skipItem('aiConversation').catch(() => {}); } },
            {
              text: 'See plans',
              onPress: () => {
                setOpen(false);
                router.push('/plans');
              },
            },
          ],
        );
        return;
      }

      if (row.route) {
        setOpen(false); // close the sheet before navigating
        router.push(row.route as never);
      }
    },
    [markItem, skipItem, isFreeTier, router],
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
            {isResolved ? ' — nice work!' : ''}
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
            {items.map((item) => {
              const done = item.state === 'done';
              const skipped = item.state === 'skipped';
              // A skipped row is still tappable: skipping resolves the
              // checklist, it does not close the door on doing the thing.
              const interactive = !done && item.stepKey !== null;
              return (
                <Pressable
                  key={item.key}
                  style={styles.itemRow}
                  onPress={() => interactive && handleItemPress(item)}
                  disabled={!interactive}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${item.label}` +
                    (done ? ', completed' : skipped ? ', skipped' : '')
                  }
                  // `checked` is false for a skipped row on purpose — the row
                  // must never claim work that didn't happen, to VoiceOver
                  // least of all.
                  accessibilityState={{ checked: done, disabled: !interactive }}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      done
                        ? { backgroundColor: colors.success.base, borderColor: 'transparent' }
                        : { borderColor: colors.text.tertiary },
                    ]}
                  >
                    {done && <Ionicons name="checkmark" size={14} color={colors.text.onSuccess} />}
                    {/* A dash, not a tick: resolved, not achieved. The glyph is
                        the non-colour signal DESIGN.md requires alongside the
                        muted tone and the "Skipped" caption. */}
                    {skipped && <Ionicons name="remove" size={14} color={colors.text.tertiary} />}
                  </View>
                  <Ionicons
                    name={item.icon as never}
                    size={18}
                    color={done ? colors.success.base : colors.text.tertiary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      done
                        ? { color: colors.success.light, textDecorationLine: 'line-through' }
                        : skipped
                          ? { color: colors.text.quaternary }
                          : { color: colors.text.primary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {skipped && <Caption tone="tertiary" style={styles.skippedCaption}>Skipped</Caption>}
                  {interactive && !skipped && item.route && (
                    <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                  )}
                </Pressable>
              );
            })}
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
    // 20 (icon) + 12 + 12 clears the 44pt Apple HIG minimum for the whole row,
    // which is the touch target here — the checkbox is decoration.
    minHeight: 44,
    gap: spacing.xxs,
  },
  skippedCaption: {
    marginLeft: spacing.xs,
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
    fontFamily: 'Nunito_500Medium',
  },
});
