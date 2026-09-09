/**
 * The in-app half of the launch splash (see lib/launch-splash.ts for the
 * contract with the native storyboard and why there are two halves).
 *
 * Mounts over the whole app drawing the storyboard's exact frame — tile
 * `TILE_SIZE` wide, centred on the scheme's ground — hides the native splash on
 * its first layout, plays the A3 · Peek stage, then fades itself out and asks
 * to be unmounted. It never blocks touches and is hidden from screen readers:
 * it is decoration over a screen that is already there.
 */
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';
import {
  PEEK,
  SOL_SIZE,
  TILE_FILL,
  TILE_SIZE,
  TWITCH,
  WORDMARK_FONT_SIZE,
  WORDMARK_GAP,
  WORDMARK_LETTER_SPACING,
  WORDMARK_LINE_HEIGHT,
  launchSplashPlan,
} from '../../lib/launch-splash';

// The same files the storyboard shows, so the seam is the same pixels.
const TILE_LIGHT = require('../../assets/splash-icon.png');
const TILE_DARK = require('../../assets/splash-icon-dark.png');
const SOL = require('../../assets/mascot/sol-still.png');

const SOL_INSET = (TILE_SIZE - SOL_SIZE) / 2;
const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const EASE_IN = Easing.bezier(0.6, 0, 0.8, 0.4);

interface LaunchSplashProps {
  /** Called once the crossfade has finished; the parent unmounts the overlay. */
  onDone: () => void;
}

export function LaunchSplash({ onDone }: LaunchSplashProps) {
  const { c, scheme, type } = useUi2Theme();
  const { shouldReduce } = useMotion();

  const overlay = useSharedValue(1);
  const tileScale = useSharedValue(1);
  const wordOpacity = useSharedValue(0);
  const wordY = useSharedValue(14);
  const solOpacity = useSharedValue(0);
  const solX = useSharedValue(0);
  const solY = useSharedValue(0);
  const solRotate = useSharedValue(0);

  // The plan is fixed on mount: a reduce-motion flip mid-stage is not worth a
  // second choreography for a stage this short.
  const started = useRef(false);
  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const plan = launchSplashPlan(shouldReduce);

    if (plan.sol) {
      tileScale.value = withSequence(
        withTiming(1.14, { duration: plan.breatheUp, easing: EASE_OUT }),
        withTiming(1, { duration: plan.breatheDown, easing: Easing.inOut(Easing.quad) }),
        withDelay(
          plan.fadeDelay - plan.breatheUp - plan.breatheDown,
          withTiming(1.08, { duration: plan.fade, easing: EASE_OUT }),
        ),
      );
      const holdMs = plan.holdUntil - plan.solDelay - plan.peekOut;
      solOpacity.value = withDelay(plan.solDelay, withTiming(1, { duration: 40 }));
      const travel = (peek: number, twitch: number) =>
        withDelay(
          plan.solDelay,
          withSequence(
            withTiming(peek, { duration: plan.peekOut, easing: EASE_OUT }),
            withDelay(holdMs, withTiming(twitch, { duration: plan.twitch, easing: EASE_OUT })),
            withTiming(0, { duration: plan.peekBack, easing: EASE_IN }),
          ),
        );
      solX.value = travel(PEEK.x, TWITCH.x);
      solY.value = travel(PEEK.y, TWITCH.y);
      solRotate.value = travel(PEEK.rotate, TWITCH.rotate);
    }

    wordOpacity.value = withDelay(plan.wordDelay, withTiming(1, { duration: plan.wordIn, easing: EASE_OUT }));
    wordY.value = withDelay(plan.wordDelay, withTiming(0, { duration: plan.wordIn, easing: EASE_OUT }));

    overlay.value = withDelay(
      plan.fadeDelay,
      withTiming(0, { duration: plan.fade, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
    // Shared values are stable refs; the stage runs exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop the native storyboard only once this frame exists to replace it.
  const hidden = useRef(false);
  const onLayout = useCallback(() => {
    if (hidden.current) return;
    hidden.current = true;
    // Nothing to surface: if the native splash cannot be hidden here, Expo's
    // own auto-hide already dropped it, and the overlay is the same picture.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ scale: tileScale.value }] }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordY.value }],
  }));
  const solStyle = useAnimatedStyle(() => ({
    opacity: solOpacity.value,
    transform: [
      { translateX: solX.value },
      { translateY: solY.value },
      { rotate: `${solRotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.fill, { backgroundColor: c.bg }, overlayStyle]}
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="launch-splash"
    >
      <View style={styles.centre}>
        <View style={styles.tileBox}>
          {!shouldReduce && (
            <Animated.View style={[styles.sol, solStyle]}>
              <Image source={SOL} style={styles.fillImage} contentFit="contain" />
            </Animated.View>
          )}
          <Animated.View style={[styles.tile, tileStyle]}>
            <Image
              source={scheme === 'dark' ? TILE_DARK : TILE_LIGHT}
              style={styles.fillImage}
              contentFit="contain"
            />
          </Animated.View>
          <Animated.View style={[styles.wordBox, wordStyle]}>
            <Text
              style={[
                styles.word,
                { color: c.ink, fontFamily: type.heading },
              ]}
              allowFontScaling={false}
            >
              fluenci
            </Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const WORD_BOX_WIDTH = 320;

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  fillImage: { width: '100%', height: '100%' },
  // The tile sits at the exact centre, like the storyboard's image view; the
  // wordmark hangs off it absolutely so it cannot nudge the tile.
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileBox: { width: TILE_SIZE, height: TILE_SIZE },
  tile: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE * 0.2237,
    backgroundColor: TILE_FILL,
    zIndex: 1,
  },
  sol: {
    position: 'absolute',
    left: SOL_INSET,
    top: SOL_INSET,
    width: SOL_SIZE,
    height: SOL_SIZE,
    zIndex: 0,
  },
  wordBox: {
    position: 'absolute',
    top: TILE_SIZE + WORDMARK_GAP,
    left: (TILE_SIZE - WORD_BOX_WIDTH) / 2,
    width: WORD_BOX_WIDTH,
    alignItems: 'center',
    zIndex: 1,
  },
  word: {
    fontSize: WORDMARK_FONT_SIZE,
    lineHeight: WORDMARK_LINE_HEIGHT,
    letterSpacing: WORDMARK_LETTER_SPACING,
    textAlign: 'center',
  },
});
