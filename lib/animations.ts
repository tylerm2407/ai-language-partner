/**
 * Centralized animation presets using React Native's built-in Animated API.
 * Spring/timing configs for consistent motion feel.
 */

// ─── Spring Presets ──────────────────────────────────────────────

export const SPRING_SNAPPY = {
  speed: 15,
  bounciness: 4,
};

export const SPRING_BOUNCY = {
  speed: 12,
  bounciness: 10,
};

export const SPRING_GENTLE = {
  speed: 8,
  bounciness: 6,
};

// ─── Timing Durations ────────────────────────────────────────────

export const TIMING_FAST = 200;
export const TIMING_MEDIUM = 400;
export const TIMING_SLOW = 600;
