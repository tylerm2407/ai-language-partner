/**
 * active-time — how long the learner was actually *in* a practice screen.
 *
 * `daily_stats.minutes_practiced` has read zero since it shipped: the only
 * writer was the chat screen's per-turn `speaking_minutes`, and nothing ever
 * wrote the wall-clock column the week strip charts and the daily goal is
 * measured against. `lib/challenges.ts` records the consequence — the
 * time-based challenges were deleted in Aug 2026 because they could never be
 * satisfied. This module is the missing half.
 *
 * WHY A CLOCK AND NOT `Date.now()` AT BOTH ENDS
 *
 * A screen's lifetime is not practice time. A learner opens a lesson, takes a
 * call, comes back forty minutes later and finishes: a naive end-minus-start
 * credits forty minutes of "practice" to a phone lying face down. So:
 *
 *   - the caller pauses on `AppState !== 'active'`, which removes backgrounded
 *     time outright;
 *   - a single continuous stretch is clamped at `MAX_CONTINUOUS_STRETCH_MS`,
 *     which covers the case the AppState pause cannot see — a screen left open
 *     and untouched in the foreground;
 *   - the whole session is capped at `MAX_SESSION_MS`, a backstop against a
 *     clock that jumps (timezone change, NTP correction) or a pause that never
 *     arrives.
 *
 * The numbers are deliberately generous. Under-counting real practice is the
 * expensive error here — the goal ring is the thing the learner is measured
 * against, and a ring that stalls while they work is worse than one that
 * occasionally credits a minute of staring at the screen.
 *
 * `now` is injectable so the whole thing is testable without fake timers.
 */

/**
 * Longest single uninterrupted stretch that can be credited, in ms.
 *
 * 20 minutes is past the length of a typical lesson but well short of "left
 * open over lunch". A learner genuinely working for longer keeps accruing —
 * every pause/resume starts a fresh stretch — so this only truncates a stretch
 * with no interaction at all behind it.
 */
export const MAX_CONTINUOUS_STRETCH_MS = 20 * 60 * 1000;

/**
 * Ceiling on what one `stop()` can report, in ms. The RPC clamps the column at
 * 1440 minutes a day anyway (migration 114), but a single screen reporting an
 * hour is already implausible and worth catching here, where it is visible.
 */
export const MAX_SESSION_MS = 60 * 60 * 1000;

export interface ActiveClockOptions {
  /** Injected for tests. Defaults to `Date.now`. */
  now?: () => number;
  maxStretchMs?: number;
  maxTotalMs?: number;
}

export interface ActiveClock {
  /** Begin counting. A second call while already started is a no-op, not a reset. */
  start(): void;
  /** Bank the stretch in progress and stop counting. Safe to call twice. */
  pause(): void;
  /** Start a fresh stretch. No-op unless started and currently paused. */
  resume(): void;
  /**
   * Bank, stop, and return the total in SECONDS.
   *
   * Destructive and idempotent: the total is handed over once and the clock
   * resets, so a screen that stops explicitly and then again on unmount writes
   * its minutes once rather than twice. The second call returns 0.
   */
  stop(): number;
  /** Seconds accrued so far, stretch-in-progress included. Non-destructive. */
  peekSeconds(): number;
  /** True only while started AND not paused. */
  isRunning(): boolean;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createActiveClock(options: ActiveClockOptions = {}): ActiveClock {
  const now = options.now ?? (() => Date.now());
  const maxStretchMs = positive(options.maxStretchMs, MAX_CONTINUOUS_STRETCH_MS);
  const maxTotalMs = positive(options.maxTotalMs, MAX_SESSION_MS);

  let bankedMs = 0;
  /** Epoch ms the current stretch began, or null when not counting. */
  let stretchStartedAt: number | null = null;
  let started = false;

  /** Clamp the stretch in progress and fold it into the total. */
  function bank(): void {
    if (stretchStartedAt === null) return;
    // `Math.max(0, …)` guards a clock that moved backwards: a negative stretch
    // would otherwise subtract from time the learner really did put in.
    const raw = Math.max(0, now() - stretchStartedAt);
    bankedMs += Math.min(raw, maxStretchMs);
    stretchStartedAt = null;
  }

  return {
    start() {
      if (started) return;
      started = true;
      bankedMs = 0;
      stretchStartedAt = now();
    },
    pause() {
      if (!started) return;
      bank();
    },
    resume() {
      if (!started) return;
      if (stretchStartedAt !== null) return;
      stretchStartedAt = now();
    },
    stop() {
      if (!started) return 0;
      bank();
      started = false;
      const totalMs = Math.min(bankedMs, maxTotalMs);
      bankedMs = 0;
      return totalMs / 1000;
    },
    peekSeconds() {
      if (!started) return 0;
      const liveMs =
        stretchStartedAt === null
          ? 0
          : Math.min(Math.max(0, now() - stretchStartedAt), maxStretchMs);
      return Math.min(bankedMs + liveMs, maxTotalMs) / 1000;
    },
    isRunning() {
      return started && stretchStartedAt !== null;
    },
  };
}

// ─── Daily goal ────────────────────────────────────────────────────────────

/**
 * Goal to assume when a profile carries none.
 *
 * 10 is what onboarding writes (`DEFAULT_DAILY_GOAL`) and what Settings and the
 * profile screen already fall back to inline. Home's hero used to say 15, which
 * was nobody's default and nothing compared it to anything — this is the same
 * number as the rest of the app, named once. Onboarding and Settings still
 * carry their own literals; folding those in means touching screens this change
 * does not own.
 */
export const DEFAULT_DAILY_GOAL_MINUTES = 10;

export interface GoalProgress {
  /** 0..1, clamped. Safe to hand straight to a progress bar or ring. */
  pct: number;
  /** Whole minutes still to go, at least 1 while unmet, 0 once met. */
  remainingMinutes: number;
  met: boolean;
}

/**
 * Today's practice against `user_profiles.daily_goal_minutes`.
 *
 * A non-positive or non-finite goal is not a goal: it reports an empty ring
 * with nothing outstanding and nothing met, and the caller decides whether to
 * draw anything at all. Inventing a default here would put the number that
 * defines "done" in two places.
 *
 * `remainingMinutes` floors at 1 while the goal is unmet so the copy never
 * says "0 minutes to go" beside a ring that is visibly short.
 */
export function goalProgress(minutesToday: number, goalMinutes: number): GoalProgress {
  const done = Number.isFinite(minutesToday) && minutesToday > 0 ? minutesToday : 0;
  const goal = Number.isFinite(goalMinutes) && goalMinutes > 0 ? goalMinutes : 0;

  if (goal === 0) return { pct: 0, remainingMinutes: 0, met: false };

  const met = done >= goal;
  return {
    pct: Math.min(done / goal, 1),
    remainingMinutes: met ? 0 : Math.max(1, Math.ceil(goal - done)),
    met,
  };
}

/**
 * Whole minutes for display.
 *
 * The column is NUMERIC and now carries fractions, so a raw render reads
 * "23.466666666666665 min". Anything above zero but under a minute shows as 1:
 * the learner did practise, and "0 min" straight after a session reads as a bug.
 */
export function displayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(1, Math.round(minutes));
}
