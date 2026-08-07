/**
 * Motion utilities for the redesigned UI.
 *
 * Every animation in the app should route through `useMotion()` so that:
 *   1. Durations/easings come from theme tokens (no ad-hoc 347ms).
 *   2. `prefersReducedMotion` is honored globally — `shouldReduce` returns
 *      true when the user has enabled Reduce Motion on their device.
 *      Callers collapse durations to 0 / skip animation accordingly.
 *   3. The in-app preference is honored too. `shouldReduce` is the OR of the
 *      OS setting and `lib/motion-preference`, because WCAG 2.2 SC 2.2.2
 *      (Level A) wants a mechanism *we* provide, not just the system switch.
 *      Callers need no change — one flag still means one thing.
 *
 * Research anchors: Apple HIG "Reduce Motion" accessibility criterion, WCAG 2.2
 * SC 2.2.2 Pause/Stop/Hide + Material 3 motion duration specs. See
 * design-research.md.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { motion } from '../config/theme';
import { getReduceMotion, subscribeMotionPreference } from '../lib/motion-preference';

export function useMotion() {
  const [systemReduce, setSystemReduce] = useState(false);
  const [userReduce, setUserReduce] = useState(getReduceMotion);

  useEffect(() => {
    let mounted = true;

    // Initial read
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setSystemReduce(enabled);
      })
      .catch(() => {
        // Not all platforms support this; default to false.
      });

    // Subscribe to changes while the app is open
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setSystemReduce(enabled);
      }
    );

    // Sync with the in-app toggle. Re-read on mount as well as subscribing:
    // hydration may have landed between module load and this effect.
    setUserReduce(getReduceMotion());
    const unsubscribe = subscribeMotionPreference(setUserReduce);

    return () => {
      mounted = false;
      sub?.remove();
      unsubscribe();
    };
  }, []);

  // Either source suppresses motion. Never AND these — a user who set the
  // OS switch expects it to work whether or not they found our toggle.
  const shouldReduce = systemReduce || userReduce;

  return {
    shouldReduce,
    duration: motion.duration,
    easing: motion.easing,
    /** Returns the duration, or 0 if reduced-motion is on. */
    durationOr0(key: keyof typeof motion.duration): number {
      return shouldReduce ? 0 : motion.duration[key];
    },
  };
}
