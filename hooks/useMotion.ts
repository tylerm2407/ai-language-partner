/**
 * Motion utilities for the redesigned UI.
 *
 * Every animation in the app should route through `useMotion()` so that:
 *   1. Durations/easings come from theme tokens (no ad-hoc 347ms).
 *   2. `prefersReducedMotion` is honored globally — `shouldReduce` returns
 *      true when the user has enabled Reduce Motion on their device.
 *      Callers collapse durations to 0 / skip animation accordingly.
 *
 * Research anchors: Apple HIG "Reduce Motion" accessibility criterion +
 * Material 3 motion duration specs. See design-research.md.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { motion } from '../config/theme';

export function useMotion() {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Initial read
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setShouldReduce(enabled);
      })
      .catch(() => {
        // Not all platforms support this; default to false.
      });

    // Subscribe to changes while the app is open
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setShouldReduce(enabled);
      }
    );

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

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
